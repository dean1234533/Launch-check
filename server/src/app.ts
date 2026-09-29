import express, { type NextFunction, type Request, type Response } from "express";
import cors from "cors";
import type Stripe from "stripe";
import { z } from "zod";
import { AiRefusalError, planFix, reviewRepo } from "./ai.js";
import { makeAuthenticator, HttpError, resolveGithubUser, type ResolveGithubUser } from "./auth.js";
import { applyStripeEvent, BillingError, createCheckoutUrl, createCreditCheckoutUrl, createPortalUrl, listPacks } from "./billing.js";
import type { Config } from "./config.js";
import type { Db } from "./db.js";
import { fetchFiles, fetchSnapshot, githubClient, openFixPullRequest, type FileChange } from "./github.js";
import { checkDependencies, parseLockfile } from "./osv.js";
import { accountSummary, QuotaError, recordAiCall, reserve } from "./plans.js";
import { getScan, latestScan, listScans, resolvedSince, saveScan } from "./scans.js";
import { runStaticChecks } from "./staticChecks.js";
import { IssueSchema, type Issue, type ScanResult } from "./types.js";

export interface AppDeps {
  db: Db;
  config: Config;
  /** null when Stripe isn't configured (local development). */
  stripe: Stripe | null;
  resolveUser?: ResolveGithubUser;
}

const RepoName = z.string().regex(/^[A-Za-z0-9_.-]{1,100}$/);
const ScanBody = z.object({ owner: RepoName, repo: RepoName, branch: z.string().max(255).optional() });
const FixBody = z.object({ owner: RepoName, repo: RepoName, branch: z.string().max(255), issue: IssueSchema });

/** Rejects paths the AI should never touch. */
function safePath(path: string): boolean {
  return (
    path.length > 0 &&
    !path.startsWith("/") &&
    !path.split("/").some((seg) => seg === ".." || seg === ".git") &&
    !path.startsWith(".github/workflows/")
  );
}

const PAGE = (title: string, body: string) => `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><title>${title}</title>
<style>body{font:16px/1.5 system-ui,sans-serif;max-width:480px;margin:15vh auto;padding:0 20px;text-align:center;color:#1a1a1a}
@media(prefers-color-scheme:dark){body{background:#111;color:#eee}}</style></head>
<body><h1>${title}</h1><p>${body}</p></body></html>`;

export function createApp({ db, config, stripe, resolveUser = resolveGithubUser }: AppDeps) {
  const app = express();
  const authenticate = makeAuthenticator(db, resolveUser);

  app.use(
    cors({
      origin(origin, cb) {
        if (!origin) return cb(null, true); // curl, Stripe webhooks, browser page loads
        const allowed = config.allowedOrigins.length
          ? config.allowedOrigins.includes(origin)
          : origin.startsWith("chrome-extension://");
        cb(allowed ? null : new Error("Origin not allowed"), allowed);
      },
    }),
  );

  // Stripe signs the raw request body, so this route must be registered before express.json().
  app.post("/webhooks/stripe", express.raw({ type: "application/json", limit: "1mb" }), (req, res) => {
    if (!stripe || !config.stripe) {
      res.status(503).send("Billing is not configured");
      return;
    }
    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(req.body, req.header("stripe-signature") ?? "", config.stripe.webhookSecret);
    } catch {
      res.status(400).send("Invalid signature");
      return;
    }
    try {
      applyStripeEvent(db, event);
      res.json({ received: true });
    } catch (err) {
      console.error("Stripe webhook failed", event.type, err);
      res.status(500).send("Webhook handler failed"); // Stripe retries with backoff
    }
  });

  app.use(express.json({ limit: "1mb" }));

  app.get("/health", (_req, res) => {
    res.json({ ok: true });
  });

  // Where Stripe sends people after checkout / the billing portal. The extension refreshes itself when the user returns to it.
  app.get("/billing/success", (_req, res) => {
    res.type("html").send(PAGE("You're on Pro 🎉", "Thanks for upgrading. Go back to the Launch Check tab; it will update in a moment. You can close this tab."));
  });
  app.get("/billing/cancel", (_req, res) => {
    res.type("html").send(PAGE("No charge made", "Checkout was cancelled. You can close this tab and upgrade any time from Launch Check."));
  });
  app.get("/billing/return", (_req, res) => {
    res.type("html").send(PAGE("All set", "Your billing changes are saved. You can close this tab and go back to Launch Check."));
  });

  app.get("/api/me", async (req, res, next) => {
    try {
      const { user } = await authenticate(req);
      res.json({ ...accountSummary(db, config, user, Boolean(stripe)), packs: await listPacks(stripe, config) });
    } catch (err) {
      next(err);
    }
  });

  app.post("/api/billing/checkout", async (req, res, next) => {
    try {
      const { user } = await authenticate(req);
      if (!stripe) throw new BillingError(503, "Billing isn't set up on this server.");
      res.json({ url: await createCheckoutUrl(stripe, db, config, user) });
    } catch (err) {
      next(err);
    }
  });

  app.post("/api/billing/credits", async (req, res, next) => {
    try {
      const { user } = await authenticate(req);
      if (!stripe) throw new BillingError(503, "Billing isn't set up on this server.");
      const { pack } = z.object({ pack: z.string().max(100) }).parse(req.body);
      res.json({ url: await createCreditCheckoutUrl(stripe, db, config, user, pack) });
    } catch (err) {
      next(err);
    }
  });

  app.post("/api/billing/portal", async (req, res, next) => {
    try {
      const { user } = await authenticate(req);
      if (!stripe) throw new BillingError(503, "Billing isn't set up on this server.");
      res.json({ url: await createPortalUrl(stripe, config, user) });
    } catch (err) {
      next(err);
    }
  });

  app.get("/api/history", async (req, res, next) => {
    try {
      const { user } = await authenticate(req);
      const { owner, repo } = z.object({ owner: RepoName, repo: RepoName }).parse(req.query);
      res.json({ scans: listScans(db, user.githubId, owner, repo) });
    } catch (err) {
      next(err);
    }
  });

  app.get("/api/scans/:id", async (req, res, next) => {
    try {
      const { user } = await authenticate(req);
      const scan = getScan(db, user.githubId, z.coerce.number().int().positive().parse(req.params.id));
      if (!scan) throw new HttpError(404, "Scan not found.");
      res.json(scan);
    } catch (err) {
      next(err);
    }
  });

  app.post("/api/scan", async (req, res, next) => {
    let refund: (() => void) | undefined;
    try {
      const { user, token } = await authenticate(req);
      const body = ScanBody.parse(req.body);
      const reservation = reserve(db, config, user, "scans");
      refund = reservation.refund;
      const octokit = githubClient(token);

      const snapshot = await fetchSnapshot(octokit, body.owner, body.repo, config.maxScanChars, body.branch);
      const staticIssues = runStaticChecks(snapshot);

      // Dependency lookup is a bonus: if OSV or the lockfile is unavailable, the scan still completes.
      const depsIssue = snapshot.allPaths.includes("package-lock.json")
        ? await fetchFiles(octokit, snapshot.owner, snapshot.repo, snapshot.branch, ["package-lock.json"])
            .then(([lock]) => (lock ? checkDependencies(parseLockfile(lock.content)) : null))
            .catch((err) => {
              console.warn("Dependency check skipped:", err instanceof Error ? err.message : err);
              return null;
            })
        : null;
      const known = [...staticIssues, ...(depsIssue ? [depsIssue] : [])];

      // The AI review is what costs money: it needs a Pro allowance or credits (or FREE_AI_REVIEW=1 for development).
      const aiReview = reservation.aiReview;
      const ai = aiReview
        ? await reviewRepo(snapshot, known)
        : {
            summary: known.length
              ? `The built-in checks found ${known.length} ${known.length === 1 ? "problem" : "problems"}. Upgrade to Pro, or use credits, for the full AI code review, which also checks login and permission rules, payments, data leaks and crashes.`
              : "The built-in checks found no problems. Upgrade to Pro, or use credits, for the full AI code review, which also checks login and permission rules, payments, data leaks and crashes.",
            issues: [] as Issue[],
            usage: null,
          };
      if (ai.usage) recordAiCall(db, user.githubId, "scans", ai.usage);
      const issues: Issue[] = [...known, ...ai.issues].sort(
        (a, b) => Number(b.severity === "critical") - Number(a.severity === "critical"),
      );

      const previous = latestScan(db, user.githubId, snapshot.owner, snapshot.repo, snapshot.branch);
      const result: ScanResult = {
        owner: snapshot.owner,
        repo: snapshot.repo,
        branch: snapshot.branch,
        commitSha: snapshot.commitSha,
        scannedFiles: snapshot.files.length,
        truncated: snapshot.truncated,
        issues,
        summary: ai.summary,
        aiReview,
        resolved: previous ? resolvedSince(previous.result.issues, issues) : [],
      };
      result.scanId = saveScan(db, user.githubId, result);
      res.json({ ...result, account: accountSummary(db, config, user, Boolean(stripe)) });
    } catch (err) {
      refund?.();
      next(err);
    }
  });

  app.post("/api/fix", async (req, res, next) => {
    let refund: (() => void) | undefined;
    try {
      const { user, token } = await authenticate(req);
      const { owner, repo, branch, issue } = FixBody.parse(req.body);
      const reservation = reserve(db, config, user, "fixes");
      refund = reservation.refund;
      const octokit = githubClient(token);

      const snapshot = await fetchSnapshot(octokit, owner, repo, 0, branch); // tree only, no file bodies
      const relevant = issue.files.filter(safePath).slice(0, 10);
      const files = await fetchFiles(octokit, owner, repo, branch, relevant);

      const { plan, usage } = await planFix(issue, files, snapshot.allPaths);
      recordAiCall(db, user.githubId, "fixes", usage);
      const changes: FileChange[] = plan.changes
        .filter((c) => safePath(c.path))
        .map((c) => ({ path: c.path, content: c.action === "delete" ? null : c.content }));

      if (changes.length === 0) {
        // No refund: the AI ran and cost money even though it made no change.
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
    if (err instanceof QuotaError) {
      res.status(err.status).json({ error: err.message, code: err.code });
      return;
    }
    if (err instanceof HttpError) {
      res.status(err.status).json({ error: err.message, code: err.code });
      return;
    }
    if (err instanceof BillingError) {
      res.status(err.status).json({ error: err.message });
      return;
    }
    if (err instanceof AiRefusalError) {
      res.status(422).json({ error: err.message });
      return;
    }
    const status = (err as { status?: number }).status;
    const stripeError = (err as { type?: string }).type?.startsWith("Stripe");
    if (stripeError) {
      console.error(err);
      res.status(502).json({ error: "Payment provider error. Please try again in a moment." });
      return;
    }
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

  return app;
}
