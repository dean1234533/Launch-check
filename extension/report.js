import { api, el, reportKey } from "./lib.js";

const params = new URLSearchParams(location.search);
const owner = params.get("owner");
const repo = params.get("repo");
const branch = params.get("branch") || undefined;
const key = reportKey(owner, repo);

const content = document.getElementById("content");
const topActions = document.getElementById("top-actions");
document.getElementById("repo").append(
  el("a", { href: `https://github.com/${owner}/${repo}`, target: "_blank", rel: "noopener" }, `${owner}/${repo}`),
);

async function save(report) {
  await chrome.storage.local.set({ [key]: report });
}

async function copy(text, button) {
  await navigator.clipboard.writeText(text);
  const label = button.textContent;
  button.textContent = "Copied ✓";
  setTimeout(() => (button.textContent = label), 1500);
}

function fileLink(report, issue) {
  const path = issue.files[0];
  if (!path) return null;
  const text = issue.line ? `${path}:${issue.line}` : path;
  // A missing file has nothing to link to.
  if (issue.id === "missing-gitignore") return el("span", { class: "where muted" }, text);
  const href = `https://github.com/${report.owner}/${report.repo}/blob/${report.commitSha}/${path}${issue.line ? `#L${issue.line}` : ""}`;
  return el("a", { class: "where", href, target: "_blank", rel: "noopener" }, text);
}

function renderFixResult(fix) {
  if (!fix) return null;
  if (fix.status === "pr_opened") {
    return el(
      "div",
      { class: "result" },
      el("strong", {}, "✅ Fix ready: "),
      el("a", { href: fix.pullRequestUrl, target: "_blank", rel: "noopener" }, `Pull request #${fix.number}`),
      " – review it on GitHub, then merge.",
      fix.manualSteps?.length ? el("div", {}, el("strong", {}, "Still to do by hand:"), el("ul", {}, fix.manualSteps.map((s) => el("li", {}, s)))) : null,
    );
  }
  if (fix.status === "no_changes") {
    return el("div", { class: "result fail" }, el("strong", {}, "No code change made. "), fix.message);
  }
  return el("div", { class: "result fail" }, el("strong", {}, "Fix failed: "), fix.error);
}

function renderIssue(report, issue) {
  const resultSlot = el("div", {}, renderFixResult(report.fixes?.[issue.id]));

  const fixButton = el("button", { class: "primary" }, "🛠 Fix it for me");
  fixButton.addEventListener("click", async () => {
    fixButton.disabled = true;
    fixButton.textContent = "Writing fix… (up to a few minutes)";
    let fix;
    try {
      fix = await api("/api/fix", { owner: report.owner, repo: report.repo, branch: report.branch, issue });
    } catch (err) {
      fix = { status: "error", error: err.message };
    }
    report.fixes = { ...report.fixes, [issue.id]: fix };
    await save(report);
    resultSlot.replaceChildren(renderFixResult(fix));
    fixButton.disabled = false;
    fixButton.textContent = fix.status === "pr_opened" ? "🛠 Fix again" : "🛠 Try again";
  });

  const copyButton = el("button", {}, "📋 Copy prompt");
  copyButton.addEventListener("click", () => copy(issue.fixPrompt, copyButton));

  return el(
    "article",
    { class: "card issue" },
    el(
      "div",
      { class: "issue-head" },
      el("span", { class: `badge ${issue.severity}` }, issue.severity === "critical" ? "Must fix" : "Should fix"),
      el("span", { class: "badge", style: "background:var(--surface)" }, issue.category),
      el("h3", {}, issue.title),
    ),
    fileLink(report, issue),
    el("p", { style: "margin-top:8px" }, issue.explanation),
    el("div", { class: "actions" }, fixButton, copyButton),
    el("details", {}, el("summary", { class: "muted" }, "Show the AI prompt"), el("pre", {}, issue.fixPrompt)),
    resultSlot,
  );
}

function renderReport(report) {
  const critical = report.issues.filter((i) => i.severity === "critical");
  const warnings = report.issues.filter((i) => i.severity !== "critical");

  const copyAll = el("button", {}, "📋 Copy all prompts");
  copyAll.addEventListener("click", () =>
    copy(
      report.issues
        .map((i, n) => `${n + 1}. [${i.severity === "critical" ? "MUST FIX" : "SHOULD FIX"}] ${i.title}\n${i.fixPrompt}`)
        .join("\n\n"),
      copyAll,
    ),
  );
  topActions.replaceChildren(
    report.issues.length ? copyAll : "",
    el("button", { class: "primary", onclick: runScan }, "Scan again"),
  );

  content.replaceChildren(
    el(
      "section",
      { class: "card" },
      el("h2", {}, critical.length ? "Not ready to launch yet" : report.issues.length ? "Nearly ready" : "Looks ready to launch 🎉"),
      el(
        "div",
        { class: "stats" },
        el("span", { class: `badge ${critical.length ? "critical" : "ok"}` }, `${critical.length} must fix`),
        el("span", { class: `badge ${warnings.length ? "warning" : "ok"}` }, `${warnings.length} should fix`),
      ),
      el("p", {}, report.summary),
      el(
        "p",
        { class: "muted" },
        `Scanned ${report.scannedFiles} files on ${report.branch} at ${report.commitSha.slice(0, 7)} · ${new Date(report.scannedAt).toLocaleString()}`,
        report.truncated ? " · Large repo: the most important files were scanned." : "",
      ),
    ),
    ...report.issues.map((issue) => renderIssue(report, issue)),
  );
}

async function runScan() {
  topActions.replaceChildren();
  content.replaceChildren(
    el("div", { class: "spinner", "aria-hidden": "true" }),
    el("p", { role: "status" }, "Scanning your code… this usually takes 1–3 minutes."),
    el("p", { class: "muted" }, "You can leave this tab open and come back."),
  );
  try {
    const result = await api("/api/scan", { owner, repo, branch });
    const report = { ...result, scannedAt: Date.now(), fixes: {} };
    await save(report);
    renderReport(report);
  } catch (err) {
    content.replaceChildren(
      el("div", { class: "card" }, el("h2", { class: "error" }, "Scan failed"), el("p", {}, err.message)),
    );
    topActions.replaceChildren(
      el("button", { onclick: () => chrome.runtime.openOptionsPage() }, "Settings"),
      el("button", { class: "primary", onclick: runScan }, "Try again"),
    );
  }
}

const saved = (await chrome.storage.local.get(key))[key];
if (params.get("scan") === "1" || !saved) {
  // Drop ?scan=1 so reloading the tab shows the saved report instead of re-scanning.
  params.delete("scan");
  history.replaceState(null, "", `?${params}`);
  runScan();
} else {
  renderReport(saved);
}
