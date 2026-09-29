import { config } from "./config.js";

export function Nav({ home = false }) {
  const to = (hash) => (home ? hash : `/${hash}`);
  return (
    <div className="wrap">
      <nav aria-label="Main">
        <a className="brand" href="/">🚀 Launch Check</a>
        <div className="links">
          <a href={to("#how")}>How it works</a>
          <a href={to("#checks")}>What it checks</a>
          <a href={to("#pricing")}>Pricing</a>
          <a href={to("#faq")}>FAQ</a>
        </div>
      </nav>
    </div>
  );
}

export function StoreButton({ primary = true }) {
  const live = Boolean(config.storeUrl);
  return (
    <a
      className={`btn${primary ? " primary" : ""}`}
      href={live ? config.storeUrl : undefined}
      aria-disabled={!live}
      {...(live ? { target: "_blank", rel: "noopener noreferrer" } : {})}
    >
      {live ? "Add to Chrome" : "Coming soon to the Chrome Web Store"}
    </a>
  );
}

export function Footer() {
  return (
    <footer>
      <div className="wrap">
        <span>© {new Date().getFullYear()} Launch Check</span>
        <span>
          <a href="/privacy.html">Privacy policy</a> · <a href={config.repoUrl}>Source on GitHub</a>
        </span>
      </div>
    </footer>
  );
}
