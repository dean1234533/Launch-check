import { Octokit } from "@octokit/rest";
import type { RepoFile, RepoSnapshot } from "./types.js";

const SKIP_DIRS = /(^|\/)(node_modules|dist|build|out|\.next|\.nuxt|\.git|vendor|coverage|\.turbo|\.vercel|\.cache)\//;
const SKIP_FILES = /(package-lock\.json|yarn\.lock|pnpm-lock\.yaml|bun\.lockb|\.min\.(js|css)|\.map)$/;
const TEXT_EXT =
  /\.(ts|tsx|js|jsx|mjs|cjs|vue|svelte|astro|py|rb|go|rs|java|kt|php|cs|swift|sql|rules|json|ya?ml|toml|html|css|scss|sh|prisma|graphql|gql|md|env|ini|conf)$|(^|\/)(Dockerfile|\.env[^/]*|\.gitignore|firebase\.json|vercel\.json|netlify\.toml)$/;
const MAX_FILE_BYTES = 120_000;

/** Higher = more likely to contain launch-blocking problems, so fetched first. */
function priority(path: string): number {
  if (/\.rules$|rules\.json$|\.sql$|prisma$/.test(path)) return 100;
  if (/(^|\/)\.env|firebase\.json|vercel\.json|netlify\.toml|Dockerfile/.test(path)) return 90;
  if (/(api|server|functions|backend|routes|middleware|auth|payment|stripe|checkout|webhook)/i.test(path)) return 80;
  if (/(^|\/)(package\.json|tsconfig\.json)$/.test(path)) return 70;
  if (/\.(ts|tsx|js|jsx|py|go|rb|php|vue|svelte)$/.test(path)) return 50;
  if (/\.md$/.test(path)) return 5;
  return 20;
}

export function githubClient(token: string): Octokit {
  return new Octokit({ auth: token, userAgent: "launch-check/0.1" });
}

async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i]);
    }
  });
  await Promise.all(workers);
  return results;
}

export async function fetchSnapshot(
  octokit: Octokit,
  owner: string,
  repo: string,
  maxChars: number,
  branch?: string,
): Promise<RepoSnapshot> {
  const { data: repoInfo } = await octokit.repos.get({ owner, repo });
  const ref = branch ?? repoInfo.default_branch;
  const { data: branchInfo } = await octokit.repos.getBranch({ owner, repo, branch: ref });
  const commitSha = branchInfo.commit.sha;
  const { data: tree } = await octokit.git.getTree({ owner, repo, tree_sha: commitSha, recursive: "true" });

  const blobs = tree.tree.filter((e) => e.type === "blob" && e.path && e.sha);
  const allPaths = blobs.map((e) => e.path!);

  const candidates = blobs
    .filter((e) => !SKIP_DIRS.test(e.path!) && !SKIP_FILES.test(e.path!) && TEXT_EXT.test(e.path!))
    .filter((e) => (e.size ?? 0) <= MAX_FILE_BYTES)
    .sort((a, b) => priority(b.path!) - priority(a.path!) || (a.size ?? 0) - (b.size ?? 0));

  // Pick files until the character budget is used up (size in bytes ~ chars for source code).
  const picked: typeof candidates = [];
  let budget = maxChars;
  for (const entry of candidates) {
    const size = entry.size ?? 0;
    if (size > budget) continue;
    picked.push(entry);
    budget -= size;
  }

  const files = await mapLimit(picked, 8, async (entry): Promise<RepoFile> => {
    const { data } = await octokit.git.getBlob({ owner, repo, file_sha: entry.sha! });
    return { path: entry.path!, content: Buffer.from(data.content, "base64").toString("utf8") };
  });

  return {
    owner,
    repo,
    branch: ref,
    commitSha,
    files,
    allPaths,
    truncated: tree.truncated || picked.length < candidates.length,
  };
}

export async function fetchFiles(
  octokit: Octokit,
  owner: string,
  repo: string,
  ref: string,
  paths: string[],
): Promise<RepoFile[]> {
  const out: RepoFile[] = [];
  for (const path of paths) {
    try {
      const { data } = await octokit.repos.getContent({ owner, repo, path, ref });
      if (!Array.isArray(data) && data.type === "file" && "content" in data) {
        out.push({ path, content: Buffer.from(data.content, "base64").toString("utf8") });
      }
    } catch (err: unknown) {
      // A 404 means the file does not exist yet (e.g. a missing .gitignore) - the fix may create it.
      if ((err as { status?: number }).status !== 404) throw err;
    }
  }
  return out;
}

export interface FileChange {
  path: string;
  /** New full content, or null to delete the file. */
  content: string | null;
}

/** Creates a branch with one commit containing `changes` and opens a pull request. */
export async function openFixPullRequest(
  octokit: Octokit,
  opts: {
    owner: string;
    repo: string;
    baseBranch: string;
    branchName: string;
    commitMessage: string;
    title: string;
    body: string;
    changes: FileChange[];
  },
): Promise<{ url: string; number: number }> {
  const { owner, repo } = opts;
  const { data: baseRef } = await octokit.git.getRef({ owner, repo, ref: `heads/${opts.baseBranch}` });
  const baseSha = baseRef.object.sha;
  const { data: baseCommit } = await octokit.git.getCommit({ owner, repo, commit_sha: baseSha });

  const { data: tree } = await octokit.git.createTree({
    owner,
    repo,
    base_tree: baseCommit.tree.sha,
    tree: opts.changes.map((c) =>
      c.content === null
        ? { path: c.path, mode: "100644" as const, type: "blob" as const, sha: null }
        : { path: c.path, mode: "100644" as const, type: "blob" as const, content: c.content },
    ),
  });
  const { data: commit } = await octokit.git.createCommit({
    owner,
    repo,
    message: opts.commitMessage,
    tree: tree.sha,
    parents: [baseSha],
  });

  // Unique branch name so re-running a fix never collides with an earlier one.
  const branch = `${opts.branchName}-${commit.sha.slice(0, 7)}`;
  await octokit.git.createRef({ owner, repo, ref: `refs/heads/${branch}`, sha: commit.sha });

  const { data: pr } = await octokit.pulls.create({
    owner,
    repo,
    head: branch,
    base: opts.baseBranch,
    title: opts.title,
    body: opts.body,
  });
  return { url: pr.html_url, number: pr.number };
}
