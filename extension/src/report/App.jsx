import { useEffect, useRef, useState } from "react";
import { AccountBar, PackButtons, startBilling, useAccount } from "../account.jsx";
import { api, reportKey } from "../lib.js";
import { Issue, useCopy } from "./Issue.jsx";

const params = new URLSearchParams(location.search);
const owner = params.get("owner");
const repo = params.get("repo");
const branch = params.get("branch") || undefined;
const key = reportKey(owner, repo);

function Summary({ report }) {
  const critical = report.issues.filter((i) => i.severity === "critical");
  const warnings = report.issues.length - critical.length;
  return (
    <section className="card">
      <h2>{critical.length ? "Not ready to launch yet" : report.issues.length ? "Nearly ready" : "Looks ready to launch 🎉"}</h2>
      <div className="stats">
        <span className={`badge ${critical.length ? "critical" : "ok"}`}>{critical.length} must fix</span>
        <span className={`badge ${warnings ? "warning" : "ok"}`}>{warnings} should fix</span>
      </div>
      <p>{report.summary}</p>
      <p className="muted">
        Scanned {report.scannedFiles} files on {report.branch} at {report.commitSha.slice(0, 7)} · {new Date(report.scannedAt).toLocaleString()}
        {report.truncated ? " · Large repo: the most important files were scanned." : ""}
      </p>
    </section>
  );
}

function AiUpsell({ account }) {
  return (
    <section className="card">
      <h3>🔍 Get the full AI code review</h3>
      <p>This free scan ran the built-in checks only. Pro adds an AI review of your login and permission rules, payments, data leaks and crashes.</p>
      <div className="actions">
        <button className="primary" onClick={() => startBilling("checkout")}>
          Upgrade to Pro
        </button>
      </div>
      <p className="muted" style={{ margin: "10px 0 0" }}>
        Or pay as you go: one AI review costs a few credits.
      </p>
      <PackButtons account={account} />
    </section>
  );
}

function Resolved({ resolved }) {
  return (
    <section className="card result">
      <strong>
        ✅ {resolved.length} {resolved.length === 1 ? "problem" : "problems"} from your last scan no longer show up
      </strong>
      <ul>
        {resolved.map((r) => (
          <li key={r.id}>{r.title}</li>
        ))}
      </ul>
    </section>
  );
}

function ScanError({ error, account, onRetry }) {
  const quota = error.code === "upgrade_required" || error.code === "limit_reached";
  return (
    <div className="card">
      {quota ? (
        <>
          <h2>{error.code === "upgrade_required" ? "Upgrade to keep scanning" : "Limit reached"}</h2>
          <p>{error.message}</p>
          <div className="actions">
            {error.code === "upgrade_required" && (
              <button className="primary" onClick={() => startBilling("checkout")}>
                Upgrade to Pro
              </button>
            )}
          </div>
          <PackButtons account={account} />
        </>
      ) : (
        <>
          <h2 className="error">Scan failed</h2>
          <p>{error.message}</p>
        </>
      )}
      <div className="actions">
        <button onClick={() => chrome.runtime.openOptionsPage()}>Settings</button>
        {!quota && (
          <button className="primary" onClick={onRetry}>
            Try again
          </button>
        )}
      </div>
    </div>
  );
}

export function App() {
  const { account, refresh, merge } = useAccount();
  const [state, setState] = useState({ phase: "loading" }); // loading | scanning | report | error
  const [copied, copy] = useCopy();
  const started = useRef(false);

  async function runScan() {
    setState({ phase: "scanning" });
    try {
      const { account: acct, ...scan } = await api("/api/scan", { owner, repo, branch });
      const report = { ...scan, scannedAt: Date.now(), fixes: {} };
      await chrome.storage.local.set({ [key]: report });
      if (acct) merge(acct);
      setState({ phase: "report", report });
    } catch (error) {
      refresh();
      setState({ phase: "error", error });
    }
  }

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    (async () => {
      const saved = (await chrome.storage.local.get(key))[key];
      if (params.get("scan") === "1" || !saved) {
        // Drop ?scan=1 so reloading the tab shows the saved report instead of re-scanning.
        params.delete("scan");
        history.replaceState(null, "", `?${params}`);
        runScan();
      } else {
        setState({ phase: "report", report: saved });
      }
    })();
  }, []);

  async function onFixed(issueId, fix) {
    const report = { ...state.report, fixes: { ...state.report.fixes, [issueId]: fix } };
    await chrome.storage.local.set({ [key]: report });
    setState({ phase: "report", report });
    refresh();
  }

  const report = state.phase === "report" ? state.report : null;
  const copyAllText = report?.issues
    .map((i, n) => `${n + 1}. [${i.severity === "critical" ? "MUST FIX" : "SHOULD FIX"}] ${i.title}\n${i.fixPrompt}`)
    .join("\n\n");

  return (
    <main>
      <header>
        <div>
          <h1>🚀 Launch Check</h1>
          <div className="muted">
            <a href={`https://github.com/${owner}/${repo}`} target="_blank" rel="noopener noreferrer">
              {owner}/{repo}
            </a>
          </div>
          <AccountBar account={account} />
        </div>
        <div className="actions">
          {report?.issues.length > 0 && <button onClick={() => copy(copyAllText, "all")}>{copied === "all" ? "Copied ✓" : "📋 Copy all prompts"}</button>}
          {report && (
            <button className="primary" onClick={runScan}>
              Scan again
            </button>
          )}
        </div>
      </header>

      {state.phase === "scanning" && (
        <div>
          <div className="spinner" aria-hidden="true" />
          <p role="status">Scanning your code… this usually takes 1–3 minutes.</p>
          <p className="muted">You can leave this tab open and come back.</p>
        </div>
      )}
      {state.phase === "error" && <ScanError error={state.error} account={account} onRetry={runScan} />}
      {report && (
        <>
          <Summary report={report} />
          {report.aiReview === false && <AiUpsell account={account} />}
          {report.resolved?.length > 0 && <Resolved resolved={report.resolved} />}
          {report.issues.map((issue) => (
            <Issue key={issue.id} report={report} issue={issue} account={account} onFixed={onFixed} />
          ))}
        </>
      )}
    </main>
  );
}
