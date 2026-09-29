import { useEffect, useState } from "react";
import { useAccount, startBilling } from "../account.jsx";
import { DEFAULT_SERVER, getSettings, planLine } from "../lib.js";

/** Validates the server URL and asks Chrome for permission to call a remote server. */
async function normalizeServerUrl(input) {
  const serverUrl = input.trim().replace(/\/+$/, "") || DEFAULT_SERVER;
  let url;
  try {
    url = new URL(serverUrl);
  } catch {
    throw new Error("Enter a valid server URL.");
  }
  const local = ["localhost", "127.0.0.1"].includes(url.hostname);
  if (!local && url.protocol !== "https:") throw new Error("The server URL must use https://");
  if (!local) {
    const granted = await chrome.permissions.request({ origins: [`${url.origin}/*`] });
    if (!granted) throw new Error("Permission to contact the server was not granted.");
  }
  return url.origin + url.pathname.replace(/\/+$/, "");
}

export function Options() {
  const [token, setToken] = useState("");
  const [server, setServer] = useState("");
  const [status, setStatus] = useState({ text: "", error: false });
  const [ready, setReady] = useState(false);
  const { account, error: accountError, refresh } = useAccount();

  useEffect(() => {
    getSettings().then((s) => {
      setToken(s.githubToken);
      setServer(s.serverUrl === DEFAULT_SERVER ? "" : s.serverUrl);
      setReady(true);
    });
  }, []);

  async function save() {
    setStatus({ text: "", error: false });
    try {
      const serverUrl = await normalizeServerUrl(server);
      await chrome.storage.local.set({ githubToken: token.trim(), serverUrl });
      setStatus({ text: "Saved ✓", error: false });
      refresh();
    } catch (err) {
      setStatus({ text: err.message, error: true });
    }
  }

  if (!ready) return null;
  return (
    <main>
      <h1>Launch Check settings</h1>
      <div className="card">
        <h3>1. Connect GitHub</h3>
        <p className="muted">
          Create a <strong>fine-grained personal access token</strong> so Launch Check can read your code and open pull requests with fixes:
        </p>
        <ol className="muted">
          <li>
            Open{" "}
            <a href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noopener noreferrer">
              GitHub → New fine-grained token
            </a>
            .
          </li>
          <li>Under <em>Repository access</em>, pick only the repos you want to scan.</li>
          <li>
            Under <em>Permissions</em>, set <strong>Contents: Read and write</strong> and <strong>Pull requests: Read and write</strong>.
          </li>
          <li>Generate the token and paste it below.</li>
        </ol>
        <label htmlFor="token">GitHub token</label>
        <input id="token" type="password" autoComplete="off" placeholder="github_pat_…" value={token} onChange={(e) => setToken(e.target.value)} />
        <p className="muted" style={{ marginTop: 6 }}>
          Stored only in this browser. It is sent to the Launch Check server with each scan and is not saved there.
        </p>

        <h3 style={{ marginTop: 20 }}>2. Server</h3>
        <label htmlFor="server">Launch Check server URL</label>
        <input id="server" type="url" placeholder="http://localhost:8787" value={server} onChange={(e) => setServer(e.target.value)} />

        <h3 style={{ marginTop: 20 }}>3. Your plan</h3>
        {account?.plan ? (
          <>
            <p className="muted">
              {account.login}: {planLine(account)}
            </p>
            {account.billingEnabled && (
              <div className="row">
                <button className={account.plan === "pro" ? "" : "primary"} onClick={() => startBilling(account.plan === "pro" ? "portal" : "checkout")}>
                  {account.plan === "pro" ? "Manage billing" : "Upgrade to Pro"}
                </button>
              </div>
            )}
          </>
        ) : (
          <p className="muted">{token ? accountError || "Loading…" : "Save your token to see your plan."}</p>
        )}

        <div className="row">
          <button className="primary" onClick={save}>
            Save
          </button>
          <span className={status.error ? "error" : "muted"} role="status">
            {status.text}
          </span>
        </div>
      </div>
    </main>
  );
}
