import { useEffect, useState } from "react";
import { useAccount, startBilling } from "../account.jsx";
import { getSettings, parseRepoUrl, planLine, reportKey } from "../lib.js";
import { Brand, Icon } from "../ui.jsx";

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
    body = (
      <div className="popup-state loading-state">
        <span className="mini-spinner" />
        <p>Checking this page…</p>
      </div>
    );
  } else if (!ctx.hasToken) {
    body = (
      <div className="popup-state">
        <div className="state-icon"><Icon name="lock" size={22} /></div>
        <div>
          <span className="eyebrow">Secure connection required</span>
          <h1>Connect your GitHub</h1>
          <p className="muted">Use a fine-grained token to scan repositories and open reviewed fix pull requests.</p>
        </div>
        <button className="primary wide" onClick={() => chrome.runtime.openOptionsPage()}>
          Continue to setup <Icon name="arrow" size={16} />
        </button>
      </div>
    );
  } else if (!ctx.repo) {
    body = (
      <div className="popup-state empty-state">
        <div className="state-icon"><Icon name="github" size={24} /></div>
        <h1>No repository detected</h1>
        <p className="muted">Navigate to a GitHub repository to start a security and readiness scan.</p>
      </div>
    );
  } else {
    const { repo, saved } = ctx;
    const critical = saved?.issues.filter((i) => i.severity === "critical").length ?? 0;
    body = (
      <div className="repo-state">
        <div className="repo-heading">
          <span className="repo-icon"><Icon name="github" size={19} /></span>
          <div>
            <span className="eyebrow">Ready to inspect</span>
            <h1>{repo.owner}<span>/</span>{repo.repo}</h1>
          </div>
        </div>
        {saved && (
          <div className="last-scan">
            <div>
              <span className="scan-label">Last scan</span>
              <span className="scan-time">{new Date(saved.scannedAt).toLocaleString()}</span>
            </div>
            <span className={`badge ${critical ? "critical" : "ok"}`}>
              {critical ? `${critical} must fix` : saved.aiReview === false ? "Basic checks passed" : "No blockers"}
            </span>
          </div>
        )}
        {!saved && <p className="muted intro-copy">Review secrets, permissions, dependencies and production risks before release.</p>}
        <div className="popup-actions">
          <button className="primary" onClick={() => openReport(repo, true)}>
            <Icon name={saved ? "refresh" : "scan"} size={16} /> {saved ? "Scan again" : "Run quick scan"}
          </button>
          {saved && <button onClick={() => openReport(repo, false)}><Icon name="report" size={16} /> View report</button>}
        </div>
      </div>
    );
  }

  return (
    <main className="popup-shell">
      <header className="popup-header">
        <Brand compact />
        <a href="options.html" target="_blank" className="icon-button" aria-label="Settings" title="Settings"><Icon name="settings" size={17} /></a>
      </header>
      <section className="popup-content">{body}</section>
      {ctx?.hasToken && account?.plan && (
        <footer className="popup-footer">
          <span className="plan-dot" />
          <span>{planLine(account)}</span>
          {account.billingEnabled && (
            <button className="link" onClick={() => startBilling(account.plan === "pro" ? "portal" : "checkout").then(() => window.close())}>
              {account.plan === "pro" ? "Manage" : "Upgrade"}
            </button>
          )}
        </footer>
      )}
    </main>
  );
}
