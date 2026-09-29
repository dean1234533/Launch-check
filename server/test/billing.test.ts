import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import Stripe from "stripe";
import { createApp } from "../src/app.js";
import { applyStripeEvent } from "../src/billing.js";
import { loadConfig } from "../src/config.js";
import { openDb } from "../src/db.js";
import { planOf, reserve, usageCounts, QuotaError } from "../src/plans.js";
import { getUser, upsertUser } from "../src/users.js";

const config = loadConfig({
  STRIPE_SECRET_KEY: "sk_test_x",
  STRIPE_WEBHOOK_SECRET: "whsec_test",
  STRIPE_PRICE_ID: "price_x",
} as NodeJS.ProcessEnv);

function subEvent(type: string, over: Record<string, unknown>, created = 1_700_000_000): Stripe.Event {
  return {
    id: `evt_${Math.random()}`,
    type,
    created,
    data: {
      object: {
        id: "sub_1",
        customer: "cus_1",
        status: "active",
        cancel_at_period_end: false,
        metadata: { github_id: "42" },
        items: { data: [{ current_period_start: 1_700_000_000, current_period_end: 1_702_600_000 }] },
        ...over,
      },
    },
  } as unknown as Stripe.Event;
}

describe("plans and quota", () => {
  it("gives free users one lifetime scan, then asks them to upgrade", () => {
    const db = openDb(":memory:");
    const user = upsertUser(db, 1, "octo");
    reserve(db, config, user, "scans");
    assert.throws(() => reserve(db, config, user, "scans"), (e) => e instanceof QuotaError && e.status === 402 && e.code === "upgrade_required");
  });

  it("refunds a reservation when the work fails", () => {
    const db = openDb(":memory:");
    const user = upsertUser(db, 1, "octo");
    reserve(db, config, user, "scans")();
    assert.equal(usageCounts(db, user).scans, 0);
    reserve(db, config, user, "scans"); // allowance is back
  });

  it("caps pro scans at the period limit and starts fresh next period", () => {
    const db = openDb(":memory:");
    upsertUser(db, 42, "octo");
    applyStripeEvent(db, subEvent("customer.subscription.created", {}));
    let user = getUser(db, 42)!;
    assert.equal(planOf(user), "pro");
    const start = user.periodStart!;
    for (let i = 0; i < 10; i++) reserve(db, config, user, "scans", start + 1000 + i);
    assert.throws(() => reserve(db, config, user, "scans", start + 5000), (e) => e instanceof QuotaError && e.status === 429);
    // Renewal: new period starts after the old usage.
    applyStripeEvent(db, subEvent("customer.subscription.updated", { items: { data: [{ current_period_start: 1_702_600_000, current_period_end: 1_705_200_000 }] } }, 1_702_600_000));
    user = getUser(db, 42)!;
    assert.equal(usageCounts(db, user, 1_702_600_000_000 + 1000).scans, 0);
  });
});

describe("stripe events", () => {
  it("downgrades on cancellation and ignores older out-of-order events", () => {
    const db = openDb(":memory:");
    upsertUser(db, 42, "octo");
    applyStripeEvent(db, subEvent("customer.subscription.created", {}, 1000));
    assert.equal(planOf(getUser(db, 42)!), "pro");
    applyStripeEvent(db, subEvent("customer.subscription.deleted", { status: "canceled" }, 3000));
    assert.equal(planOf(getUser(db, 42)!), "free");
    applyStripeEvent(db, subEvent("customer.subscription.updated", { status: "active" }, 2000)); // stale
    assert.equal(planOf(getUser(db, 42)!), "free");
  });

  it("keeps access while a payment is past due", () => {
    const db = openDb(":memory:");
    upsertUser(db, 42, "octo");
    applyStripeEvent(db, subEvent("customer.subscription.updated", { status: "past_due" }));
    assert.equal(planOf(getUser(db, 42)!), "pro");
  });

  it("links the customer on checkout completion, and errors for unknown accounts so Stripe retries", () => {
    const db = openDb(":memory:");
    upsertUser(db, 42, "octo");
    applyStripeEvent(db, {
      id: "evt_c", type: "checkout.session.completed", created: 1,
      data: { object: { customer: "cus_9", client_reference_id: "42", mode: "subscription" } },
    } as unknown as Stripe.Event);
    assert.equal(getUser(db, 42)!.stripeCustomerId, "cus_9");
    assert.throws(() => applyStripeEvent(db, subEvent("customer.subscription.created", { customer: "cus_x", metadata: {} })));
  });
});

describe("HTTP", () => {
  let server: Server;
  let base: string;
  const db = openDb(":memory:");
  const stripe = new Stripe("sk_test_x");

  before(async () => {
    const app = createApp({ db, config, stripe, resolveUser: async (t) => ({ id: t === "tok-a" ? 42 : 43, login: t }) });
    server = app.listen(0);
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });
  after(() => server.close());

  it("rejects webhooks with a bad signature", async () => {
    const res = await fetch(`${base}/webhooks/stripe`, { method: "POST", headers: { "stripe-signature": "nope", "content-type": "application/json" }, body: "{}" });
    assert.equal(res.status, 400);
  });

  it("accepts a correctly signed webhook and upgrades the account", async () => {
    await fetch(`${base}/api/me`, { headers: { authorization: "Bearer tok-a" } }); // creates the account
    const payload = JSON.stringify(subEvent("customer.subscription.created", {}, Math.floor(Date.now() / 1000)));
    const header = stripe.webhooks.generateTestHeaderString({ payload, secret: "whsec_test" });
    const res = await fetch(`${base}/webhooks/stripe`, { method: "POST", headers: { "stripe-signature": header, "content-type": "application/json" }, body: payload });
    assert.equal(res.status, 200);
    const me = await (await fetch(`${base}/api/me`, { headers: { authorization: "Bearer tok-a" } })).json();
    assert.equal(me.plan, "pro");
    assert.equal(me.remaining.scans, 10);
  });

  it("requires a token", async () => {
    assert.equal((await fetch(`${base}/api/me`)).status, 401);
  });

  it("returns 402 with an upgrade code once the free scan is used", async () => {
    const auth = { authorization: "Bearer tok-b", "content-type": "application/json" };
    // Use the only free scan directly, then hit the endpoint.
    reserve(db, config, upsertUser(db, 43, "tok-b"), "scans");
    const res = await fetch(`${base}/api/scan`, { method: "POST", headers: auth, body: JSON.stringify({ owner: "a", repo: "b" }) });
    assert.equal(res.status, 402);
    assert.equal((await res.json()).code, "upgrade_required");
  });
});
