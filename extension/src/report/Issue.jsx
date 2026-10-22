import { useEffect, useState } from "react";
import { PackButtons, startBilling } from "../account.jsx";
import { api, safeHttpsUrl } from "../lib.js";
import { Icon } from "../ui.jsx";

export function useCopy() {
  const [copied, setCopied] = useState(null);
  return [
    copied,
    async (text, id) => {
      await navigator.clipboard.writeText(text);
      setCopied(id);
      setTimeout(() => setCopied(null), 1500);
    },
  ];
}

function FileLink({ report, issue }) {
  const path = issue.files[0];
  if (!path) return null;
  const text = issue.line ? `${path}:${issue.line}` : path;
  // A missing file has nothing to link to.
  if (issue.id === "missing-gitignore") return <span className="where muted">{text}</span>;
  const href = `https://github.com/${report.owner}/${report.repo}/blob/${report.commitSha}/${path}${issue.line ? `#L${issue.line}` : ""}`;
  return (
    <a className="where" href={href} target="_blank" rel="noopener noreferrer">
      {text}
    </a>
  );
}

function FixResult({ fix, account }) {
  if (!fix) return null;
  if (fix.status === "pr_opened") {
    return (
      <div className="result">
        <strong>Fix ready: </strong>
        {safeHttpsUrl(fix.pullRequestUrl) ? (
          <a href={safeHttpsUrl(fix.pullRequestUrl)} target="_blank" rel="noopener noreferrer">
            Pull request #{fix.number}
          </a>
        ) : (
          <span>Pull request #{fix.number}</span>
        )}{" "}
        – review it on GitHub, then merge.
        {fix.manualSteps?.length > 0 && (
          <div>
            <strong>Still to do by hand:</strong>
            <ul>
              {fix.manualSteps.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  }
  if (fix.status === "no_changes") {
    return (
      <div className="result fail">
        <strong>No code change made. </strong>
        {fix.message}
      </div>
    );
  }
  return (
    <div className="result fail">
      <strong>Fix failed: </strong>
      {fix.error}
      {fix.code === "upgrade_required" && (
        <button className="primary inline-upgrade" onClick={() => startBilling("checkout")}>
          Upgrade to Pro
        </button>
      )}
      {(fix.code === "upgrade_required" || fix.code === "limit_reached") && <PackButtons account={account} />}
    </div>
  );
}

export function Issue({ report, issue, account, onFixed, index }) {
  const [busy, setBusy] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [copied, copy] = useCopy();
  const fix = report.fixes?.[issue.id];

  // A fix can take a few minutes, so show a running timer while it works.
  useEffect(() => {
    if (!busy) return;
    setElapsed(0);
    const id = setInterval(() => setElapsed((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [busy]);

  async function runFix() {
    setBusy(true);
    let result;
    try {
      result = await api("/api/fix", { owner: report.owner, repo: report.repo, branch: report.branch, issue });
    } catch (err) {
      result = { status: "error", error: err.message, code: err.code };
    }
    setBusy(false);
    onFixed(issue.id, result);
  }

  return (
    <article className={`issue ${issue.severity}`}>
      <div className="issue-number">{String(index).padStart(2, "0")}</div>
      <div className="issue-body">
      <div className="issue-head">
        <div className="issue-labels"><span className={`badge ${issue.severity}`}>{issue.severity === "critical" ? "Must fix" : "Should fix"}</span><span className="category-label">{issue.category}</span></div>
        <h3>{issue.title}</h3>
      </div>
      <FileLink report={report} issue={issue} />
      <p className="issue-explanation">{issue.explanation}</p>
      <div className="actions">
        <button className="primary" disabled={busy} onClick={runFix}>
          <Icon name="sparkles" size={15} /> {busy ? `Writing fix… ${Math.floor(elapsed / 60)}:${String(elapsed % 60).padStart(2, "0")} (usually 2–3 min)` : fix?.status === "pr_opened" ? "Fix again" : fix ? "Try again" : "Fix it for me"}
        </button>
        <button onClick={() => copy(issue.fixPrompt, "one")}><Icon name={copied === "one" ? "check" : "copy"} size={15} /> {copied === "one" ? "Copied" : "Copy prompt"}</button>
      </div>
      <details>
        <summary>View fix prompt</summary>
        <pre>{issue.fixPrompt}</pre>
      </details>
      <FixResult fix={fix} account={account} />
      </div>
    </article>
  );
}
