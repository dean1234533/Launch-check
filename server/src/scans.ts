import type { Db } from "./db.js";
import type { Issue, ScanResult } from "./types.js";

export interface ScanSummary {
  id: number;
  owner: string;
  repo: string;
  branch: string;
  commitSha: string;
  critical: number;
  warnings: number;
  createdAt: number;
}

export function saveScan(db: Db, githubId: number, result: Omit<ScanResult, "scanId">): number {
  const critical = result.issues.filter((i) => i.severity === "critical").length;
  const { lastInsertRowid } = db
    .prepare(
      `INSERT INTO scans (github_id, owner, repo, branch, commit_sha, critical, warnings, result_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(githubId, result.owner, result.repo, result.branch, result.commitSha, critical, result.issues.length - critical, JSON.stringify(result), Date.now());
  return Number(lastInsertRowid);
}

export function latestScan(db: Db, githubId: number, owner: string, repo: string, branch: string): { id: number; result: ScanResult } | null {
  const row = db
    .prepare(
      `SELECT id, result_json FROM scans WHERE github_id = ? AND lower(owner) = lower(?) AND lower(repo) = lower(?) AND branch = ?
       ORDER BY id DESC LIMIT 1`,
    )
    .get(githubId, owner, repo, branch) as { id: number; result_json: string } | undefined;
  return row ? { id: row.id, result: JSON.parse(row.result_json) } : null;
}

export function listScans(db: Db, githubId: number, owner: string, repo: string, limit = 20): ScanSummary[] {
  const rows = db
    .prepare(
      `SELECT id, owner, repo, branch, commit_sha, critical, warnings, created_at FROM scans
       WHERE github_id = ? AND lower(owner) = lower(?) AND lower(repo) = lower(?) ORDER BY id DESC LIMIT ?`,
    )
    .all(githubId, owner, repo, limit) as Array<{
    id: number; owner: string; repo: string; branch: string; commit_sha: string; critical: number; warnings: number; created_at: number;
  }>;
  return rows.map((r) => ({
    id: r.id, owner: r.owner, repo: r.repo, branch: r.branch, commitSha: r.commit_sha,
    critical: r.critical, warnings: r.warnings, createdAt: r.created_at,
  }));
}

export function getScan(db: Db, githubId: number, id: number): ScanResult | null {
  const row = db.prepare("SELECT result_json FROM scans WHERE id = ? AND github_id = ?").get(id, githubId) as { result_json: string } | undefined;
  return row ? { ...JSON.parse(row.result_json), scanId: id } : null;
}

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();

/** Two reports of the same problem: same id, or same category, main file and title. */
function sameIssue(a: Issue, b: Issue): boolean {
  return a.id === b.id || (a.category === b.category && a.files[0] === b.files[0] && norm(a.title) === norm(b.title));
}

/** Issues from the previous scan that this scan no longer reports (i.e. probably fixed). */
export function resolvedSince(previous: Issue[], current: Issue[]) {
  return previous
    .filter((p) => !current.some((c) => sameIssue(p, c)))
    .map((p) => ({ id: p.id, title: p.title, severity: p.severity }));
}
