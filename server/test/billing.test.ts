import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import Stripe from "stripe";
import { createApp } from "../src/app.js";
import { applyStripeEvent } from "../src/billing.js";
import { loadConfig } from "../src/config.js";
import { openDb } from "../src/db.js";
import { addCredits, creditBalance } from "../src/credits.js";
import { estimateCostUsd } from "../src/cost.js";
import { planOf, recordAiCall, reserve, usageCounts, QuotaError } from "../src/plans.js";
import { getUser, upsertUser } from "../src/users.js";

const config = loadConfig({
  STRIPE_SECRET_KEY: "sk_test_x",
  STRIPE_WEBHOOK_SECRET: "whsec_test",
  STRIPE_PRICE_ID: "price_x",
  FREE_SCANS: "1",
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
    reserve(db, config, user, "scans").refund();
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

describe("cost tracking", () => {
  it("prices a call from its token counts and stores it", () => {
    const usage = { model: "claude-opus-5-5", inputTokens: 100_000, outputTokens: 10_000, cacheReadTokens: 0, cacheWriteTokens: 0 };
    assert.ok(Math.abs(estimateCostUsd(usage) - 0.6) < 1e-9); // $0.40 in + $0.20 out
    const db = openDb(":memory:");
    upsertUser(db, 1, "octo");
    recordAiCall(db, 1, "scans", usage);
    const row = db.prepare("SELECT COUNT(*) AS n, SUM(cost_usd) AS c FROM ai_calls").get() as { n: number; c: number };
    assert.equal(row.n, 1);
    assert.ok(Math.abs(row.c - 0.6) < 1e-9);
  });
  it("defaults to a static-only free tier and a 25-fix Pro cap", () => {
    const d = loadConfig({} as NodeJS.ProcessEnv);
    assert.equal(d.freeAiReview, false);
    assert.equal(d.limits.pro.fixes, 25);
    assert.equal(d.maxScanChars, 250_000);
  });
});

describe("credits", () => {
  const withPacks = loadConfig({ FREE_SCANS: "1", FREE_FIXES: "1", CREDIT_PACKS: "price_a:20,bad,price_b:x" } as NodeJS.ProcessEnv);

  it("parses credit packs from the environment and ignores malformed ones", () => {
    assert.deepEqual(withPacks.creditPacks, [{ priceId: "price_a", credits: 20 }]);
  });

  it("gives free users a static scan first, and an AI scan once they have credits", () => {
    const db = openDb(":memory:");
    const user = upsertUser(db, 1, "octo");
    assert.equal(reserve(db, withPacks, user, "scans").aiReview, false); // free allowance, static only
    assert.throws(() => reserve(db, withPacks, user, "scans"), (e) => e instanceof QuotaError && e.status === 402);
    addCredits(db, 1, 12, "purchase", "cs_1");
    const r = reserve(db, withPacks, user, "scans");
    assert.equal(r.source, "credits");
    assert.equal(r.aiReview, true);
    assert.equal(creditBalance(db, 1), 7); // 12 - 5
    r.refund();
    assert.equal(creditBalance(db, 1), 12);
  });

  it("uses credits for fixes only after the plan allowance, and refuses when neither is left", () => {
    const db = openDb(":memory:");
    const user = upsertUser(db, 1, "octo");
    assert.equal(reserve(db, withPacks, user, "fixes").source, "plan");
    assert.throws(() => reserve(db, withPacks, user, "fixes"), QuotaError);
    addCredits(db, 1, 3, "purchase", "cs_1");
    assert.equal(reserve(db, withPacks, user, "fixes").source, "credits");
    assert.equal(creditBalance(db, 1), 1); // 3 - 2
    assert.throws(() => reserve(db, withPacks, user, "fixes"), QuotaError); // 1 credit < 2
  });

  it("lets pro users fall back to credits after their allowance", () => {
    const db = openDb(":memory:");
    upsertUser(db, 42, "octo");
    applyStripeEvent(db, subEvent("customer.subscription.created", {}));
    const user = getUser(db, 42)!;
    const t = user.periodStart! + 1000;
    for (let i = 0; i < 10; i++) assert.equal(reserve(db, withPacks, user, "scans", t + i).source, "plan");
    assert.throws(() => reserve(db, withPacks, user, "scans", t + 50), (e) => e instanceof QuotaError && e.status === 429);
    addCredits(db, 42, 5, "purchase", "cs_2");
    assert.equal(reserve(db, withPacks, user, "scans", t + 60).source, "credits");
  });

  it("grants credits once per paid checkout session and ignores replays", () => {
    const db = openDb(":memory:");
    upsertUser(db, 42, "octo");
    const event = {
      id: "evt_p", type: "checkout.session.completed", created: 1,
      data: { object: { id: "cs_9", mode: "payment", payment_status: "paid", customer: "cus_1", client_reference_id: "42", metadata: { kind: "credits", credits: "20", github_id: "42" } } },
    } as unknown as Stripe.Event;
    applyStripeEvent(db, event);
    applyStripeEvent(db, event);
    assert.equal(creditBalance(db, 42), 20);
    const unpaid = { ...event, data: { object: { ...(event.data.object as object), id: "cs_10", payment_status: "unpaid" } } } as unknown as Stripe.Event;
    applyStripeEvent(db, unpaid);
    assert.equal(creditBalance(db, 42), 20);
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
