# Chrome Web Store listing: Quick Scan First

Copy each field into the Developer Dashboard. Upload `quick-scan-first-0.3.0.zip` (built from `extension/dist`).

## Store listing tab

**Name:** Quick Scan First

**Summary (max 132 characters):**
Scan your GitHub repo for exposed keys, open databases and payment bugs, then fix them with an AI-written pull request.

**Category:** Developer Tools

**Language:** English

**Description:**
Quick Scan First scans your GitHub repository for problems that would hurt you in production, then helps you fix them.

Built for people who make apps with AI tools and aren't sure what to check before going live.

HOW IT WORKS
1. Open a repo on github.com and click "Scan before launch".
2. Read a plain-English report: what is wrong, why it matters, and where.
3. Press "Fix it for me" and the AI writes the change and opens a pull request for you to review, or copy a ready-made prompt for Cursor, Lovable, Claude or ChatGPT.

WHAT IT CHECKS
Every scan (free):
- Committed .env files
- Hardcoded secrets: Stripe, OpenAI, Anthropic, AWS, GitHub and Slack keys, private keys
- Firebase rules that allow everyone
- Supabase tables with Row Level Security turned off
- Known security holes in the npm packages you use
- A missing .gitignore

AI review (Pro or credits):
- Missing login and ownership checks
- Payment and webhook mistakes
- Crashes on important paths
- Data leaks and broken configuration

SAFE BY DESIGN
- Fixes are always pull requests on a new branch. Nothing changes until you review and merge.
- You choose which repos it can see by creating a GitHub fine-grained token limited to them.
- Your token is stored only in your browser and is not saved on our server.

PRICING
Free: 3 scans with the built-in checks and 2 one-click fixes. Pro: 10 full AI reviews and 25 fixes a month. Credits: pay as you go, they never expire.

Quick Scan First is a helpful second pair of eyes, not a security audit or a guarantee. AI can miss things or flag things that aren't problems, so always review a pull request before merging.

**Graphic assets:**
- Screenshot(s), 1280x800 or 640x400: use fresh screenshots from the renamed extension.
- Small promo tile, 440x280: `quick-scan-first-small-promo-440x280.png`.
- Marquee tile, 1400x560: `quick-scan-first-marquee-promo-1400x560.png`.
- Store icon 128x128 is already inside the package (`icons/icon128.png`).

## Privacy tab

**Single purpose:**
Scan the GitHub repository the user is viewing for launch-blocking bugs and security problems, and help them fix those problems with a pull request.

**Permission justifications:**
- `storage`: Saves the user's GitHub token, server address, and their most recent report for each repo, in the browser only.
- `activeTab`: Lets the toolbar popup read the address of the current tab to detect which GitHub repo the user is on.
- Host permission `https://github.com/*` (content script): Adds the "Scan before launch" button on GitHub repository pages. It only reads the repo owner and name from the page address.
- Host permission `https://launch-check.deanburt1308.workers.dev/*`: Sends scan and fix requests to the Quick Scan First service.
- Host permissions `http://localhost/*` and `http://127.0.0.1/*`: Let developers run the Quick Scan First server locally.
- Optional host permission `https://*/*`: Requested only if the user enters their own server address in Settings.

**Remote code:** No. All code is inside the package.

**Data usage disclosures (tick these):**
- Personally identifiable information: GitHub username and account ID (to identify the account).
- Authentication information: the user's GitHub token (used to act on GitHub; not saved on the server).
- Website content: repository file contents, sent for scanning and AI review.
- Certify: data is not sold, not used for unrelated purposes, not used for creditworthiness or lending.

**Privacy policy URL:** `https://YOUR-CLOUDFLARE-PAGES-ADDRESS/privacy.html`
(Deploy `web/` to Cloudflare Pages first. Set `contactEmail` in `web/src/config.js` before you publish.)

## Distribution tab
- Visibility: start with **Unlisted** to test the store install with a few people, then switch to **Public**.
- Regions: all regions.
