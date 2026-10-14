import { productPages } from "./content.js";
import { config } from "./config.js";

// BASE_URL is "/" on its own site and "/quick-scan-first/" when served from a subfolder of another site.
const base = import.meta.env.BASE_URL;

export function Nav({ home = false }) {
  const to = (hash) => (home ? hash : `${base}${hash}`);
  return (
    <header className="site-header"><div className="wrap">
      <nav aria-label="Main">
        <a className="brand" href={base}><span className="brand-mark"><svg viewBox="0 0 18 18" fill="none" aria-hidden="true"><path d="M7 2.5H4.5a2 2 0 0 0-2 2V7M11 2.5h2.5a2 2 0 0 1 2 2V7M15.5 11v2.5a2 2 0 0 1-2 2H11M7 15.5H4.5a2 2 0 0 1-2-2V11" /><path className="scan-pulse" d="M4.8 9h2.1l1.2-2.1 2 4.2L11.3 9h1.9" /><circle cx="9" cy="9" r="1" /></svg></span><span>Quick Scan <b>First</b></span></a>
        <div className="links">
          <a href={to("#how")}>How it works</a>
          <a href={to("#checks")}>What it checks</a>
          <a href={to("#pricing")}>Pricing</a>
          <a href={`${base}compare-code-security-tools/`}>Compare</a>
          <a href={`${base}blog/`}>Guides</a>
          <a href={to("#faq")}>FAQ</a>
        </div>
        <details className="mobile-nav">
          <summary aria-label="Open navigation menu"><span>Menu</span><i aria-hidden="true" /></summary>
          <div className="mobile-nav-panel">
            <a href={to("#how")}>How it works</a>
            <a href={to("#checks")}>What it checks</a>
            <a href={to("#pricing")}>Pricing</a>
            <a href={`${base}compare-code-security-tools/`}>Compare</a>
          <a href={`${base}blog/`}>Guides</a>
            <a href={to("#faq")}>FAQ</a>
          </div>
        </details>
        <StoreButton />
      </nav>
    </div></header>
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
      {live ? "Add to Chrome" : "Coming soon"}
    </a>
  );
}

export function Footer() {
  return (
    <footer>
      <div className="wrap">
        <span>© {new Date().getFullYear()} Quick Scan First</span>
        <nav className="footer-products" aria-label="Product checks">{productPages.map(page => <a href={`${base}${page.slug}/`} key={page.slug}>{page.title}</a>)}</nav>
        <span>
          <a href={`${base}github-repository-security-scanner/`}>Repository scanner</a> · <a href={`${base}blog/`}>Security guides</a> · <a href={`${base}privacy.html`}>Privacy</a> · <a href={config.repoUrl}>GitHub</a>
        </span>
      </div>
    </footer>
  );
}
