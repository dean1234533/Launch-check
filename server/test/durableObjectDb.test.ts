import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { durableObjectDb, SCHEMA } from "../src/db.js";
import { addCredits, creditBalance } from "../src/credits.js";
import { reserve } from "../src/plans.js";
import { loadConfig } from "../src/config.js";
import { saveScan } from "../src/scans.js";
import { getUser, saveSubscription, upsertUser } from "../src/users.js";

/** A stand-in for a Durable Object's `ctx.storage.sql`: same exec(query, ...bindings) -> cursor shape, backed by node:sqlite. */
function freshDb() {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec(SCHEMA);
  const returnsRows = (q: string) => /^\s*(select|with)\b/i.test(q) || /\breturning\b/i.test(q);
  const sql = {
    exec(query: string, ...bindings: unknown[]) {
      const rows = returnsRows(query) ? sqlite.prepare(query).all(...(bindings as SQLInputValue[])) : (sqlite.prepare(query).run(...(bindings as SQLInputValue[])), []);
      return { toArray: () => rows };
    },
  } as unknown as SqlStorage;
  return { db: durableObjectDb(sql) };
}

describe("durableObjectDb adapter", () => {
  it("reports exact change counts, including 0 for an ignored insert and an update that matches nothing", () => {
    const { db } = freshDb();
    assert.equal(Number(db.prepare("INSERT OR IGNORE INTO credit_ledger (github_id, delta, reason, ref, created_at) VALUES (1, 5, 'x', 'r1', 0)").run().changes), 1);
    assert.equal(Number(db.prepare("INSERT OR IGNORE INTO credit_ledger (github_id, delta, reason, ref, created_at) VALUES (1, 5, 'x', 'r1', 0)").run().changes), 0);
    assert.equal(Number(db.prepare("UPDATE users SET login = 'a' WHERE github_id = 999").run().changes), 0);
  });

  it("returns the new row id from an insert", () => {
    const { db } = freshDb();
    const a = db.prepare("INSERT INTO usage (github_id, kind, created_at) VALUES (1, 'scans', 0)").run();
    const b = db.prepare("INSERT INTO usage (github_id, kind, created_at) VALUES (1, 'scans', 0)").run();
    assert.equal(Number(a.lastInsertRowid), 1);
    assert.equal(Number(b.lastInsertRowid), 2);
  });

  it("runs the real account logic: credits are idempotent, refunds work, subscription events are ordered", () => {
    const { db } = freshDb();
    const config = loadConfig({ FREE_SCANS: "1" });
    const user = upsertUser(db, 7, "octo");
    assert.equal(addCredits(db, 7, 10, "purchase", "cs_1"), true);
    assert.equal(addCredits(db, 7, 10, "purchase", "cs_1"), false);
    assert.equal(creditBalance(db, 7), 10);

    const reservation = reserve(db, config, user, "scans");
    reservation.refund();
    reserve(db, config, user, "scans"); // the free scan was refunded, so this one is allowed again

    assert.equal(saveSubscription(db, 7, { subscriptionId: "sub_1", status: "active", periodStart: null, periodEnd: null, cancelAtPeriodEnd: false, eventAt: 2000 }), true);
    assert.equal(saveSubscription(db, 7, { subscriptionId: "sub_1", status: "canceled", periodStart: null, periodEnd: null, cancelAtPeriodEnd: false, eventAt: 1000 }), false); // stale
    assert.equal(getUser(db, 7)!.subStatus, "active");

    const id = saveScan(db, 7, { owner: "a", repo: "b", branch: "main", commitSha: "abc", scannedFiles: 1, truncated: false, issues: [], summary: "ok", aiReview: false, resolved: [] });
    assert.equal(id, 1);
  });
});
