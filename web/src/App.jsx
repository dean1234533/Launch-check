import { config } from "./config.js";
import { Footer, Nav, StoreButton } from "./Layout.jsx";

const { free, pro } = config.plans;

function ExampleReport() {
  return (
    <div className="card mock" role="img" aria-label="Example Launch Check report with two problems, each with a Fix it for me button">
      <div className="tag">Example report (illustration)</div>
      <div className="finding">
        <span className="badge critical">Must fix</span>
        <strong>A secret Stripe key is written in your code</strong>
        <span className="where">src/checkout.js:12</span>
        <div><span className="fake-btn">🛠 Fix it for me</span></div>
      </div>
      <div className="finding">
        <span className="badge critical">Must fix</span>
        <strong>Your database lets anyone read and write</strong>
        <span className="where">firestore.rules:3</span>
        <div><span className="fake-btn">🛠 Fix it for me</span></div>
      </div>
      <div className="finding">
        <span className="badge warning">Should fix</span>
        <strong>No .gitignore, so secrets could be committed</strong>
        <span className="where">.gitignore</span>
      </div>
    </div>
  );
}

const steps = [
  { title: "Scan", body: "Open your repo on GitHub and click “Scan before launch”. Launch Check reads your code and looks for problems that hurt in production." },
  { title: "Read the report", body: "Every problem is in plain English: what is wrong, why it matters, and where. Must-fix problems come first." },
  { title: "Fix it in one click", body: "Press “Fix it for me” and the AI writes the change and opens a pull request. Or copy a ready-made prompt for Cursor, Lovable, Claude or ChatGPT." },
];

const checks = {
  "Every scan (free)": [
    "Committed .env files",
    "Hardcoded secrets: Stripe, OpenAI, Anthropic, AWS, GitHub and Slack keys, private keys",
    "Firebase rules that allow everyone",
    "Supabase tables with Row Level Security turned off",
    "Known security holes in the npm packages you use",
    "A missing .gitignore",
  ],
  "AI review (Pro or credits)": [
    "Missing login and ownership checks",
    "Payment and webhook mistakes",
    "Crashes on important paths",
    "Data leaks and broken configuration",
    "It is told to report only problems it can point to in your code",
  ],
};

const faqs = [
  ["Will it change my code without asking?", "No. A fix is always a pull request on a new branch. Nothing changes until you review and merge it. It will not touch .github/workflows or anything outside your repo."],
  ["What does it need access to?", "A GitHub fine-grained token that you create, limited to the repos you choose, with read and write access to Contents and Pull requests. You can delete the token any time."],
  ["Is my code stored?", "No. Your code is read when you scan and is not saved on our servers. For the AI review and for fixes, the relevant files are sent to Anthropic’s API to be analysed. The privacy policy has the details."],
  ["Does it work on private repos?", "Yes, if your token has access to them."],
  ["Can the AI be wrong?", "Yes. It is told to report only real, visible problems, but it can miss things or flag something that isn’t one. Launch Check is a helpful second pair of eyes, not a security audit or a guarantee. Always review a pull request before merging."],
  ["What is a credit?", "Credits are pay-as-you-go. An AI scan costs 5 credits and a fix costs 2. They never expire. A scan or fix that fails gives its credits back."],
  ["Can I cancel Pro?", "Yes, any time from the billing page in the extension. You keep Pro until the end of the period you paid for."],
];

export function App() {
  return (
    <>
      <Nav home />
      <main>
        <section className="hero">
          <div className="wrap hero-grid">
            <div>
              <h1>Scan your code before you launch.</h1>
              <p className="lede">Launch Check finds exposed API keys, open databases, missing auth checks and payment bugs in your GitHub repo, then opens a pull request that fixes them.</p>
              <div className="cta">
                <StoreButton />
                <a className="btn" href="#how">See how it works</a>
              </div>
              <p className="muted">Built for people who make apps with AI tools and aren’t sure what to check before going live.</p>
            </div>
            <ExampleReport />
          </div>
        </section>

        <section id="how" className="alt">
          <div className="wrap">
            <h2>How it works</h2>
            <div className="grid3">
              {steps.map((s, i) => (
                <div className="card" key={s.title}>
                  <span className="step-num" aria-hidden="true">{i + 1}</span>
                  <h3>{s.title}</h3>
                  <p className="muted">{s.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="checks">
          <div className="wrap">
            <h2>What it checks</h2>
            <div className="grid2">
              {Object.entries(checks).map(([title, items]) => (
                <div className="card" key={title}>
                  <h3>{title}</h3>
                  <ul className="checks">
                    {items.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="pricing" className="alt">
          <div className="wrap">
            <h2>Pricing</h2>
            <p className="lede">Start free. Pay monthly, or buy credits and pay only when you scan.</p>
            <div className="grid2" style={{ marginTop: 24 }}>
              <div className="card">
                <h3>Free</h3>
                <div className="price">{free.price}</div>
                <ul className="checks">
                  <li>{free.scans} scans with the built-in checks</li>
                  <li>{free.fixes} one-click fixes</li>
                  <li>Copy-paste prompts for every problem</li>
                </ul>
              </div>
              <div className="card featured">
                <h3>Pro</h3>
                <div className="price">
                  {pro.price} <small>/ {pro.period}</small>
                </div>
                <ul className="checks">
                  <li>{pro.scans} full AI code reviews a month</li>
                  <li>{pro.fixes} one-click fixes a month</li>
                  <li>Everything in Free</li>
                  <li>Cancel any time</li>
                </ul>
              </div>
            </div>
            <div className="card" style={{ marginTop: 16 }}>
              <h3>Pay as you go</h3>
              <p className="muted">Credits work with or without Pro and never expire. An AI scan is 5 credits, a fix is 2.</p>
              <div className="packs">
                {config.packs.map((p) => (
                  <div className="pack" key={p.credits}>
                    <b>{p.price}</b>
                    <span className="muted">{p.credits} credits</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="cta"><StoreButton /></div>
          </div>
        </section>

        <section id="faq">
          <div className="wrap">
            <h2>Questions</h2>
            {faqs.map(([q, a]) => (
              <details key={q}>
                <summary>{q}</summary>
                <p>{a}</p>
              </details>
            ))}
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
