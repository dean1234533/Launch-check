import express, { type NextFunction, type Request, type Response } from "express";
import cors from "cors";
import { createHash } from "node:crypto";
import { z } from "zod";
import { AiRefusalError, planFix, reviewRepo } from "./ai.js";
import { fetchFiles, fetchSnapshot, githubClient, openFixPullRequest, type FileChange } from "./github.js";
import { runStaticChecks } from "./staticChecks.js";
import { IssueSchema, type Issue, type ScanResult } from "./types.js";

const PORT = Number(process.env.PORT ?? 8787);
const MAX_SCAN_CHARS = Number(process.env.MAX_SCAN_CHARS ?? 400_000);
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const app = express();
app.use(express.json({ limit: "1mb" }));
app.use(
  cors({
    origin(origin, cb) {
      if (!origin) return cb(null, true); // curl / server-to-server
      const allowed = ALLOWED_ORIGINS.length
        ? ALLOWED_ORIGINS.includes(origin)
        : origin.startsWith("chrome-extension://");
      cb(allowed ? null : new Error("Origin not allowed"), allowed);
    },
  }),
);

// --- auth: the extension passes the user's GitHub token; we never store it ---
function githubToken(req: Request): string {
  const header = req.header("authorization") ?? "";
  const token = header.replace(/^Bearer\s+/i, "").trim();
  if (!token) throw new HttpError(401, "Missing GitHub token. Add one in the extension settings.");
  return token;
}

// --- very small in-memory rate limit per token (replace with real plan limits + Stripe) ---
const usage = new Map<string, { windowStart: number; scans: number; fixes: number }>();
const LIMITS = { scans: 10, fixes: 30, windowMs: 24 * 60 * 60 * 1000 };
function consume(token: string, kind: "scans" | "fixes") {
  const key = createHash("sha256").update(token).digest("hex");
  const now = Date.now();
  let entry = usage.get(key);
  if (!entry || now - entry.windowStart > LIMITS.windowMs) {
    entry = { windowStart: now, scans: 0, fixes: 0 };
    usage.set(key, entry);
  }
  if (entry[kind] >= LIMITS[kind]) {
    throw new HttpError(429, `Daily ${kind === "scans" ? "scan" : "fix"} limit reached. Try again tomorrow.`);
  }
  entry[kind]++;
  // Call on failure so errors don't use up the user's allowance.
  return () => {
    entry[kind]--;
  };
}

class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

const RepoName = z.string().regex(/^[A-Za-z0-9_.-]{1,100}$/);

const ScanBody = z.object({ owner: RepoName, repo: RepoName, branch: z.string().max(255).optional() });

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.post("/api/scan", async (req, res, next) => {
  let refund: (() => void) | undefined;
  try {
    const token = githubToken(req);
    const body = ScanBody.parse(req.body);
    refund = consume(token, "scans");
    const octokit = githubClient(token);

    const snapshot = await fetchSnapshot(octokit, body.owner, body.repo, MAX_SCAN_CHARS, body.branch);
    const staticIssues = runStaticChecks(snapshot);
    const ai = await reviewRepo(snapshot, staticIssues);

    const issues: Issue[] = [...staticIssues, ...ai.issues].sort(
      (a, b) => Number(b.severity === "critical") - Number(a.severity === "critical"),
    );
    const result: ScanResult = {
      owner: snapshot.owner,
      repo: snapshot.repo,
      branch: snapshot.branch,
      commitSha: snapshot.commitSha,
      scannedFiles: snapshot.files.length,
      truncated: snapshot.truncated,
      issues,
      summary: ai.summary,
    };
    res.json(result);
  } catch (err) {
    refund?.();
    next(err);
  }
});

const FixBody = z.object({
  owner: RepoName,
  repo: RepoName,
  branch: z.string().max(255),
  issue: IssueSchema,
});

/** Rejects paths the AI should never touch. */
function safePath(path: string): boolean {
  return (
    path.length > 0 &&
    !path.startsWith("/") &&
    !path.split("/").some((seg) => seg === ".." || seg === ".git") &&
    !path.startsWith(".github/workflows/")
  );
}

app.post("/api/fix", async (req, res, next) => {
  let refund: (() => void) | undefined;
  try {
    const token = githubToken(req);
    const { owner, repo, branch, issue } = FixBody.parse(req.body);
    refund = consume(token, "fixes");
    const octokit = githubClient(token);

    const snapshot = await fetchSnapshot(octokit, owner, repo, 0, branch); // tree only, no file bodies
    const relevant = issue.files.filter(safePath).slice(0, 10);
    const files = await fetchFiles(octokit, owner, repo, branch, relevant);

    const plan = await planFix(issue, files, snapshot.allPaths);
    const changes: FileChange[] = plan.changes
      .filter((c) => safePath(c.path))
      .map((c) => ({ path: c.path, content: c.action === "delete" ? null : c.content }));

    if (changes.length === 0) {
      res.json({ status: "no_changes", message: plan.prBody, manualSteps: plan.manualSteps });
      return;
    }

    const manual = plan.manualSteps.length
      ? `\n\n### Still to do by hand\n${plan.manualSteps.map((s) => `- [ ] ${s}`).join("\n")}`
      : "";
    const pr = await openFixPullRequest(octokit, {
      owner,
      repo,
      baseBranch: branch,
      branchName: `launch-check/${issue.id.replace(/[^A-Za-z0-9_-]/g, "-").slice(0, 40)}`,
      commitMessage: plan.prTitle,
      title: plan.prTitle,
      body: `${plan.prBody}${manual}\n\n---\n_Opened by Launch Check. Review the changes before merging._`,
      changes,
    });
    res.json({ status: "pr_opened", pullRequestUrl: pr.url, number: pr.number, manualSteps: plan.manualSteps });
  } catch (err) {
    refund?.();
    next(err);
  }
});

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof z.ZodError) {
    res.status(400).json({ error: "Invalid request", details: err.issues });
    return;
  }
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.message });
    return;
  }
  if (err instanceof AiRefusalError) {
    res.status(422).json({ error: err.message });
    return;
  }
  const status = (err as { status?: number }).status;
  if (status === 401) {
    res.status(401).json({ error: "GitHub rejected the token. Check it in the extension settings." });
    return;
  }
  if (status === 403 || status === 404) {
    res.status(status).json({ error: "Can't access that repository with this token. Check the token's repository access and permissions." });
    return;
  }
  console.error(err);
  res.status(500).json({ error: "Something went wrong. Please try again." });
});

app.listen(PORT, () => {
  console.log(`Launch Check API listening on http://localhost:${PORT}`);
});
