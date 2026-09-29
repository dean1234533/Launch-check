import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { toAiUsage, type AiUsage } from "./cost.js";
import { IssueSchema, type Issue, type RepoFile, type RepoSnapshot } from "./types.js";

// Sonnet is half the price of Opus; set AI_MODEL=claude-opus-5-5 to trade cost for a deeper review.
const MODEL = process.env.AI_MODEL || "claude-sonnet-5-5";
// How hard the model thinks. "medium" is the cost-saving default; raise to "high" for a deeper (pricier) review.
const EFFORT = (["low", "medium", "high", "xhigh", "max"] as const).find((e) => e === process.env.AI_EFFORT) ?? "medium";
// Server-side fallback: if the model declines a request, the API retries it on a
// suitable fallback model inside the same call.
const BETAS: Anthropic.Beta.AnthropicBeta[] = ["server-side-fallback-2026-07-01"];

const client = new Anthropic();

export class AiRefusalError extends Error {}

function renderFiles(files: RepoFile[]): string {
  return files
    .map((f) => {
      const numbered = f.content
        .split("\n")
        .map((line, i) => `${i + 1}\t${line}`)
        .join("\n");
      return `<file path="${f.path}">\n${numbered}\n</file>`;
    })
    .join("\n\n");
}

const REVIEW_SYSTEM = `You review code for people who are about to launch an app to real users. Many of them built the app with AI tools and are not experienced developers.

Find problems that would hurt them or their users in production: security holes, exposed secrets, missing authentication or authorization checks, database rules that let anyone read or write data, payment and webhook bugs, crashes and unhandled errors on important paths, broken builds, and data loss.

Rules:
- Report only real problems you can point to in the code you were given. Do not guess about files you cannot see. Precision matters more than volume: a false alarm costs the user time and trust.
- Skip style, formatting, naming and minor refactors.
- "critical" means it must be fixed before launch. "warning" means it should be fixed soon.
- Write titles and explanations in plain English for a non-expert.
- Each fixPrompt must be self-contained so it can be pasted into another AI coding tool with no other context: name the files, the exact change, and how to check it worked.
- Some issues have already been found by automated checks and are listed for you. Do not report them again.`;

const ReviewSchema = z.object({
  summary: z.string().describe("2-3 sentence plain-English verdict on whether this is ready to launch"),
  issues: z.array(IssueSchema),
});

export async function reviewRepo(
  snapshot: RepoSnapshot,
  alreadyFound: Issue[],
): Promise<{ summary: string; issues: Issue[]; usage: AiUsage }> {
  const fileList = snapshot.allPaths.slice(0, 3000).join("\n");
  const known = alreadyFound.map((i) => `- ${i.title} (${i.files.join(", ")})`).join("\n") || "(none)";

  const response = await client.beta.messages.parse({
    model: MODEL,
    max_tokens: 32000,
    betas: BETAS,
    fallbacks: "default",
    thinking: { type: "adaptive" },
    output_config: { effort: EFFORT, format: betaZodOutputFormat(ReviewSchema) },
    system: [{ type: "text", text: REVIEW_SYSTEM, cache_control: { type: "ephemeral" } }],
    messages: [
      {
        role: "user",
        content: `Repository: ${snapshot.owner}/${snapshot.repo} (branch ${snapshot.branch})

All files in the repository:
<file_list>
${fileList}
</file_list>

Source of the files most likely to matter${snapshot.truncated ? " (some files were left out to fit the size limit)" : ""}:
${renderFiles(snapshot.files)}

Already found by automated checks:
${known}

Review the code and report the launch-blocking and important problems.`,
      },
    ],
  });

  if (response.stop_reason === "refusal") throw new AiRefusalError("The AI declined to review this repository.");
  if (!response.parsed_output) throw new Error(`AI review returned no result (stop_reason: ${response.stop_reason})`);
  return { ...response.parsed_output, usage: toAiUsage(MODEL, response.usage) };
}

const FixSchema = z.object({
  changes: z
    .array(
      z.object({
        path: z.string().describe("Repo-relative path"),
        action: z.enum(["write", "delete"]),
        content: z.string().describe("The complete new file content for 'write'. Empty string for 'delete'."),
      }),
    )
    .describe("Every file to create, overwrite or delete"),
  prTitle: z.string().describe("Short pull request title, e.g. 'Fix: move Stripe key to server'"),
  prBody: z
    .string()
    .describe("Markdown: what was wrong, what changed, and any manual step the user must still do (e.g. rotate a key, set an env var)"),
  manualSteps: z.array(z.string()).describe("Steps the code change cannot do, e.g. 'Rotate the Stripe key in the dashboard'"),
});

export type FixPlan = z.infer<typeof FixSchema>;

const FIX_SYSTEM = `You fix one specific problem in a codebase. Your change will be opened as a pull request that the owner reviews before merging.

Rules:
- Make the smallest change that fully fixes the problem. Do not refactor, reformat or change unrelated code.
- Match the existing code style, language and frameworks.
- For each file you change, return the COMPLETE new content of the file, not a diff or a snippet.
- Never put real secret values in code. Use environment variables and add placeholders to an example env file.
- If part of the fix cannot be done in code (rotating a leaked key, setting a hosting env var), list it in manualSteps.
- If the problem is not real, or you cannot fix it safely with the files you were given, return no changes and explain why in prBody.`;

export async function planFix(
  issue: Issue,
  files: RepoFile[],
  allPaths: string[],
): Promise<{ plan: FixPlan; usage: AiUsage }> {
  const stream = client.beta.messages.stream({
    model: MODEL,
    max_tokens: 64000,
    betas: BETAS,
    fallbacks: "default",
    thinking: { type: "adaptive" },
    output_config: { effort: EFFORT, format: betaZodOutputFormat(FixSchema) },
    system: FIX_SYSTEM,
    messages: [
      {
        role: "user",
        content: `Problem to fix:
Title: ${issue.title}
Severity: ${issue.severity}
Details: ${issue.explanation}
Files: ${issue.files.join(", ")}${issue.line ? ` (line ${issue.line})` : ""}
Instructions: ${issue.fixPrompt}

All files in the repository:
<file_list>
${allPaths.slice(0, 3000).join("\n")}
</file_list>

Current content of the relevant files (line numbers are for reference only, do not include them in your output):
${renderFiles(files) || "(these files do not exist yet)"}`,
      },
    ],
  });
  const response = await stream.finalMessage();

  if (response.stop_reason === "refusal") throw new AiRefusalError("The AI declined to generate this fix.");
  if (response.stop_reason === "max_tokens") throw new Error("The fix was too large to generate in one go.");
  const text = response.content.find((b) => b.type === "text");
  if (!text || text.type !== "text") throw new Error("AI fix returned no result.");
  return { plan: FixSchema.parse(JSON.parse(text.text)), usage: toAiUsage(MODEL, response.usage) };
}
