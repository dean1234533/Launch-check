import { Hono, type Context } from "hono";
import { bodyLimit } from "hono/body-limit";
import { cors } from "hono/cors";
import type { ContentfulStatusCode } from "hono/utils/http-status";
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

const MAX_BODY = 1024 * 1024;

async function jsonBody(c: Context): Promise<unknown> {
  try {
    return await c.req.json();
  } catch {
    throw new HttpError(400, "The request body must be valid JSON.");
  }
}

export function createApp({ db, config, stripe, resolveUser = resolveGithubUser }: AppDeps) {
  const app = new Hono();
  const authenticate = makeAuthenticator(db, resolveUser);

  // Per-account sliding window, kept in memory (one Durable Object serves everything, so one map is enough).
  const recentStarts = new Map<number, number[]>();
  function rateLimit(githubId: number, now = Date.now()): void {
    const recent = (recentStarts.get(githubId) ?? []).filter((at) => now - at < 60 * 60 * 1000);
    if (recent.length >= config.rateLimitPerHour) {
      throw new HttpError(429, "You've started a lot of scans and fixes in the last hour. Please wait a little and try again.", "rate_limited");
    }
    recent.push(now);
    recentStarts.set(githubId, recent);
    if (recentStarts.size > 5000) recentStarts.delete(recentStarts.keys().next().value!);
  }

  app.use(
    "*",
    cors({
      origin(origin) {
        if (!origin) return null; // curl, Stripe webhooks, browser page loads need no CORS headers
        const allowed = config.allowedOrigins.length ? config.allowedOrigins.includes(origin) : origin.startsWith("chrome-extension://");
        return allowed ? origin : null;
      },
    }),
  );
  app.use("*", bodyLimit({ maxSize: MAX_BODY, onError: (c) => c.json({ error: "Request body too large." }, 413) }));

  // Stripe signs the raw request body, so it is read as text and never parsed before verification.
  app.post("/webhooks/stripe", async (c) => {
    if (!stripe || !config.stripe) return c.text("Billing is not configured", 503);
    let event: Stripe.Event;
    try {
      event = await stripe.webhooks.constructEventAsync(await c.req.text(), c.req.header("stripe-signature") ?? "", config.stripe.webhookSecret);
    } catch {
      return c.text("Invalid signature", 400);
    }
    try {
      applyStripeEvent(db, event);
      return c.json({ received: true });
    } catch (err) {
      console.error("Stripe webhook failed", event.type, err);
      return c.text("Webhook handler failed", 500); // Stripe retries with backoff
    }
  });

  app.get("/health", (c) => c.json({ ok: true }));

  // Where Stripe sends people after checkout / the billing portal. The extension refreshes itself when the user returns to it.
  app.get("/billing/success", (c) =>
    c.html(PAGE("You're on Pro 🎉", "Thanks for upgrading. Go back to the Quick Scan First tab; it will update in a moment. You can close this tab.")),
  );
  app.get("/billing/credits-success", (c) =>
    c.html(PAGE("Credits added 🎉", "Thanks for your purchase. Go back to the Quick Scan First tab; your credits will show in a moment. You can close this tab.")),
  );
  app.get("/billing/cancel", (c) => c.html(PAGE("No charge made", "Checkout was cancelled. You can close this tab and upgrade any time from Quick Scan First.")));
  app.get("/billing/return", (c) => c.html(PAGE("All set", "Your billing changes are saved. You can close this tab and go back to Quick Scan First.")));

  app.get("/api/me", async (c) => {
    const { user } = await authenticate(c.req.header("authorization"));
    return c.json({ ...accountSummary(db, config, user, Boolean(stripe)), packs: await listPacks(stripe, config) });
  });

  app.post("/api/billing/checkout", async (c) => {
    const { user } = await authenticate(c.req.header("authorization"));
    if (!stripe) throw new BillingError(503, "Billing isn't set up on this server.");
    return c.json({ url: await createCheckoutUrl(stripe, db, config, user) });
  });

  app.post("/api/billing/credits", async (c) => {
    const { user } = await authenticate(c.req.header("authorization"));
    if (!stripe) throw new BillingError(503, "Billing isn't set up on this server.");
    const { pack } = z.object({ pack: z.string().max(100) }).parse(await jsonBody(c));
    return c.json({ url: await createCreditCheckoutUrl(stripe, db, config, user, pack) });
  });

  app.post("/api/billing/portal", async (c) => {
    const { user } = await authenticate(c.req.header("authorization"));
    if (!stripe) throw new BillingError(503, "Billing isn't set up on this server.");
    return c.json({ url: await createPortalUrl(stripe, config, user) });
  });

  app.get("/api/history", async (c) => {
    const { user } = await authenticate(c.req.header("authorization"));
    const { owner, repo } = z.object({ owner: RepoName, repo: RepoName }).parse(c.req.query());
    return c.json({ scans: listScans(db, user.githubId, owner, repo) });
  });

  app.get("/api/scans/:id", async (c) => {
    const { user } = await authenticate(c.req.header("authorization"));
    const scan = getScan(db, user.githubId, z.coerce.number().int().positive().parse(c.req.param("id")));
    if (!scan) throw new HttpError(404, "Scan not found.");
    return c.json(scan);
  });

  app.post("/api/scan", async (c) => {
    let refund: (() => void) | undefined;
    try {
      const { user, token } = await authenticate(c.req.header("authorization"));
      rateLimit(user.githubId);
      const body = ScanBody.parse(await jsonBody(c));
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
      return c.json({ ...result, account: accountSummary(db, config, user, Boolean(stripe)) });
    } catch (err) {
      refund?.();
      throw err;
    }
  });

  app.post("/api/fix", async (c) => {
    let refund: (() => void) | undefined;
    try {
      const { user, token } = await authenticate(c.req.header("authorization"));
      rateLimit(user.githubId);
      const { owner, repo, branch, issue: requested } = FixBody.parse(await jsonBody(c));
      // Only problems from this account's own latest scan can be fixed, and the stored version is used, not whatever the client sent.
      const issue = latestScan(db, user.githubId, owner, repo, branch)?.result.issues.find((i) => i.id === requested.id);
      if (!issue) throw new HttpError(400, "That problem isn't in your latest scan of this repository. Scan again, then try the fix.", "scan_required");
      const reservation = reserve(db, config, user, "fixes");
      refund = reservation.refund;
      const octokit = githubClient(token);

      const snapshot = await fetchSnapshot(octokit, owner, repo, 0, branch); // tree only, no file bodies
      const relevant = issue.files.filter(safePath).slice(0, 10);
      const files = await fetchFiles(octokit, owner, repo, branch, relevant);

      const { plan, usage } = await planFix(issue, files, snapshot.allPaths);
      recordAiCall(db, user.githubId, "fixes", usage);
      const changes: FileChange[] = plan.changes
        .filter((ch) => safePath(ch.path))
        .map((ch) => ({ path: ch.path, content: ch.action === "delete" ? null : ch.content }));

      if (changes.length === 0) {
        // No refund: the AI ran and cost money even though it made no change.
        return c.json({ status: "no_changes", message: plan.prBody, manualSteps: plan.manualSteps });
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
        body: `${plan.prBody}${manual}\n\n---\n_Opened by Quick Scan First. Review the changes before merging._`,
        changes,
      });
      return c.json({ status: "pr_opened", pullRequestUrl: pr.url, number: pr.number, manualSteps: plan.manualSteps });
    } catch (err) {
      refund?.();
      throw err;
    }
  });

  app.notFound((c) => c.json({ error: "Not found." }, 404));

  app.onError((err, c) => {
    const reply = (body: Record<string, unknown>, status: number) => c.json(body, status as ContentfulStatusCode);
    if (err instanceof z.ZodError) return reply({ error: "Invalid request", details: err.issues }, 400);
    if (err instanceof QuotaError) return reply({ error: err.message, code: err.code }, err.status);
    if (err instanceof HttpError) return reply({ error: err.message, code: err.code }, err.status);
    if (err instanceof BillingError) return reply({ error: err.message }, err.status);
    if (err instanceof AiRefusalError) return reply({ error: err.message }, 422);
    const status = (err as { status?: number }).status;
    const stripeError = (err as { type?: string }).type?.startsWith("Stripe");
    if (stripeError) {
      console.error(err);
      return reply({ error: "Payment provider error. Please try again in a moment." }, 502);
    }
    if (status === 401) return reply({ error: "GitHub rejected the token. Check it in the extension settings." }, 401);
    if (status === 403 || status === 404) {
      return reply({ error: "Can't access that repository with this token. Check the token's repository access and permissions." }, status);
    }
    console.error(err);
    return reply({ error: "Something went wrong. Please try again." }, 500);
  });

  return app;
}
