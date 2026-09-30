# Chrome Web Store listing: Launch Check

Copy each field into the Developer Dashboard. Upload `launch-check-0.3.0.zip` (built from `extension/dist`).

## Store listing tab

**Name:** Launch Check

**Summary (max 132 characters):**
Scan your GitHub repo for exposed keys, open databases and payment bugs, then fix them with an AI-written pull request.

**Category:** Developer Tools

**Language:** English

**Description:**
Launch Check scans your GitHub repository for problems that would hurt you in production, then helps you fix them.

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

Launch Check is a helpful second pair of eyes, not a security audit or a guarantee. AI can miss things or flag things that aren't problems, so always review a pull request before merging.

**Graphic assets you must add yourself** (I can't generate real screenshots):
- Screenshot(s), 1280x800 or 640x400: the report page with findings, the popup, and the "Fix it for me" pull request result. Take them from your own scans.
- Small promo tile, 440x280 (required).
- Optional: marquee 1400x560.
- Store icon 128x128 is already inside the package (`icons/icon128.png`).

## Privacy tab

**Single purpose:**
Scan the GitHub repository the user is viewing for launch-blocking bugs and security problems, and help them fix those problems with a pull request.

**Permission justifications:**
- `storage`: Saves the user's GitHub token, server address, and their most recent report for each repo, in the browser only.
- `activeTab`: Lets the toolbar popup read the address of the current tab to detect which GitHub repo the user is on.
- Host permission `https://github.com/*` (content script): Adds the "Scan before launch" button on GitHub repository pages. It only reads the repo owner and name from the page address.
- Host permission `https://launch-check-production.up.railway.app/*`: Sends scan and fix requests to the Launch Check service.
- Host permissions `http://localhost/*` and `http://127.0.0.1/*`: Let developers run the Launch Check server locally.
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
