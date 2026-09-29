import { estimateCostUsd, type AiUsage } from "./cost.js";
import type { Config } from "./config.js";
import { addCredits, creditBalance } from "./credits.js";
import type { Db } from "./db.js";
import type { User } from "./users.js";

export type Plan = "free" | "pro";
export type UsageKind = "scans" | "fixes";

const DAY = 24 * 60 * 60 * 1000;

/** Past-due subscriptions keep access while Stripe retries the payment. */
const ACTIVE_STATUSES = new Set(["active", "trialing", "past_due"]);

export function planOf(user: User): Plan {
  return user.subStatus && ACTIVE_STATUSES.has(user.subStatus) ? "pro" : "free";
}

/** Start of the window that usage is counted in. Free is lifetime; pro resets each billing period. */
function windowStart(user: User, now: number): number {
  if (planOf(user) === "free") return 0;
  return user.periodStart ?? now - 30 * DAY;
}

export function usageCounts(db: Db, user: User, now = Date.now()): Record<UsageKind, number> {
  const rows = db
    .prepare(
      `SELECT kind, COUNT(*) AS n FROM usage
       WHERE github_id = ? AND refunded = 0 AND created_at >= ? GROUP BY kind`,
    )
    .all(user.githubId, windowStart(user, now)) as { kind: UsageKind; n: number }[];
  const out = { scans: 0, fixes: 0 };
  for (const r of rows) out[r.kind] = r.n;
  return out;
}

export class QuotaError extends Error {
  constructor(
    public status: 402 | 429,
    public code: "upgrade_required" | "limit_reached",
    message: string,
  ) {
    super(message);
  }
}

export interface Reservation {
  /** Gives the allowance or credits back (call it if the work fails or produces nothing). */
  refund: () => void;
  source: "plan" | "credits";
  /** Scans only: whether this scan gets the (paid-for) AI review. */
  aiReview: boolean;
}

/**
 * Pays for one scan or fix, or throws QuotaError.
 * Order: the plan allowance first, then credits. A free scan with no credits is allowed but static-only.
 * node:sqlite is synchronous, so the check-then-insert below cannot interleave with another request.
 */
export function reserve(db: Db, config: Config, user: User, kind: UsageKind, now = Date.now()): Reservation {
  const plan = planOf(user);
  const limit = config.limits[plan][kind];
  const noun = kind === "scans" ? "scan" : "fix";
  const cost = kind === "scans" ? config.creditCosts.scan : config.creditCosts.fix;
  const planLeft = usageCounts(db, user, now)[kind] < limit;

  const useCredits = (): Reservation | null => {
    if (creditBalance(db, user.githubId) < cost) return null;
    addCredits(db, user.githubId, -cost, noun);
    return { source: "credits", aiReview: true, refund: () => void addCredits(db, user.githubId, cost, `refund ${noun}`) };
  };
  const usePlan = (): Reservation => {
    const { lastInsertRowid } = db.prepare("INSERT INTO usage (github_id, kind, created_at) VALUES (?, ?, ?)").run(user.githubId, kind, now);
    return {
      source: "plan",
      aiReview: kind === "fixes" || plan === "pro" || config.freeAiReview,
      refund: () => void db.prepare("UPDATE usage SET refunded = 1 WHERE id = ?").run(lastInsertRowid),
    };
  };

  if (kind === "scans") {
    // Pro: allowance, then credits. Free: credits (=> AI review) if any, else a free static scan.
    if (plan === "pro" && planLeft) return usePlan();
    const paid = useCredits();
    if (paid) return paid;
    if (plan === "free" && planLeft) return usePlan();
  } else {
    if (planLeft) return usePlan();
    const paid = useCredits();
    if (paid) return paid;
  }

  const hint = config.creditPacks.length ? " You can also buy credits." : "";
  if (plan === "free") {
    throw new QuotaError(402, "upgrade_required", `You've used your free ${noun}${limit === 1 ? "" : "es"}. Upgrade to Pro to keep going.${hint}`);
  }
  throw new QuotaError(429, "limit_reached", `You've used all ${limit} ${noun}${limit === 1 ? "" : "es"} for this billing period, and it resets when your plan renews.${hint}`);
}

export function accountSummary(db: Db, config: Config, user: User, billingEnabled: boolean, now = Date.now()) {
  const plan = planOf(user);
  const used = usageCounts(db, user, now);
  const limits = config.limits[plan];
  return {
    login: user.login,
    plan,
    status: user.subStatus,
    limits,
    used,
    remaining: { scans: Math.max(0, limits.scans - used.scans), fixes: Math.max(0, limits.fixes - used.fixes) },
    periodEnd: user.periodEnd,
    cancelAtPeriodEnd: user.cancelAtPeriodEnd,
    billingEnabled,
    credits: creditBalance(db, user.githubId),
    creditCosts: config.creditCosts,
  };
}

/** Records what one AI call actually used, so real cost per scan/fix can be reported. */
export function recordAiCall(db: Db, githubId: number, kind: UsageKind, usage: AiUsage): number {
  const cost = estimateCostUsd(usage);
  db.prepare(
    `INSERT INTO ai_calls (github_id, kind, model, input_tokens, output_tokens, cache_read_tokens, cache_write_tokens, cost_usd, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(githubId, kind, usage.model, usage.inputTokens, usage.outputTokens, usage.cacheReadTokens, usage.cacheWriteTokens, cost, Date.now());
  return cost;
}
