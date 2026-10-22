# Publish checklist

1. [ ] Finish testing: a full AI scan works and credits and history survive a redeploy (they live in the Worker's Durable Object).
2. [ ] Deploy `web/` to Cloudflare Pages (root directory `web`, build `npm run build`, output `dist`).
3. [ ] Set `contactEmail` in `web/src/config.js`, push, and confirm `/privacy.html` loads.
4. [ ] Register at https://chrome.google.com/webstore/devconsole (one-time fee, separate from Google Play).
5. [ ] Click **New item** and upload `quick-scan-first-0.4.0.zip`.
6. [ ] Fill in the Store listing, Privacy and Distribution tabs from `listing.md`.
7. [ ] Add screenshots and the 440x280 promo tile.
8. [ ] Submit for review. Choose **Unlisted** first if you want to test with a few people.
9. [ ] After approval, copy the extension ID and set `ALLOWED_ORIGINS` to `chrome-extension://<id>` in `server/wrangler.jsonc`, then run `npm run deploy` in `server/`.
10. [ ] Put the store link in `web/src/config.js` (`storeUrl`) so the landing page button goes live.

To release an update: bump `version` in `extension/public/manifest.json`, run `npm run build` in `extension/`, zip the contents of `dist/`, and upload it as a new version.
