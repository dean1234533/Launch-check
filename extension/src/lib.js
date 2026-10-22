// Shared helpers for extension pages (popup, report, options).

// The hosted Quick Scan First server. Developers can point the extension at http://localhost:8787 in Settings.
export const DEFAULT_SERVER = "https://launch-check.deanburt1308.workers.dev";

export async function getSettings() {
  const { serverUrl, githubToken } = await chrome.storage.local.get(["serverUrl", "githubToken"]);
  return { serverUrl: (serverUrl || DEFAULT_SERVER).replace(/\/+$/, ""), githubToken: githubToken || "" };
}

/** Parses a github.com URL into { owner, repo, branch } or returns null. */
export function parseRepoUrl(url) {
  let u;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  if (u.hostname !== "github.com") return null;
  const [owner, repo, kind, ...rest] = u.pathname.split("/").filter(Boolean);
  const reserved = ["settings", "orgs", "marketplace", "explore", "notifications", "topics", "sponsors", "login", "new"];
  if (!owner || !repo || reserved.includes(owner)) return null;
  const onBranchPage = (kind === "tree" || kind === "blob") && rest.length;
  return { owner, repo: repo.replace(/\.git$/, ""), branch: onBranchPage ? rest.join("/") : undefined };
}

export class ApiError extends Error {
  constructor(message, status, code) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

/** Calls the Quick Scan First server. With a body it POSTs; without one it GETs. */
export async function api(path, body) {
  const { serverUrl, githubToken } = await getSettings();
  if (!githubToken) throw new ApiError("Add your GitHub token in Settings first.", 0);
  let res;
  try {
    res = await fetch(`${serverUrl}${path}`, {
      method: body === undefined ? "GET" : "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${githubToken}` },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(`Can't reach the Quick Scan First server at ${serverUrl}. Check Settings.`, 0);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data.error || `Request failed (${res.status})`, res.status, data.code);
  return data;
}

export const getAccount = () => api("/api/me");

/** Returns the URL only if it is a plain https link, so a bad server response can never open a javascript: or data: URL. */
export function safeHttpsUrl(url) {
  try {
    const u = new URL(url);
    return u.protocol === "https:" ? u.href : null;
  } catch {
    return null;
  }
}

async function openInNewTab(url) {
  const safe = safeHttpsUrl(url);
  if (!safe) throw new ApiError("The server sent an invalid link.", 0);
  await chrome.tabs.create({ url: safe });
}

/** Opens Stripe Checkout (upgrade) or the Stripe billing portal (manage/cancel) in a new tab. */
export async function openBilling(kind) {
  const { url } = await api(kind === "portal" ? "/api/billing/portal" : "/api/billing/checkout", {});
  await openInNewTab(url);
}

/** Opens Stripe Checkout for a one-time credit pack. */
export async function buyCredits(pack) {
  const { url } = await api("/api/billing/credits", { pack });
  await openInNewTab(url);
}

export function packLabel(p) {
  const price = p.amount != null && p.currency ? new Intl.NumberFormat(undefined, { style: "currency", currency: p.currency.toUpperCase() }).format(p.amount / 100) : "";
  return `Buy ${p.credits} credits${price ? ` · ${price}` : ""}`;
}

/** One-line description of the user's plan and what is left, e.g. "Pro · 7 of 10 scans left". */
export function planLine(a) {
  if (a.plan === "pro") {
    const renews = a.periodEnd ? ` · ${a.cancelAtPeriodEnd ? "ends" : "renews"} ${new Date(a.periodEnd).toLocaleDateString()}` : "";
    return `Pro · ${a.remaining.scans} of ${a.limits.scans} scans left this period${renews}${a.credits > 0 ? ` · ${a.credits} credits` : ""}`;
  }
  return `Free · ${a.remaining.scans} of ${a.limits.scans} scan${a.limits.scans === 1 ? "" : "s"} left${a.credits > 0 ? ` · ${a.credits} credits` : ""}`;
}

export function reportKey(owner, repo) {
  return `report:${owner}/${repo}`.toLowerCase();
}
