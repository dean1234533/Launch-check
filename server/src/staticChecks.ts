import type { Issue, RepoSnapshot } from "./types.js";

// Deterministic checks that run before (and independently of) the AI review.
// They are cheap, never hallucinate, and catch the most common launch blockers.

interface SecretPattern {
  id: string;
  name: string;
  regex: RegExp;
}

const SECRET_PATTERNS: SecretPattern[] = [
  { id: "stripe-live-secret", name: "Stripe live secret key", regex: /\bsk_live_[0-9a-zA-Z]{20,}\b/ },
  { id: "stripe-restricted", name: "Stripe restricted key", regex: /\brk_live_[0-9a-zA-Z]{20,}\b/ },
  { id: "anthropic-key", name: "Anthropic API key", regex: /\bsk-ant-[0-9a-zA-Z_-]{20,}\b/ },
  { id: "openai-key", name: "OpenAI API key", regex: /\bsk-(?:proj-)?[0-9a-zA-Z_-]{32,}\b/ },
  { id: "aws-access-key", name: "AWS access key", regex: /\bAKIA[0-9A-Z]{16}\b/ },
  { id: "github-token", name: "GitHub token", regex: /\b(?:ghp|gho|ghs|ghu)_[0-9a-zA-Z]{36}\b|\bgithub_pat_[0-9a-zA-Z_]{50,}\b/ },
  { id: "slack-token", name: "Slack token", regex: /\bxox[baprs]-[0-9a-zA-Z-]{10,}\b/ },
  { id: "private-key", name: "private key", regex: /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/ },
  {
    id: "supabase-service-role",
    name: "Supabase service_role key",
    regex: /service_role["']?\s*[:=]\s*["']eyJ[0-9a-zA-Z_-]+\.[0-9a-zA-Z_-]+\.[0-9a-zA-Z_-]+/,
  },
];

const ENV_FILE = /(^|\/)\.env(\.(local|production|prod|development|dev))?$/;

function lineOf(content: string, index: number): number {
  return content.slice(0, index).split("\n").length;
}

function isExampleFile(path: string): boolean {
  return /(^|\/)(\.env\.(example|sample|template)|.*\.example\..*|.*\.sample\..*)$/.test(path);
}

export function runStaticChecks(snapshot: RepoSnapshot): Issue[] {
  const issues: Issue[] = [];
  const seen = new Set<string>();
  const add = (issue: Issue) => {
    if (seen.has(issue.id)) return;
    seen.add(issue.id);
    issues.push(issue);
  };

  // 1. Committed .env files
  for (const path of snapshot.allPaths) {
    if (ENV_FILE.test(path)) {
      add({
        id: `committed-env-${path}`,
        severity: "critical",
        category: "security",
        title: `Your secrets file "${path}" is committed to GitHub`,
        explanation:
          "Environment files usually hold passwords and API keys. Anyone with access to this repo, and anyone if it becomes public, can read them. Remove it from the repo, add it to .gitignore, and rotate every key it contained.",
        files: [path],
        line: null,
        fixPrompt: `The file ${path} is committed to git but contains secrets. Please: 1) add "${path.split("/").pop()}" and other .env variants (but not .env.example) to .gitignore, 2) remove ${path} from git tracking with "git rm --cached ${path}" without deleting my local copy, 3) create a ${path}.example with the same variable names but empty values. Then remind me to rotate every key that was in the file, because it is already in git history.`,
      });
    }
  }

  // 2. Hardcoded secrets
  for (const file of snapshot.files) {
    if (isExampleFile(file.path)) continue;
    for (const pattern of SECRET_PATTERNS) {
      const match = pattern.regex.exec(file.content);
      if (!match) continue;
      add({
        id: `${pattern.id}-${file.path}`,
        severity: "critical",
        category: "security",
        title: `A ${pattern.name} is written directly in ${file.path}`,
        explanation: `This key is visible to anyone who can see the code${
          /^(src|public|app|pages|components)\//.test(file.path) ? ", and because it is in frontend code it is also sent to every visitor's browser" : ""
        }. Someone could use it to run up bills or access your data. Move it to a server-side environment variable and rotate the key.`,
        files: [file.path],
        line: lineOf(file.content, match.index),
        fixPrompt: `In ${file.path} around line ${lineOf(file.content, match.index)} there is a hardcoded ${pattern.name}. Please remove it from the code and read it from an environment variable instead. If this code runs in the browser, move the call that needs the key into a server-side function/API route so the key never reaches the client. Add the variable name to .env.example with an empty value. Then remind me to rotate the old key since it is in git history.`,
      });
    }
  }

  // 3. Firebase rules that allow everything
  for (const file of snapshot.files) {
    if (!/(^|\/)(firestore|storage|database)\.rules$/.test(file.path) && !/(^|\/)database\.rules\.json$/.test(file.path)) {
      continue;
    }
    const open =
      /allow\s+(read|write|read\s*,\s*write|write\s*,\s*read)\s*(:\s*if\s+true\s*;|;)/.exec(file.content) ??
      /"\.(read|write)"\s*:\s*true/.exec(file.content);
    if (open) {
      add({
        id: `open-rules-${file.path}`,
        severity: "critical",
        category: "data",
        title: `Your database rules in ${file.path} let anyone read or change data`,
        explanation:
          "A rule allows access with no login or ownership check. Anyone on the internet can read, change or delete this data using your public Firebase config.",
        files: [file.path],
        line: lineOf(file.content, open.index),
        fixPrompt: `My Firebase rules file ${file.path} has a rule at line ${lineOf(file.content, open.index)} that allows access to everyone ("${open[0].trim()}"). Rewrite the rules so that users must be signed in (request.auth != null) and can only read/write their own documents (compare request.auth.uid to the document's owner field or path). Keep any data that is intentionally public read-only. Explain each rule you write.`,
      });
    }
  }

  // 4. Supabase RLS disabled
  for (const file of snapshot.files) {
    if (!file.path.endsWith(".sql")) continue;
    const m = /disable\s+row\s+level\s+security/i.exec(file.content);
    if (m) {
      add({
        id: `rls-disabled-${file.path}`,
        severity: "critical",
        category: "data",
        title: `Row Level Security is turned off in ${file.path}`,
        explanation:
          "Without Row Level Security, anyone with your public Supabase key can read and change every row in that table.",
        files: [file.path],
        line: lineOf(file.content, m.index),
        fixPrompt: `In ${file.path} line ${lineOf(file.content, m.index)} Row Level Security is disabled. Write a new migration that enables RLS on that table and adds policies so users can only select/insert/update/delete their own rows (auth.uid() = user_id). Do not edit old migrations.`,
      });
    }
  }

  // 5. No .gitignore
  if (!snapshot.allPaths.includes(".gitignore")) {
    add({
      id: "missing-gitignore",
      severity: "warning",
      category: "config",
      title: "There is no .gitignore file",
      explanation:
        "Without a .gitignore it is easy to accidentally commit secrets (.env files), build output or node_modules.",
      files: [".gitignore"],
      line: null,
      fixPrompt:
        "Create a .gitignore for this project that ignores node_modules, build output folders (dist, build, .next), .env and .env.* (but not .env.example), logs, and OS files like .DS_Store.",
    });
  }

  return issues;
}
