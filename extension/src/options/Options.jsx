import { useEffect, useState } from "react";
import { useAccount, startBilling, PackButtons } from "../account.jsx";
import { DEFAULT_SERVER, getSettings, planLine } from "../lib.js";
import { Brand, Icon } from "../ui.jsx";

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
  const [tab, setTab] = useState("github");
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
      setStatus({ text: "Changes saved", error: false });
      refresh();
    } catch (err) {
      setStatus({ text: err.message, error: true });
    }
  }

  if (!ready) return null;
  return (
    <div className="settings-shell">
      <aside className="settings-sidebar">
        <Brand />
        <nav aria-label="Settings sections">
          {[["github", "github", "GitHub"], ["server", "server", "Server"], ["plan", "user", "Plan & usage"]].map(([id, icon, label]) => (
            <a key={id} href={`#${id}`} className={tab === id ? "active" : ""} aria-current={tab === id ? "page" : undefined} onClick={(e) => { e.preventDefault(); setTab(id); }}>
              <Icon name={icon} size={17} /> {label}
            </a>
          ))}
          <a href="https://github.com" target="_blank" rel="noopener noreferrer">
            <Icon name="external" size={17} /> Open GitHub
          </a>
        </nav>
        <div className="sidebar-note">
          <Icon name="lock" size={15} />
          <span>Your token stays in this browser.</span>
        </div>
      </aside>
      <main className="settings-main">
        <div className="settings-intro">
          <span className="eyebrow">Configuration</span>
          <h1>Settings</h1>
          <p className="muted">Connect your repository access and manage how Quick Scan First runs.</p>
        </div>

        <section className="settings-card" id="github" hidden={tab !== "github"}>
          <div className="settings-card-head">
            <span className="number">01</span>
            <div><h2>Connect GitHub</h2><p className="muted">Grant access only to the repositories you want to scan.</p></div>
          </div>
          <div className="instruction-list">
            <div><span>1</span><p>Open <a href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noopener noreferrer">GitHub fine-grained tokens <Icon name="external" size={13} /></a></p></div>
            <div><span>2</span><p>Under <strong>Repository access</strong>, pick the private repositories you want to scan or fix. Public repositories can be scanned without picking them.</p></div>
            <div><span>3</span><p>Set <strong>Contents</strong> and <strong>Pull requests</strong> to read and write.</p></div>
          </div>
          <label htmlFor="token">GitHub fine-grained token</label>
          <div className="input-wrap"><Icon name="lock" size={16} /><input id="token" type="password" autoComplete="off" placeholder="github_pat_…" value={token} onChange={(e) => setToken(e.target.value)} /></div>
          <p className="field-note"><Icon name="check" size={13} /> Stored only in this browser and never saved on the Quick Scan First server.</p>
        </section>

        <section className="settings-card" id="server" hidden={tab !== "server"}>
          <div className="settings-card-head">
            <span className="number">02</span>
            <div><h2>Server</h2><p className="muted">Use the hosted service or point to your own instance.</p></div>
          </div>
          <label htmlFor="server">Quick Scan First server URL</label>
          <div className="input-wrap"><Icon name="server" size={16} /><input id="server" type="url" placeholder={DEFAULT_SERVER} value={server} onChange={(e) => setServer(e.target.value)} /></div>
        </section>

        <section className="settings-card" id="plan" hidden={tab !== "plan"}>
          <div className="settings-card-head">
            <span className="number">03</span>
            <div><h2>Plan & usage</h2><p className="muted">Your current allowance and billing details.</p></div>
          </div>
          {account?.plan ? (
            <div className="plan-card">
              <div className="plan-avatar">{account.login?.slice(0, 1).toUpperCase()}</div>
              <div><strong>{account.login}</strong><p className="muted">{planLine(account)}</p></div>
              <span className="plan-pill">{account.plan}</span>
              {account.billingEnabled && <button onClick={() => startBilling(account.plan === "pro" ? "portal" : "checkout")}>{account.plan === "pro" ? "Manage billing" : "Upgrade to Pro"}</button>}
            </div>
          ) : (
            <p className="muted">{token ? accountError || "Loading…" : "Save your token to see your plan."}</p>
          )}
          {account?.plan && account.billingEnabled && account.packs?.length > 0 && (
            <div className="credit-packs">
              <p className="muted">Need more scans or fixes? Credits are a one-time purchase, with no subscription.</p>
              <PackButtons account={account} />
            </div>
          )}
        </section>

        <div className="save-bar">
          <span className={status.error ? "error" : "save-status"} role="status">{status.text}</span>
          <button className="primary" onClick={save}>Save changes <Icon name="arrow" size={16} /></button>
        </div>
      </main>
    </div>
  );
}
