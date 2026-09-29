import { el, getSettings, parseRepoUrl, reportKey } from "./lib.js";

const content = document.getElementById("content");

const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
const repo = tab?.url ? parseRepoUrl(tab.url) : null;
const { githubToken } = await getSettings();

content.replaceChildren();
if (!githubToken) {
  content.append(
    el("p", {}, "Add a GitHub token so Launch Check can read your repo and open fix pull requests."),
    el("button", { class: "primary", onclick: () => chrome.runtime.openOptionsPage() }, "Open settings"),
  );
} else if (!repo) {
  content.append(el("p", { class: "muted" }, "Open a GitHub repository page, then click Launch Check to scan it."));
} else {
  const key = reportKey(repo.owner, repo.repo);
  const saved = (await chrome.storage.local.get(key))[key];
  const open = (scan) => {
    const params = new URLSearchParams({ owner: repo.owner, repo: repo.repo });
    if (repo.branch) params.set("branch", repo.branch);
    if (scan) params.set("scan", "1");
    chrome.tabs.create({ url: chrome.runtime.getURL(`report.html?${params}`) });
    window.close();
  };
  content.append(el("p", {}, el("strong", {}, `${repo.owner}/${repo.repo}`)));
  if (saved) {
    const critical = saved.issues.filter((i) => i.severity === "critical").length;
    content.append(
      el(
        "p",
        { class: "muted" },
        `Last scan: ${new Date(saved.scannedAt).toLocaleString()} · `,
        el("span", { class: `badge ${critical ? "critical" : "ok"}` }, critical ? `${critical} must fix` : "No blockers"),
      ),
    );
  }
  content.append(
    el(
      "div",
      { class: "row" },
      el("button", { class: "primary", onclick: () => open(true) }, saved ? "Scan again" : "Scan before launch"),
      saved && el("button", { onclick: () => open(false) }, "View last report"),
    ),
  );
}
