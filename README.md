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
| `extension/` | Chrome extension (Manifest V3). The popup, settings and report pages are React, built with Vite. `extension/public/` holds the manifest, icons and the GitHub button script |
| `server/` | Node + TypeScript API: GitHub access, built-in checks, Claude review and fixes |
| `web/` | The landing page and privacy policy (React + Vite). Deploy on Cloudflare Pages |
| `scripts/make-icons.mjs` | Regenerates the extension icons (into `extension/public/icons`) |

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

```bash
cd extension
npm install
npm run build     # writes extension/dist; use `npm run dev` to rebuild on every change
npm test          # page and helper tests
```

1. Open `chrome://extensions` and turn on **Developer mode**.
2. Click **Load unpacked** and pick the **`extension/dist/`** folder. After each rebuild, click the reload icon on the extension card.
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
| Scans | 3 (lifetime), built-in checks only | 10 per billing period, with the AI review |
| Fixes (pull requests) | 2 (lifetime) | 25 per billing period |

The AI review is the part that costs money, so free scans run only the built-in checks and the dependency check. Limits are env vars (`FREE_SCANS`, `PRO_FIXES_PER_PERIOD`, and so on). For local development set `FREE_AI_REVIEW=1` so free accounts get the AI review too. A scan or fix that fails is refunded. Past-due subscriptions keep access while Stripe retries the payment.

## Credits (pay as you go)

Credits let people use the AI review without a subscription, and let Pro users go past their monthly allowance. An AI scan costs 5 credits and a fix costs 2 (`CREDITS_PER_SCAN`, `CREDITS_PER_FIX`).

- **Order of use:** a Pro allowance is used first, then credits. A free account with credits gets the AI review on its next scan (5 credits). A free account without credits gets the free built-in checks.
- Credits never expire. A failed scan or fix gives its credits back. A fix that runs but makes no change is not refunded, because the AI cost was spent.
- Purchases are one-time Stripe Checkout payments. The webhook adds the credits once per checkout session, so retries can't double-grant.
- **Refunds:** refunding a credit purchase in Stripe does not remove the credits. Adjust the balance by hand (insert a negative row into `credit_ledger`) if that matters.

To sell packs, create a **one-time Price** in Stripe for each pack and list them in `CREDIT_PACKS` (`price_id:credits`, comma-separated). The extension reads names and prices from Stripe, so there is nothing to change in the extension. Pricing tip: Stripe's 20p fixed fee makes packs under about £5 unprofitable, and one AI scan costs you roughly $0.25-0.60, so price a scan at well above that. Suggested starting point: 25 credits for £7, 60 credits for £15, 150 credits for £30.

## Stripe setup

1. In the Stripe Dashboard (test mode first) create a **Product** with a **recurring monthly Price** (for example $19). Copy the price ID (`price_...`).
2. Copy your secret key (`sk_test_...`) from **Developers > API keys**.
3. Add a webhook endpoint pointing at `https://YOUR-SERVER/webhooks/stripe` for these events: `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, and, if you sell credits, `checkout.session.async_payment_succeeded`. Copy its signing secret (`whsec_...`).
4. Turn on the **Customer portal** (Settings > Billing > Customer portal) so people can cancel and update cards.
5. Put the values in `server/.env`: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_ID`, and `PUBLIC_URL` (the server's public address).

Test locally with the [Stripe CLI](https://stripe.com/docs/stripe-cli):

```bash
stripe listen --forward-to localhost:8787/webhooks/stripe   # prints the whsec_... to use
# then click Upgrade in the extension and pay with card 4242 4242 4242 4242
```

Without the three Stripe variables the server still runs. The Upgrade buttons are hidden and only the free limits apply (set `FREE_AI_REVIEW=1` to try the AI review locally).

Billing API: `GET /api/me` (plan, usage, credits and packs), `POST /api/billing/checkout`, `POST /api/billing/credits`, `POST /api/billing/portal`, `POST /webhooks/stripe`. Scan history: `GET /api/history?owner=&repo=` and `GET /api/scans/:id`.

## Landing page (Cloudflare Pages)

`web/` is a small React site: landing page, pricing and a privacy policy (`/privacy.html`, which the Chrome Web Store asks for). Edit prices, the store link and your contact email in `web/src/config.js`.

```bash
cd web && npm install && npm run dev   # preview locally
npm test                               # page tests
```

On Cloudflare Pages, connect this repo and set **Root directory** `web`, **Build command** `npm run build`, **Build output directory** `dist`.

## Deploying the server

`server/Dockerfile` builds the API. Run it anywhere that gives you HTTPS and a **persistent disk** (Fly.io, Railway, Render, a VPS), and mount the disk at `/data` because the SQLite database lives there (`DATABASE_PATH`). Run a single instance, since usage limits are counted in that one database. Set `ANTHROPIC_API_KEY`, the Stripe variables, `PUBLIC_URL` and `ALLOWED_ORIGINS=chrome-extension://<your extension id>`. Then enter the server URL in the extension settings (or change `DEFAULT_SERVER` in `extension/lib.js` before publishing).

## Costs

The server records the real token usage and estimated dollar cost of every AI call. Run `npm run costs` in `server/` to see the average and maximum cost per scan and fix, and the most expensive users.

Each scan sends up to `MAX_SCAN_CHARS` (default 250k characters, about 60k tokens) of the most relevant files to Claude. At current prices that is roughly **$0.12–$0.30 per full scan** with the default Sonnet 5.5 model at medium effort (`AI_MODEL`, `AI_EFFORT`) (about double that on Opus 5.5) and a few cents to about $0.15 per fix (estimates; `npm run costs` shows the real numbers), depending on repo size. The plan limits above keep usage within what a subscription pays for.

## Done and still to do

- [x] Accounts (by GitHub identity) and Stripe subscriptions: checkout, customer portal and webhooks
- [x] Credit packs (one-time purchases) for pay-as-you-go use
- [x] Usage limits stored in a database, per plan and billing period
- [x] Scan history, and "no longer reported" after a re-scan
- [x] Dependency check against OSV.dev (npm `package-lock.json`)
- [x] Dockerfile for deployment
- [ ] **GitHub App** instead of personal tokens (one-click install, pick repos). This needs an app registered under your GitHub account, so it is left for you
- [ ] Build check: install and build the project in a sandbox
- [ ] Dependency check for yarn, pnpm and Python lockfiles
- [ ] Publish to the Chrome Web Store (needs a privacy policy and store listing)
