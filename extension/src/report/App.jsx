import { useEffect, useRef, useState } from "react";
import { AccountBar, PackButtons, startBilling, useAccount } from "../account.jsx";
import { api, reportKey } from "../lib.js";
import { Issue, useCopy } from "./Issue.jsx";
import { Brand, Icon } from "../ui.jsx";

const params = new URLSearchParams(location.search);
const owner = params.get("owner");
const repo = params.get("repo");
const branch = params.get("branch") || undefined;
const key = reportKey(owner, repo);

/** A free scan runs only the built-in checks, so a clean result must not claim the app is ready to launch. */
function headline(report, criticalCount) {
  if (criticalCount) return "Not ready to launch yet";
  if (report.aiReview === false) return report.issues.length ? "Some problems found" : "No obvious problems found";
  return report.issues.length ? "Nearly ready" : "Looks ready to launch";
}

function Summary({ report }) {
  const critical = report.issues.filter((i) => i.severity === "critical");
  const warnings = report.issues.length - critical.length;
  const clean = report.issues.length === 0;
  return (
    <section className={`summary-card ${clean ? "clean" : critical.length ? "blocked" : "warning"}`}>
      <div className="summary-main">
        <div className="status-symbol"><Icon name={clean ? "check" : "alert"} size={25} /></div>
        <div>
          <span className="eyebrow">Launch assessment</span>
          <h2>{headline(report, critical.length)}</h2>
          <p className="summary-copy">{report.summary}</p>
        </div>
      </div>
      <div className="score-panel">
        <div className="score-stat"><strong>{critical.length}</strong><span>Must fix</span></div>
        <div className="score-stat"><strong>{warnings}</strong><span>Should fix</span></div>
        <div className="score-stat"><strong>{report.scannedFiles}</strong><span>Files checked</span></div>
      </div>
      {report.aiReview === false && <div className="review-notice"><Icon name="sparkles" size={17} /><p><strong>The AI review has not run.</strong> Login rules, payments, data leaks and crashes have not been checked.</p></div>}
      <div className="scan-meta">
        <span><Icon name="branch" size={14} /> {report.branch}</span>
        <span><Icon name="file" size={14} /> {report.commitSha.slice(0, 7)}</span>
        <span>{new Date(report.scannedAt).toLocaleString()}</span>
        {report.truncated && <span>Most important files scanned</span>}
      </div>
    </section>
  );
}

function AiUpsell({ account }) {
  return (
    <section className="upsell-card">
      <div className="upsell-icon"><Icon name="sparkles" size={22} /></div>
      <div className="upsell-copy"><span className="eyebrow">Go deeper</span><h3>Get the full AI code review</h3>
      <p>Pro reviews your login rules, permissions, payments, data leaks, and crash risks—not just the basics.</p></div>
      <div className="upsell-actions">
        <button className="primary" onClick={() => startBilling("checkout")}>
          Upgrade to Pro
        </button>
        <PackButtons account={account} />
      </div>
    </section>
  );
}

function Resolved({ resolved }) {
  return (
    <section className="resolved-card">
      <div className="resolved-head"><span><Icon name="check" size={17} /></span><strong>{resolved.length} {resolved.length === 1 ? "problem" : "problems"} from your last scan no longer show up</strong></div>
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
    <div className="error-card">
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

  // `previous` is the report to keep on screen if this scan fails (for example at the free limit or when offline).
  async function runScan(previous = state.report) {
    setState({ phase: "scanning" });
    try {
      const { account: acct, ...scan } = await api("/api/scan", { owner, repo, branch });
      const report = { ...scan, scannedAt: Date.now(), fixes: {} };
      await chrome.storage.local.set({ [key]: report });
      if (acct) merge(acct);
      setState({ phase: "report", report });
    } catch (error) {
      refresh();
      setState({ phase: "error", error, report: previous });
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
        runScan(saved);
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

  const report = state.phase === "report" || state.phase === "error" ? (state.report ?? null) : null;
  const copyAllText = report?.issues
    .map((i, n) => `${n + 1}. [${i.severity === "critical" ? "MUST FIX" : "SHOULD FIX"}] ${i.title}\n${i.fixPrompt}`)
    .join("\n\n");

  return (
    <div className="report-shell">
      <header className="report-nav">
        <Brand />
        <div className="nav-repo">
          <Icon name="github" size={16} />
          <a href={`https://github.com/${owner}/${repo}`} target="_blank" rel="noopener noreferrer">{owner} / {repo}</a>
        </div>
        <div className="nav-account"><AccountBar account={account} /></div>
      </header>
      <main className="report-main">
        <div className="report-heading">
          <div><span className="eyebrow">Repository health</span><h1>Launch readiness report</h1></div>
          <div className="report-actions">
          {report?.issues.length > 0 && <button onClick={() => copy(copyAllText, "all")}><Icon name={copied === "all" ? "check" : "copy"} size={15} /> {copied === "all" ? "Copied" : "Copy all prompts"}</button>}
          {report && (
            <button className="primary" onClick={() => runScan()}>
              <Icon name="refresh" size={16} /> Scan again
            </button>
          )}
          </div>
        </div>

      {state.phase === "scanning" && (
        <div className="scanning-card">
          <div className="scanner-visual"><Icon name="scan" size={28} /><span /></div>
          <span className="eyebrow">Scan in progress</span>
          <h2 role="status">Inspecting your codebase…</h2>
          <p className="muted">This usually takes 1–3 minutes. You can leave this tab open and come back.</p>
          <div className="scan-progress"><span /></div>
        </div>
      )}
      {state.phase === "error" && <ScanError error={state.error} account={account} onRetry={() => runScan()} />}
      {report && (
        <>
          <Summary report={report} />
          {report.aiReview === false && <AiUpsell account={account} />}
          {report.resolved?.length > 0 && <Resolved resolved={report.resolved} />}
          {report.issues.length > 0 && <div className="issues-heading"><div><span className="eyebrow">Action items</span><h2>What to fix before launch</h2></div><span>{report.issues.length} {report.issues.length === 1 ? "issue" : "issues"}</span></div>}
          <div className="issues-list">{report.issues.map((issue, index) => <Issue key={issue.id} index={index + 1} report={report} issue={issue} account={account} onFixed={onFixed} />)}</div>
        </>
      )}
      </main>
    </div>
  );
}
