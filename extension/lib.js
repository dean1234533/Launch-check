// Shared helpers for extension pages (popup, report, options).

export const DEFAULT_SERVER = "http://localhost:8787";

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
  return { owner, repo: repo.replace(/\.git$/, ""), branch: kind === "tree" && rest.length ? rest.join("/") : undefined };
}

export async function api(path, body) {
  const { serverUrl, githubToken } = await getSettings();
  if (!githubToken) throw new Error("Add your GitHub token in Settings first.");
  let res;
  try {
    res = await fetch(`${serverUrl}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${githubToken}` },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error(`Can't reach the Launch Check server at ${serverUrl}. Check Settings.`);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

export function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") node.className = v;
    else if (k.startsWith("on")) node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, v);
  }
  for (const child of children.flat()) {
    if (child == null || child === false) continue;
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return node;
}

export function reportKey(owner, repo) {
  return `report:${owner}/${repo}`.toLowerCase();
}
