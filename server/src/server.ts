import { createApp } from "./app.js";
import { makeStripe } from "./billing.js";
import { loadConfig } from "./config.js";
import { openDb } from "./db.js";

const config = loadConfig();
const db = openDb(config.databasePath);
const stripe = makeStripe(config);

if (!stripe) console.warn("Stripe is not configured (STRIPE_SECRET_KEY / STRIPE_WEBHOOK_SECRET / STRIPE_PRICE_ID): upgrades are disabled.");

const server = createApp({ db, config, stripe }).listen(config.port, () => {
  console.log(`Launch Check API listening on http://localhost:${config.port}`);
});

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    server.close(() => {
      db.close();
      process.exit(0);
    });
  });
}
