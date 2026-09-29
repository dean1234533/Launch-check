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

## Accounts and plans

There is no separate sign-up. The account is the GitHub user behind the token: the server looks the token up (`GET /user`), keeps a row for that GitHub ID in SQLite, and never stores the token.

| | Free | Pro |
|---|---|---|
| Scans | 1 (lifetime) | 10 per billing period |
| Fixes (pull requests) | 2 (lifetime) | 100 per billing period |

Limits are env vars (`FREE_SCANS`, `PRO_SCANS_PER_PERIOD`, and so on). A scan or fix that fails is refunded. Past-due subscriptions keep access while Stripe retries the payment.

## Stripe setup

1. In the Stripe Dashboard (test mode first) create a **Product** with a **recurring monthly Price** (for example $19). Copy the price ID (`price_...`).
2. Copy your secret key (`sk_test_...`) from **Developers > API keys**.
3. Add a webhook endpoint pointing at `https://YOUR-SERVER/webhooks/stripe` for these events: `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`. Copy its signing secret (`whsec_...`).
4. Turn on the **Customer portal** (Settings > Billing > Customer portal) so people can cancel and update cards.
5. Put the values in `server/.env`: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_ID`, and `PUBLIC_URL` (the server's public address).

Test locally with the [Stripe CLI](https://stripe.com/docs/stripe-cli):

```bash
stripe listen --forward-to localhost:8787/webhooks/stripe   # prints the whsec_... to use
# then click Upgrade in the extension and pay with card 4242 4242 4242 4242
```

Without the three Stripe variables the server still runs. The Upgrade buttons are hidden and only the free limits apply (raise them with `FREE_SCANS` while developing).

Billing API: `GET /api/me` (plan and usage), `POST /api/billing/checkout`, `POST /api/billing/portal`, `POST /webhooks/stripe`. Scan history: `GET /api/history?owner=&repo=` and `GET /api/scans/:id`.

## Deploying the server

`server/Dockerfile` builds the API. Run it anywhere that gives you HTTPS and a **persistent disk** (Fly.io, Railway, Render, a VPS), and mount the disk at `/data` because the SQLite database lives there (`DATABASE_PATH`). Run a single instance, since usage limits are counted in that one database. Set `ANTHROPIC_API_KEY`, the Stripe variables, `PUBLIC_URL` and `ALLOWED_ORIGINS=chrome-extension://<your extension id>`. Then enter the server URL in the extension settings (or change `DEFAULT_SERVER` in `extension/lib.js` before publishing).

## Costs

Each scan sends up to `MAX_SCAN_CHARS` (default 400k characters, about 100k tokens) of the most relevant files to Claude. At current prices that is roughly **$0.40–$1 per full scan** and a few cents to about $0.50 per fix, depending on repo size. The plan limits above keep usage within what a subscription pays for.

## Done and still to do

- [x] Accounts (by GitHub identity) and Stripe subscriptions: checkout, customer portal and webhooks
- [x] Usage limits stored in a database, per plan and billing period
- [x] Scan history, and "no longer reported" after a re-scan
- [x] Dependency check against OSV.dev (npm `package-lock.json`)
- [x] Dockerfile for deployment
- [ ] **GitHub App** instead of personal tokens (one-click install, pick repos). This needs an app registered under your GitHub account, so it is left for you
- [ ] Build check: install and build the project in a sandbox
- [ ] Dependency check for yarn, pnpm and Python lockfiles
- [ ] Publish to the Chrome Web Store (needs a privacy policy and store listing)
