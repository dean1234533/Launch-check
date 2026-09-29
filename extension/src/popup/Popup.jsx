import { useEffect, useState } from "react";
import { useAccount, startBilling } from "../account.jsx";
import { getSettings, parseRepoUrl, planLine, reportKey } from "../lib.js";

function openReport(repo, scan) {
  const params = new URLSearchParams({ owner: repo.owner, repo: repo.repo });
  if (repo.branch) params.set("branch", repo.branch);
  if (scan) params.set("scan", "1");
  chrome.tabs.create({ url: chrome.runtime.getURL(`report.html?${params}`) });
  window.close();
}

export function Popup() {
  const [ctx, setCtx] = useState(null); // { hasToken, repo, saved }
  const { account } = useAccount();

  useEffect(() => {
    (async () => {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      const repo = tab?.url ? parseRepoUrl(tab.url) : null;
      const { githubToken } = await getSettings();
      let saved = null;
      if (repo) {
        const key = reportKey(repo.owner, repo.repo);
        saved = (await chrome.storage.local.get(key))[key] ?? null;
      }
      setCtx({ hasToken: Boolean(githubToken), repo, saved });
    })();
  }, []);

  let body;
  if (!ctx) {
    body = <p className="muted">Loading…</p>;
  } else if (!ctx.hasToken) {
    body = (
      <>
        <p>Add a GitHub token so Launch Check can read your repo and open fix pull requests.</p>
        <button className="primary" onClick={() => chrome.runtime.openOptionsPage()}>
          Open settings
        </button>
      </>
    );
  } else if (!ctx.repo) {
    body = <p className="muted">Open a GitHub repository page, then click Launch Check to scan it.</p>;
  } else {
    const { repo, saved } = ctx;
    const critical = saved?.issues.filter((i) => i.severity === "critical").length ?? 0;
    body = (
      <>
        <p>
          <strong>
            {repo.owner}/{repo.repo}
          </strong>
        </p>
        {saved && (
          <p className="muted">
            Last scan: {new Date(saved.scannedAt).toLocaleString()} ·{" "}
            <span className={`badge ${critical ? "critical" : "ok"}`}>
              {critical ? `${critical} must fix` : saved.aiReview === false ? "Basic checks passed" : "No blockers"}
            </span>
          </p>
        )}
        <div className="row">
          <button className="primary" onClick={() => openReport(repo, true)}>
            {saved ? "Scan again" : "Scan before launch"}
          </button>
          {saved && <button onClick={() => openReport(repo, false)}>View last report</button>}
        </div>
      </>
    );
  }

  return (
    <>
      <h2>🚀 Launch Check</h2>
      {body}
      {ctx?.hasToken && account?.plan && (
        <p className="muted">
          {planLine(account)}
          {account.billingEnabled && (
            <button className="link" onClick={() => startBilling(account.plan === "pro" ? "portal" : "checkout").then(() => window.close())}>
              {account.plan === "pro" ? "Manage" : "Upgrade"}
            </button>
          )}
        </p>
      )}
      <div className="row">
        <a href="options.html" target="_blank" className="muted">
          Settings
        </a>
      </div>
    </>
  );
}
