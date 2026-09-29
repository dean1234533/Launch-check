import Stripe from "stripe";
import type { Config } from "./config.js";
import { addCredits } from "./credits.js";
import type { Db } from "./db.js";
import { planOf } from "./plans.js";
import { getUser, getUserByCustomer, saveSubscription, setCustomerId, type User } from "./users.js";

export function makeStripe(config: Config): Stripe | null {
  return config.stripe ? new Stripe(config.stripe.secretKey) : null;
}

/** Finds or creates the Stripe customer for this user, so repeat checkouts reuse one customer. */
async function ensureCustomer(stripe: Stripe, db: Db, user: User): Promise<string> {
  if (user.stripeCustomerId) return user.stripeCustomerId;
  const customer = await stripe.customers.create(
    { name: user.login, metadata: { github_id: String(user.githubId), github_login: user.login } },
    { idempotencyKey: `customer-github-${user.githubId}` },
  );
  setCustomerId(db, user.githubId, customer.id);
  return customer.id;
}

export class BillingError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export async function createCheckoutUrl(stripe: Stripe, db: Db, config: Config, user: User): Promise<string> {
  if (!config.stripe) throw new BillingError(503, "Billing isn't set up on this server.");
  if (planOf(user) === "pro") throw new BillingError(409, "You're already on Pro. Use Manage billing to change your plan.");
  const customer = await ensureCustomer(stripe, db, user);
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer,
    client_reference_id: String(user.githubId),
    line_items: [{ price: config.stripe.priceId, quantity: 1 }],
    allow_promotion_codes: true,
    subscription_data: { metadata: { github_id: String(user.githubId) } },
    success_url: `${config.publicUrl}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${config.publicUrl}/billing/cancel`,
  });
  if (!session.url) throw new BillingError(502, "Stripe did not return a checkout link. Please try again.");
  return session.url;
}

/** One-time purchase of a credit pack. The pack must be one the server is configured to sell. */
export async function createCreditCheckoutUrl(stripe: Stripe, db: Db, config: Config, user: User, priceId: string): Promise<string> {
  const pack = config.creditPacks.find((p) => p.priceId === priceId);
  if (!pack) throw new BillingError(400, "Unknown credit pack.");
  const customer = await ensureCustomer(stripe, db, user);
  const metadata = { github_id: String(user.githubId), credits: String(pack.credits), kind: "credits" };
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    customer,
    client_reference_id: String(user.githubId),
    line_items: [{ price: pack.priceId, quantity: 1 }],
    metadata,
    payment_intent_data: { metadata },
    success_url: `${config.publicUrl}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${config.publicUrl}/billing/cancel`,
  });
  if (!session.url) throw new BillingError(502, "Stripe did not return a checkout link. Please try again.");
  return session.url;
}

export interface PackInfo {
  id: string;
  credits: number;
  amount: number | null;
  currency: string | null;
}

const priceCache = new Map<string, { amount: number | null; currency: string | null; expires: number }>();

/** The packs for sale with their prices from Stripe (cached 10 minutes), so the extension never hard-codes prices. */
export async function listPacks(stripe: Stripe | null, config: Config): Promise<PackInfo[]> {
  return Promise.all(
    config.creditPacks.map(async (p) => {
      let hit = priceCache.get(p.priceId);
      if (!hit || hit.expires < Date.now()) {
        try {
          const price = await stripe!.prices.retrieve(p.priceId);
          hit = { amount: price.unit_amount, currency: price.currency, expires: Date.now() + 10 * 60 * 1000 };
        } catch {
          hit = { amount: null, currency: null, expires: Date.now() + 60 * 1000 };
        }
        priceCache.set(p.priceId, hit);
      }
      return { id: p.priceId, credits: p.credits, amount: hit.amount, currency: hit.currency };
    }),
  );
}

export async function createPortalUrl(stripe: Stripe, config: Config, user: User): Promise<string> {
  if (!user.stripeCustomerId) throw new BillingError(409, "There's no subscription to manage yet.");
  const session = await stripe.billingPortal.sessions.create({
    customer: user.stripeCustomerId,
    return_url: `${config.publicUrl}/billing/return`,
  });
  return session.url;
}

function customerId(c: string | Stripe.Customer | Stripe.DeletedCustomer | null): string | null {
  return typeof c === "string" ? c : (c?.id ?? null);
}

/** Copies a Stripe subscription onto the matching account. Returns false if no account matches. */
function syncSubscription(db: Db, sub: Stripe.Subscription, eventCreatedSeconds: number): boolean {
  const cust = customerId(sub.customer);
  const fromMeta = Number(sub.metadata?.github_id);
  const user = (cust && getUserByCustomer(db, cust)) || (Number.isInteger(fromMeta) ? getUser(db, fromMeta) : null);
  if (!user) return false;
  if (cust && !user.stripeCustomerId) setCustomerId(db, user.githubId, cust);

  // Billing period lives on the subscription item in current Stripe API versions.
  const item = sub.items?.data?.[0];
  saveSubscription(db, user.githubId, {
    subscriptionId: sub.id,
    status: sub.status,
    periodStart: item?.current_period_start ? item.current_period_start * 1000 : null,
    periodEnd: item?.current_period_end ? item.current_period_end * 1000 : null,
    cancelAtPeriodEnd: sub.cancel_at_period_end,
    eventAt: eventCreatedSeconds * 1000,
  });
  return true;
}

/** Applies one verified Stripe webhook event. Safe to run twice for the same event. */
export function applyStripeEvent(db: Db, event: Stripe.Event): void {
  switch (event.type) {
    case "checkout.session.async_payment_succeeded":
      grantCredits(db, event.data.object);
      break;
    case "checkout.session.completed": {
      const session = event.data.object;
      if (session.mode === "payment") {
        if (session.payment_status === "paid") grantCredits(db, session); // async methods are granted on async_payment_succeeded
        break;
      }
      const cust = customerId(session.customer);
      const githubId = Number(session.client_reference_id);
      // Link the customer up front; the subscription events that follow carry the status.
      if (cust && Number.isInteger(githubId) && getUser(db, githubId) && !getUserByCustomer(db, cust)) {
        setCustomerId(db, githubId, cust);
      }
      break;
    }
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted":
      if (!syncSubscription(db, event.data.object, event.created)) {
        // Throwing makes Stripe retry, which covers a subscription event arriving before the account link exists.
        throw new Error(`No account for subscription ${event.data.object.id}`);
      }
      break;
    default:
      break; // Events we don't subscribe to are acknowledged and ignored.
  }
}

/** Adds the purchased credits to the account. The session id makes it safe to run twice. */
function grantCredits(db: Db, session: Stripe.Checkout.Session): void {
  if (session.metadata?.kind !== "credits") return;
  const githubId = Number(session.client_reference_id);
  const credits = Number(session.metadata.credits);
  if (!Number.isInteger(githubId) || !Number.isInteger(credits) || credits <= 0) throw new Error(`Bad credit purchase ${session.id}`);
  if (!getUser(db, githubId)) throw new Error(`No account for credit purchase ${session.id}`); // Stripe retries
  addCredits(db, githubId, credits, "purchase", session.id);
}
