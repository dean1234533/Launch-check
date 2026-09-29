import { z } from "zod";

export const SeveritySchema = z.enum(["critical", "warning"]);

export const IssueSchema = z.object({
  id: z.string().describe("Short unique slug for this issue, e.g. 'exposed-stripe-key'"),
  severity: SeveritySchema.describe(
    "critical = must fix before launch (security hole, data leak, crash, broken payments). warning = should fix soon.",
  ),
  category: z.enum(["security", "bug", "data", "payments", "config", "performance"]),
  title: z.string().describe("Plain-English one-line summary a non-expert understands"),
  explanation: z
    .string()
    .describe("2-4 sentences: what is wrong, why it matters, what could happen. No jargon."),
  files: z.array(z.string()).describe("Repo-relative paths involved; the first one is the main location"),
  line: z.number().int().nullable().describe("1-indexed line in the first file, or null if not applicable"),
  fixPrompt: z
    .string()
    .describe(
      "A self-contained prompt the user can paste into an AI coding tool (Cursor, Lovable, Claude, ChatGPT) to fix this. Name the files, describe the exact change, and say how to verify it.",
    ),
});

export type Issue = z.infer<typeof IssueSchema>;

export interface RepoFile {
  path: string;
  content: string;
}

export interface RepoSnapshot {
  owner: string;
  repo: string;
  branch: string;
  commitSha: string;
  files: RepoFile[];
  /** Every path in the repo, including ones we did not download. */
  allPaths: string[];
  truncated: boolean;
}

export interface ScanResult {
  owner: string;
  repo: string;
  branch: string;
  commitSha: string;
  scannedFiles: number;
  truncated: boolean;
  issues: Issue[];
  summary: string;
  /** Saved scan id, so the report can be reopened from history. */
  scanId?: number;
  /** Problems the previous scan on this branch reported that this one no longer does. */
  resolved?: Array<{ id: string; title: string; severity: "critical" | "warning" }>;
}
