import { productPages } from './content.js';
import { config } from "./config.js";
import { Footer, Nav, StoreButton } from "./Layout.jsx";

// "/" on its own site, "/quick-scan-first/" when served from a subfolder of another site.
const base = import.meta.env.BASE_URL;

const { free, pro } = config.plans;

function Icon({ name, size = 18 }) {
  const paths = {
    scan: <><path d="M4 8V4h4M16 4h4v4M20 16v4h-4M8 20H4v-4" /><path d="m8 12 2.5 2.5L16 9" /></>,
    shield: <><path d="M12 3 5 6v5c0 4.8 2.9 8 7 10 4.1-2 7-5.2 7-10V6l-7-3Z" /><path d="m9 12 2 2 4-4" /></>,
    branch: <><circle cx="6" cy="5" r="2" /><circle cx="18" cy="7" r="2" /><circle cx="6" cy="19" r="2" /><path d="M6 7v10M8 7h4a4 4 0 0 1 4 4v4" /></>,
    search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></>,
    arrow: <><path d="M5 12h14M14 7l5 5-5 5" /></>,
    check: <path d="m5 12 4 4L19 6" />,
    x: <path d="M6 6l12 12M18 6 6 18" />,
    github: <><path d="M9 19c-4 1.2-4-2-5.5-2.5M14.5 21v-3.1c0-1 .1-1.7-.5-2.4 2.8-.3 5.7-1.4 5.7-6.2a4.8 4.8 0 0 0-1.3-3.4 4.5 4.5 0 0 0-.1-3.4s-1-.3-3.5 1.3a12 12 0 0 0-6.3 0C6 2.2 5 2.5 5 2.5a4.5 4.5 0 0 0-.1 3.4 4.8 4.8 0 0 0-1.3 3.4c0 4.8 2.9 5.9 5.7 6.2-.5.5-.7 1.2-.7 2.4V21" /></>,
    lock: <><rect x="5" y="10" width="14" height="10" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></>,
  };
  return <svg className="icon" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}

function ExampleReport({ children }) {
  return (
    <div className="product-preview has-robot-video">
      <div className="preview-glow" />
      <div className="hero-robot-media">
        <video className="hero-robot-video" src={`${base}quick-scan-robot.mp4`} muted loop playsInline autoPlay preload="metadata" aria-label="Quick Scan First security robot transformation" />
      </div>
      <div className="hero-video-shade" aria-hidden="true" />
      {children}
    </div>
  );
}

function SectionVisual({ className, src, alt, eyebrow, title, video = false }) {
  return (
    <figure className={`section-visual ${className}`}>
      {video
        ? <video src={src} aria-label={alt} autoPlay muted loop playsInline preload="metadata" />
        : <img src={src} alt={alt} width="1200" height="750" loading="lazy" decoding="async" />}
      <figcaption><span>{eyebrow}</span><strong>{title}</strong></figcaption>
    </figure>
  );
}

const steps = [
  { icon: "github", title: "Open a repository", body: "Quick Scan First reads the GitHub repository you choose using a fine-grained token you control." },
  { icon: "search", title: "Run a focused review", body: "Static checks and AI review look for secrets, unsafe permissions, broken payments and production risks." },
  { icon: "branch", title: "Ship a reviewed fix", body: "Generate a pull request, inspect the changes on GitHub, and merge only when you are satisfied." },
];

const checks = {
  "Included with every scan": ["Committed environment files", "Hardcoded API keys and private keys", "Open Firebase and Supabase access", "Known npm dependency vulnerabilities", "Missing repository safeguards"],
  "Deep review with Pro or credits": ["Missing authentication and ownership checks", "Payment and webhook implementation mistakes", "Crashes across important user paths", "Data exposure and broken configuration", "Evidence linked directly to your source code"],
};

export const faqs = [
  ["Will it change my code without asking?", "No. A fix is always a pull request on a new branch. Nothing changes until you review and merge it. Quick Scan First will not touch workflows or anything outside your repository."],
  ["What access does it need?", "A fine-grained GitHub token, limited to repositories you choose, with read and write access to Contents and Pull requests. You can revoke it at any time."],
  ["Is my source code stored?", "No. Code is read during a scan and is not saved on our servers. Relevant files are sent to Anthropic only when an AI review or fix needs them."],
  ["Does it work with private repositories?", "Yes, provided your fine-grained token has access to them."],
  ["Can the AI be wrong?", "Yes. Quick Scan First is a useful second pair of eyes, not a security audit or guarantee. Always review generated pull requests before merging."],
  ["What is a credit?", `Credits are pay-as-you-go. An AI scan costs ${config.credits.scan} credits and a fix costs ${config.credits.fix}. They do not expire, and failed operations are refunded.`],
  ["Is VAT added at checkout?", "No. The price you see is the price you pay, with nothing added on top at checkout."],
  ["Can I cancel Pro?", "Yes. Cancel from the billing page in the extension and keep Pro access until the end of the paid period."],
];

function SectionHeading({ eyebrow, title, body }) {
  return <div className="section-heading"><span className="kicker">{eyebrow}</span><h2>{title}</h2>{body && <p>{body}</p>}</div>;
}

export function App() {
  return (
    <>
      <Nav home />
      <main>
        <section className="hero">
          <div className="hero-grid" aria-hidden="true" />
          <div className="wrap hero-layout">
            <ExampleReport>
              <div className="hero-copy">
                <div className="announcement"><span>New</span> AI-assisted pull request fixes</div>
                <h1>GitHub security scanner <br />for AI-built apps.</h1>
                <p className="lede">Review your GitHub repository before launch. Check exposed secrets, unsafe database rules and npm dependencies, then use an optional AI review for authentication and payment risks. Turn findings into fix prompts or pull requests you review.</p>
                <div className="cta"><StoreButton /><a className="btn secondary" href="#how">Explore the workflow <Icon name="arrow" size={15} /></a></div>
                <p className="cta-note">{free.scans} free scans and {free.fixes} free fixes. Pro from {pro.price} a month.</p>
                <div className="hero-proof"><span><Icon name="check" size={14} /> No code stored</span><span><Icon name="check" size={14} /> You approve every change</span></div>
              </div>
            </ExampleReport>
          </div>
        </section>

        <section className="signal-strip"><div className="wrap signal-grid"><span>Built for teams shipping with</span><strong>Cursor</strong><strong>Lovable</strong><strong>Claude</strong><strong>ChatGPT</strong><strong>GitHub</strong></div></section>

        <section className="demo-section" aria-labelledby="demo-title">
          <div className="wrap">
            <div className="demo-heading">
              <span className="kicker">Product walkthrough</span>
              <h2 id="demo-title">See Quick Scan First in action.</h2>
              <p>From opening a repository to reviewing the findings and preparing a fix.</p>
            </div>
            <div className="demo-frame">
              <div className="demo-frame-bar" aria-hidden="true"><span><i /><i /><i /></span><b>Quick Scan First · Product explainer</b></div>
              <video controls playsInline preload="metadata" poster={`${base}video/quick-scan-first-explainer-poster.webp?v=4`} aria-label="Quick Scan First product explainer">
                <source src={`${base}video/quick-scan-first-explainer.mp4?v=2`} type="video/mp4" />
                Your browser does not support embedded video.
              </video>
            </div>
          </div>
        </section>

        <section id="why" className="section-block"><div className="wrap"><SectionHeading eyebrow="Review before release" title="From code findings to a pull request you control." body="Start with built-in checks, then choose deeper review when your launch needs it." /><div className="compare-grid"><article className="compare-card"><span className="plan-name">Built-in checks</span><ul><li><Icon name="check" size={14} />Check selected repository files for known risky patterns</li><li><Icon name="check" size={14} />Find committed .env files, possible secrets and unsafe database rules</li><li><Icon name="check" size={14} />Check supported npm lockfiles against OSV.dev</li></ul></article><article className="compare-card featured"><span className="plan-name">AI review and fixes</span><ul><li><Icon name="check" size={14} />Investigate likely authentication, ownership and payment mistakes with Pro or credits</li><li><Icon name="check" size={14} />Copy a fix prompt or request an AI-assisted pull request</li><li><Icon name="check" size={14} />Inspect the diff and test the change before merging</li></ul><a href={`${base}compare-code-security-tools/`}>Compare security tool workflows →</a></article></div></div></section>

        <section id="how" className="section-block"><div className="wrap"><SectionHeading eyebrow="Workflow" title="From repository to reviewed fix." body="A focused release check that fits the way you already work." /><div className="workflow-grid">{steps.map((step, index) => <article className="workflow-card" key={step.title}><div className="step-top"><span className="step-icon"><Icon name={step.icon} /></span><span className="step-index">0{index + 1}</span></div><h3>{step.title}</h3><p>{step.body}</p></article>)}</div><SectionVisual className="workflow-visual" src={`${base}images/automated-fix.webp`} alt="Quick Scan First robot repairing a vulnerable code pathway" eyebrow="Automated remediation" title="A reviewed fix, ready for your pull request." /></div></section>

        <section id="checks" className="section-block tinted"><div className="wrap checks-layout"><div className="checks-intro"><SectionHeading eyebrow="Coverage" title="The release risks that are easy to miss." body="Fast deterministic checks for known mistakes, with deeper reasoning when you need it." /><div className="assurance"><Icon name="lock" size={18} /><p><strong>Private by design.</strong><br />Your source is processed for the scan, not stored as a copy.</p></div><SectionVisual className="checks-visual" src={`${base}images/repository-scan.mp4`} alt="Quick Scan First robot actively scanning repository pathways for security risks" eyebrow="Repository-wide coverage" title="Find the risk hiding between files." video /></div><div className="check-groups">{Object.entries(checks).map(([title, items], groupIndex) => <article className={`check-card ${groupIndex ? "advanced" : ""}`} key={title}><div className="check-card-head"><span><Icon name={groupIndex ? "scan" : "shield"} /></span><h3>{title}</h3>{groupIndex === 1 && <b>AI</b>}</div><ul>{items.map((item) => <li key={item}><Icon name="check" size={14} />{item}</li>)}</ul></article>)}</div></div></section>

        <section id="pricing" className="section-block"><div className="wrap"><SectionHeading eyebrow="Pricing" title="Start with the basics. Upgrade when you need depth." body="Use the free checks, subscribe for regular reviews, or buy credits when a launch needs extra attention." /><div className="pricing-grid"><article className="price-card"><span className="plan-name">Free</span><div className="price"><strong>{free.price}</strong><span>forever</span></div><p>For getting the fundamentals right.</p><ul><li><Icon name="check" size={14} />{free.scans} built-in scans</li><li><Icon name="check" size={14} />{free.fixes} one-click fixes</li><li><Icon name="check" size={14} />Ready-made fix prompts</li></ul><StoreButton primary={false} /></article><article className="price-card featured"><div className="recommended">Most capable</div><span className="plan-name">Pro</span><div className="price"><strong>{pro.price}</strong><span>/ {pro.period}</span></div><p>For builders shipping products regularly.</p><ul><li><Icon name="check" size={14} />{pro.scans} full AI reviews / month</li><li><Icon name="check" size={14} />{pro.fixes} one-click fixes / month</li><li><Icon name="check" size={14} />Everything in Free</li><li><Icon name="check" size={14} />Cancel at any time</li></ul><StoreButton /></article><article className="price-card credits"><span className="plan-name">Credits</span><div className="price"><strong>Pay once</strong></div><p>Extra capacity without a subscription.</p><div className="pack-list">{config.packs.map((pack) => <div className="pack-row" key={pack.credits}><span>{pack.credits} credits</span><strong>{pack.price}</strong></div>)}</div><span className="credit-note">AI scan: {config.credits.scan} credits · Fix: {config.credits.fix} credits</span><span className="credit-note">The price you see is the price you pay.</span></article></div></div></section>

        <section id="faq" className="section-block faq-section"><div className="wrap faq-layout"><SectionHeading eyebrow="Questions" title="The details, clearly answered." body="How access, code handling, AI reviews and billing work." /><div className="faq-list">{faqs.map(([question, answer]) => <details key={question}><summary>{question}<span>+</span></summary><p>{answer}</p></details>)}</div></div></section>

        <section className="section-block"><div className="wrap"><SectionHeading eyebrow="Choose your review" title="Explore the checks behind your launch." body="Find the workflow that fits your repository and the risks you need to investigate." /><div className="knowledge-links">{productPages.map(page => <a href={`${base}${page.slug}/`} key={page.slug}><span>{page.kind}</span><h3>{page.title}</h3><p>{page.description}</p><b>Explore the check →</b></a>)}</div></div></section>

        <section className="section-block knowledge-preview"><div className="wrap"><SectionHeading eyebrow="Security knowledge" title="Know what to check before you ship." body="Focused guides for repository security, exposed credentials, database access and repeatable pre-launch review." /><div className="knowledge-links"><a href={`${base}blog/github-security-checklist-before-launch/`}><span>Checklist</span><h3>GitHub security checklist before launch</h3><b>Read guide →</b></a><a href={`${base}blog/remove-exposed-api-keys-from-github/`}><span>Incident guide</span><h3>Remove an exposed API key safely</h3><b>Read guide →</b></a><a href={`${base}blog/firebase-supabase-security-rules/`}><span>Database security</span><h3>Firebase and Supabase rules to check</h3><b>Read guide →</b></a></div></div></section>

        <section className="final-cta"><div className="wrap final-cta-inner has-launch-visual"><div><span className="kicker">Before you ship</span><h2>Give your code one more pair of eyes.</h2></div><StoreButton /><SectionVisual className="launch-visual" src={`${base}images/launch-ready.webp`} alt="Quick Scan First robot confirming that a repository is ready to launch" eyebrow="Ready signal" title="Ship with confidence." /></div></section>
      </main>
      <Footer />
    </>
  );
}
