import type { Db } from "./db.js";

export interface User {
  githubId: number;
  login: string;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  subStatus: string | null;
  periodStart: number | null;
  periodEnd: number | null;
  cancelAtPeriodEnd: boolean;
}

interface Row {
  github_id: number;
  login: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  sub_status: string | null;
  period_start: number | null;
  period_end: number | null;
  cancel_at_period_end: number;
}

function toUser(r: Row): User {
  return {
    githubId: r.github_id,
    login: r.login,
    stripeCustomerId: r.stripe_customer_id,
    stripeSubscriptionId: r.stripe_subscription_id,
    subStatus: r.sub_status,
    periodStart: r.period_start,
    periodEnd: r.period_end,
    cancelAtPeriodEnd: r.cancel_at_period_end === 1,
  };
}

/** Creates the account on first sight and keeps the GitHub login up to date. */
export function upsertUser(db: Db, githubId: number, login: string): User {
  db.prepare(
    `INSERT INTO users (github_id, login, created_at) VALUES (?, ?, ?)
     ON CONFLICT(github_id) DO UPDATE SET login = excluded.login`,
  ).run(githubId, login, Date.now());
  return getUser(db, githubId)!;
}

export function getUser(db: Db, githubId: number): User | null {
  const row = db.prepare("SELECT * FROM users WHERE github_id = ?").get(githubId) as Row | undefined;
  return row ? toUser(row) : null;
}

export function getUserByCustomer(db: Db, customerId: string): User | null {
  const row = db.prepare("SELECT * FROM users WHERE stripe_customer_id = ?").get(customerId) as Row | undefined;
  return row ? toUser(row) : null;
}

export function setCustomerId(db: Db, githubId: number, customerId: string): void {
  db.prepare("UPDATE users SET stripe_customer_id = ? WHERE github_id = ?").run(customerId, githubId);
}

export interface SubscriptionState {
  subscriptionId: string;
  status: string;
  periodStart: number | null;
  periodEnd: number | null;
  cancelAtPeriodEnd: boolean;
  /** Stripe event timestamp (ms); older events never overwrite newer state. */
  eventAt: number;
}

export function saveSubscription(db: Db, githubId: number, s: SubscriptionState): boolean {
  const res = db
    .prepare(
      `UPDATE users SET stripe_subscription_id = ?, sub_status = ?, period_start = ?, period_end = ?,
         cancel_at_period_end = ?, sub_event_at = ?
       WHERE github_id = ? AND sub_event_at <= ?`,
    )
    .run(s.subscriptionId, s.status, s.periodStart, s.periodEnd, s.cancelAtPeriodEnd ? 1 : 0, s.eventAt, githubId, s.eventAt);
  return Number(res.changes) > 0;
}
