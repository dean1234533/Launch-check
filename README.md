# Launch Check

**Scan your code before you launch. Fix what's wrong in one click.**

Launch Check is a Chrome extension and API server. It scans a GitHub repository for problems that would hurt you in production, such as exposed API keys, open database rules, missing auth checks and payment bugs. Every problem comes with:

- **🛠 Fix it for me**: AI writes the fix and opens a **pull request** for you to review and merge.
- **📋 Copy prompt**: a ready-to-paste prompt for Cursor, Lovable, Claude, ChatGPT or any other AI coding tool.

It is written for people who build with AI tools and aren't sure what to check before going live.

## How it works

```
github.com repo page ──"🚀 Scan before launch"──▶ report tab (extension)
                                                     │  POST /api/scan
                                                     ▼
                                              Launch Check server
                                   1. reads the repo through the GitHub API
                                   2. built-in checks (secrets, .env, Firebase/Supabase rules)
                                   3. AI review with Claude
                                                     │
report: 🔴 must fix / 🟡 should fix ◀────────────────┘
   └─ "Fix it for me" ─▶ POST /api/fix ─▶ AI writes the change ─▶ branch + commit + pull request
```

| Folder | What it is |
|---|---|
| `extension/` | Chrome extension (Manifest V3, no build step). Adds the button on GitHub and shows the report and fix buttons |
| `server/` | Node + TypeScript API: GitHub access, built-in checks, Claude review and fixes |
| `scripts/make-icons.mjs` | Regenerates the extension icons |

## Run it locally

**1. Server**

```bash
cd server
npm install
cp .env.example .env      # add your ANTHROPIC_API_KEY
npm run dev               # http://localhost:8787
npm test                  # built-in check tests
```

**2. Extension**

1. Open `chrome://extensions` and turn on **Developer mode**.
2. Click **Load unpacked** and pick the `extension/` folder.
3. The settings page opens. Paste a **fine-grained GitHub token** with access to the repos you want to scan and these permissions:
   - **Contents: Read and write** (to read code and push fix branches)
   - **Pull requests: Read and write** (to open fix pull requests)
4. Open any of those repos on github.com and click **🚀 Scan before launch** (bottom right).

## What it checks

**Built-in checks** are fast, free and never make things up:
- Committed `.env` files
- Hardcoded secrets: Stripe, OpenAI, Anthropic, AWS, GitHub and Slack tokens, private keys, Supabase `service_role`
- Firebase rules that allow everyone (`allow read, write: if true`)
- Supabase tables with Row Level Security turned off
- Missing `.gitignore`

**AI review (Claude)** covers missing auth and ownership checks, payment and webhook bugs, crashes on important paths, data leaks, broken config and more. It is told to report only problems it can point to in the code.

## Safety

- Fixes are **always pull requests**, never direct pushes, so nothing changes until you merge.
- The fix step refuses to touch `.git/`, `.github/workflows/` or paths outside the repo.
- The GitHub token stays in the browser (`chrome.storage.local`). It is sent with each request and never stored on the server.
- The server only accepts requests from `chrome-extension://` origins. Set `ALLOWED_ORIGINS` to your published extension ID in production.

## Costs

Each scan sends up to `MAX_SCAN_CHARS` (default 400k characters, about 100k tokens) of the most relevant files to Claude. At current prices that is roughly **$0.40–$1 per full scan** and a few cents to about $0.50 per fix, depending on repo size. The server has a simple daily limit per token (10 scans and 30 fixes); replace it with real plan limits before launch.

## Roadmap to a paid product

- [ ] **GitHub App** instead of personal tokens: one-click install, and users pick repos
- [ ] **Accounts + Stripe billing**: 1 free scan, then a monthly plan (for example $19/month for 10 scans and unlimited fixes)
- [ ] Usage limits stored in a database instead of memory
- [ ] Scan history and re-scan to confirm fixes (✅ after merge)
- [ ] Run `npm audit` / OSV for vulnerable dependencies
- [ ] Build check: install and build the project in a sandbox
- [ ] Deploy the server (Cloud Run, Fly.io or Railway) and publish to the Chrome Web Store
