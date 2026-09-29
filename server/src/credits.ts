import type { Db } from "./db.js";

export function creditBalance(db: Db, githubId: number): number {
  const row = db.prepare("SELECT COALESCE(SUM(delta), 0) AS n FROM credit_ledger WHERE github_id = ?").get(githubId) as { n: number };
  return row.n;
}

/**
 * Adds a ledger entry. `ref` (e.g. a Stripe session id) makes it idempotent:
 * a second entry with the same ref is ignored and false is returned.
 */
export function addCredits(db: Db, githubId: number, delta: number, reason: string, ref?: string): boolean {
  const res = db
    .prepare("INSERT OR IGNORE INTO credit_ledger (github_id, delta, reason, ref, created_at) VALUES (?, ?, ?, ?, ?)")
    .run(githubId, delta, reason, ref ?? null, Date.now());
  return Number(res.changes) > 0;
}
