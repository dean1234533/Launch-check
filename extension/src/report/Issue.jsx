import { useState } from "react";
import { PackButtons, startBilling } from "../account.jsx";
import { api } from "../lib.js";

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
        <strong>✅ Fix ready: </strong>
        <a href={fix.pullRequestUrl} target="_blank" rel="noopener noreferrer">
          Pull request #{fix.number}
        </a>{" "}
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
        <button className="primary" style={{ marginLeft: 8 }} onClick={() => startBilling("checkout")}>
          Upgrade to Pro
        </button>
      )}
      {(fix.code === "upgrade_required" || fix.code === "limit_reached") && <PackButtons account={account} />}
    </div>
  );
}

export function Issue({ report, issue, account, onFixed }) {
  const [busy, setBusy] = useState(false);
  const [copied, copy] = useCopy();
  const fix = report.fixes?.[issue.id];

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
    <article className="card issue">
      <div className="issue-head">
        <span className={`badge ${issue.severity}`}>{issue.severity === "critical" ? "Must fix" : "Should fix"}</span>
        <span className="badge" style={{ background: "var(--surface)" }}>
          {issue.category}
        </span>
        <h3>{issue.title}</h3>
      </div>
      <FileLink report={report} issue={issue} />
      <p style={{ marginTop: 8 }}>{issue.explanation}</p>
      <div className="actions">
        <button className="primary" disabled={busy} onClick={runFix}>
          {busy ? "Writing fix… (up to a few minutes)" : fix?.status === "pr_opened" ? "🛠 Fix again" : fix ? "🛠 Try again" : "🛠 Fix it for me"}
        </button>
        <button onClick={() => copy(issue.fixPrompt, "one")}>{copied === "one" ? "Copied ✓" : "📋 Copy prompt"}</button>
      </div>
      <details>
        <summary className="muted">Show the AI prompt</summary>
        <pre>{issue.fixPrompt}</pre>
      </details>
      <FixResult fix={fix} account={account} />
    </article>
  );
}
