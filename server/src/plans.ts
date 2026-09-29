import type { Config } from "./config.js";
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

/**
 * Uses one scan or fix from the user's allowance, or throws QuotaError.
 * Returns a function that gives it back (call it if the work fails).
 * node:sqlite is synchronous, so the count-then-insert below cannot interleave with another request.
 */
export function reserve(db: Db, config: Config, user: User, kind: UsageKind, now = Date.now()): () => void {
  const plan = planOf(user);
  const limit = config.limits[plan][kind];
  const used = usageCounts(db, user, now)[kind];
  if (used >= limit) {
    const noun = kind === "scans" ? "scan" : "fix";
    if (plan === "free") {
      throw new QuotaError(402, "upgrade_required", `You've used your free ${noun}${limit === 1 ? "" : "es"}. Upgrade to Pro to keep going.`);
    }
    throw new QuotaError(429, "limit_reached", `You've used all ${limit} ${noun}${limit === 1 ? "" : "es"} for this billing period. It resets when your plan renews.`);
  }
  const { lastInsertRowid } = db
    .prepare("INSERT INTO usage (github_id, kind, created_at) VALUES (?, ?, ?)")
    .run(user.githubId, kind, now);
  return () => {
    db.prepare("UPDATE usage SET refunded = 1 WHERE id = ?").run(lastInsertRowid);
  };
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
  };
}
