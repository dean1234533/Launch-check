import { config } from "./config.js";
import { Footer, Nav } from "./Layout.jsx";

export function Privacy() {
  return (
    <>
      <Nav />
      <main className="wrap prose">
        <h1>Privacy policy</h1>
        <p className="muted">Last updated {config.lastUpdated}</p>
        <p>Launch Check is a Chrome extension and a server that scans GitHub repositories for launch problems. This page explains what data is handled and why.</p>

        <h2>What stays in your browser</h2>
        <ul>
          <li>Your GitHub token and the server address you enter in the settings are stored in this browser (<code>chrome.storage.local</code>).</li>
          <li>Your most recent report for each repository is saved in the browser so you can reopen it.</li>
        </ul>

        <h2>What is sent to the Launch Check server</h2>
        <ul>
          <li>With each scan, fix, or account request, the extension sends your GitHub token and the repository name.</li>
          <li>The server uses the token only to act on GitHub for you: to identify your account, read repository files, and, when you press “Fix it for me”, create a branch and open a pull request. <strong>The token is not saved in our database.</strong></li>
        </ul>

        <h2>What we store</h2>
        <ul>
          <li>Your GitHub numeric ID and username, which identify your account.</li>
          <li>Your scan results: problem titles and explanations, file paths and line numbers, and the suggested prompts. Your source code itself is not saved.</li>
          <li>Usage counts, your credit balance, and records of the AI usage and cost of each scan and fix.</li>
          <li>Your Stripe customer ID and subscription status and dates, if you pay.</li>
        </ul>

        <h2>Other services that receive data</h2>
        <ul>
          <li><strong>Anthropic (AI review and fixes).</strong> For an AI review or a fix, the relevant repository files are sent to Anthropic’s API to be analysed. Anthropic’s own terms and privacy policy apply to that processing.</li>
          <li><strong>OSV.dev (dependency check).</strong> The names and versions of the npm packages in your lockfile are sent to OSV.dev to look up known vulnerabilities. Your code is not sent.</li>
          <li><strong>GitHub.</strong> Repository reads and pull requests happen on GitHub using your token.</li>
          <li><strong>Stripe (payments).</strong> Payments are handled by Stripe. We never see or store your card details.</li>
        </ul>

        <h2>What we don’t do</h2>
        <ul>
          <li>We don’t sell your data or use it for advertising.</li>
          <li>We don’t change your code without a pull request that you review and merge.</li>
        </ul>

        <h2>Your choices</h2>
        <ul>
          <li>Delete your GitHub token on GitHub at any time to cut off access immediately, and remove the extension to clear what it stores in your browser.</li>
          <li>To have your account and stored scan results deleted, contact us{config.contactEmail ? <> at <a href={`mailto:${config.contactEmail}`}>{config.contactEmail}</a></> : ""}.</li>
        </ul>

        <h2>Changes</h2>
        <p>If this policy changes, the date at the top will change.</p>
      </main>
      <Footer />
    </>
  );
}
