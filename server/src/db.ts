export interface RunResult {
  changes: number | bigint;
  lastInsertRowid: number | bigint;
}

export interface Statement {
  get(...params: unknown[]): unknown;
  all(...params: unknown[]): unknown[];
  run(...params: unknown[]): RunResult;
}

/** The small synchronous SQL surface the server needs. node:sqlite (tests) and Durable Object storage (production) both fit it. */
export interface Db {
  prepare(sql: string): Statement;
  exec(sql: string): void;
}

export const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  github_id INTEGER PRIMARY KEY,
  login TEXT NOT NULL,
  stripe_customer_id TEXT UNIQUE,
  stripe_subscription_id TEXT,
  sub_status TEXT,
  period_start INTEGER,
  period_end INTEGER,
  cancel_at_period_end INTEGER NOT NULL DEFAULT 0,
  sub_event_at INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS usage (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  github_id INTEGER NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('scans','fixes')),
  refunded INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS usage_user ON usage (github_id, kind, created_at);
CREATE TABLE IF NOT EXISTS scans (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  github_id INTEGER NOT NULL,
  owner TEXT NOT NULL,
  repo TEXT NOT NULL,
  branch TEXT NOT NULL,
  commit_sha TEXT NOT NULL,
  critical INTEGER NOT NULL,
  warnings INTEGER NOT NULL,
  result_json TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS ai_calls (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  github_id INTEGER NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('scans','fixes')),
  model TEXT NOT NULL,
  input_tokens INTEGER NOT NULL,
  output_tokens INTEGER NOT NULL,
  cache_read_tokens INTEGER NOT NULL,
  cache_write_tokens INTEGER NOT NULL,
  cost_usd REAL NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS credit_ledger (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  github_id INTEGER NOT NULL,
  delta INTEGER NOT NULL,
  reason TEXT NOT NULL,
  ref TEXT UNIQUE,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS credit_user ON credit_ledger (github_id);
CREATE INDEX IF NOT EXISTS scans_repo ON scans (github_id, owner, repo, created_at);
`;

/**
 * Wraps a Durable Object's SQLite storage in the Db interface.
 * Writes get a RETURNING clause so `changes` is the exact number of rows touched
 * (an ignored INSERT OR IGNORE returns none) and `lastInsertRowid` is available.
 */
export function durableObjectDb(sql: SqlStorage): Db {
  const withReturning = (query: string): string =>
    /^\s*(insert|update|delete)\b/i.test(query) && !/\breturning\b/i.test(query)
      ? `${query.trim().replace(/;$/, "")} RETURNING rowid AS rid`
      : query;
  return {
    exec(query) {
      sql.exec(query).toArray();
    },
    prepare(query) {
      return {
        get: (...params) => sql.exec(query, ...params).toArray()[0],
        all: (...params) => sql.exec(query, ...params).toArray(),
        run: (...params) => {
          const rows = sql.exec<{ rid: number }>(withReturning(query), ...params).toArray();
          return { changes: rows.length, lastInsertRowid: rows[0]?.rid ?? 0 };
        },
      };
    },
  };
}
