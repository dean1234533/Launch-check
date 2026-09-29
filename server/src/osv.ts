import type { Issue } from "./types.js";

type Fetch = typeof fetch;

const OSV = "https://api.osv.dev/v1";
const MAX_PACKAGES = 3000;
const MAX_DETAILS = 25;

export interface Dep {
  name: string;
  version: string;
}

/** Production dependencies (with exact versions) from an npm package-lock.json (lockfile v2/v3). */
export function parseLockfile(text: string): Dep[] {
  let lock: { packages?: Record<string, { version?: string; dev?: boolean; link?: boolean }> };
  try {
    lock = JSON.parse(text);
  } catch {
    return [];
  }
  const seen = new Map<string, Dep>();
  for (const [path, info] of Object.entries(lock.packages ?? {})) {
    if (!path || info.dev || info.link || !info.version) continue;
    const name = path.slice(path.lastIndexOf("node_modules/") + "node_modules/".length);
    if (!name || name === path) continue;
    seen.set(`${name}@${info.version}`, { name, version: info.version });
  }
  return [...seen.values()].slice(0, MAX_PACKAGES);
}

interface Vuln {
  id: string;
  summary?: string;
  database_specific?: { severity?: string };
}

const HIGH = new Set(["CRITICAL", "HIGH"]);

/** Looks the dependencies up in OSV.dev (free, no key) and returns one issue, or null when clean. */
export async function checkDependencies(deps: Dep[], fetchFn: Fetch = fetch): Promise<Issue | null> {
  if (!deps.length) return null;

  // Which packages have any known vulnerability? querybatch takes up to 1000 queries per call.
  const hits: Array<{ dep: Dep; ids: string[] }> = [];
  for (let i = 0; i < deps.length; i += 1000) {
    const chunk = deps.slice(i, i + 1000);
    const res = await fetchFn(`${OSV}/querybatch`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ queries: chunk.map((d) => ({ package: { name: d.name, ecosystem: "npm" }, version: d.version })) }),
    });
    if (!res.ok) throw new Error(`OSV query failed (${res.status})`);
    const data = (await res.json()) as { results: Array<{ vulns?: Array<{ id: string }> }> };
    data.results.forEach((r, n) => {
      if (r.vulns?.length) hits.push({ dep: chunk[n], ids: r.vulns.map((v) => v.id) });
    });
  }
  if (!hits.length) return null;

  // Severity and titles need the full record; fetch a capped number of them.
  const ids = [...new Set(hits.flatMap((h) => h.ids))].slice(0, MAX_DETAILS);
  const details = new Map<string, Vuln>();
  await Promise.all(
    ids.map(async (id) => {
      try {
        const res = await fetchFn(`${OSV}/vulns/${encodeURIComponent(id)}`);
        if (res.ok) details.set(id, (await res.json()) as Vuln);
      } catch {
        // Missing detail just means less information in the report.
      }
    }),
  );

  const severe = [...details.values()].some((v) => HIGH.has((v.database_specific?.severity ?? "").toUpperCase()));
  const list = hits
    .slice(0, 8)
    .map((h) => `${h.dep.name}@${h.dep.version}${details.get(h.ids[0])?.summary ? ` (${details.get(h.ids[0])!.summary})` : ""}`)
    .join("; ");
  const more = hits.length > 8 ? `, and ${hits.length - 8} more` : "";
  const count = `${hits.length} ${hits.length === 1 ? "package" : "packages"}`;

  return {
    id: "vulnerable-dependencies",
    severity: severe ? "critical" : "warning",
    category: "security",
    title: `${count} you depend on ${hits.length === 1 ? "has" : "have"} known security vulnerabilities`,
    explanation: `Public security databases list known problems in libraries your app ships with: ${list}${more}. Attackers scan for these known problems, so updating is usually a quick win.`,
    files: ["package.json"],
    line: null,
    fixPrompt: `My project's dependencies have known security vulnerabilities (found via OSV.dev): ${list}${more}. Update the affected packages in package.json to their latest patched versions, run "npm install" to refresh package-lock.json, run "npm audit" to confirm the warnings are gone, then run the app's tests and build to make sure nothing broke.`,
  };
}
