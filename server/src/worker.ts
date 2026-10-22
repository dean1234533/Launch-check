import { DurableObject } from "cloudflare:workers";
import type { Hono } from "hono";
import { configureAi } from "./ai.js";
import { createApp } from "./app.js";
import { makeStripe } from "./billing.js";
import { loadConfig } from "./config.js";
import { durableObjectDb, SCHEMA } from "./db.js";

/** Secrets are set with `wrangler secret put`; everything else is a plain var in wrangler.jsonc. */
export type Bindings = Env & Record<string, string | DurableObjectNamespace | undefined>;

/**
 * Holds the whole database (accounts, credits, scan history) in the Durable Object's built-in SQLite
 * and serves the API. SQLite access is synchronous here, so a check-then-write (like reserving a scan) can't interleave.
 */
export class LaunchCheck extends DurableObject<Bindings> {
  private app: Hono;

  constructor(ctx: DurableObjectState, env: Bindings) {
    super(ctx, env);
    ctx.blockConcurrencyWhile(async () => {
      ctx.storage.sql.exec(SCHEMA);
    });
    const vars = env as Record<string, string | undefined>;
    const config = loadConfig(vars);
    configureAi({ apiKey: vars.ANTHROPIC_API_KEY, model: vars.AI_MODEL, effort: vars.AI_EFFORT });
    const stripe = makeStripe(config);
    if (!stripe) console.warn("Stripe is not configured (STRIPE_SECRET_KEY / STRIPE_WEBHOOK_SECRET / STRIPE_PRICE_ID): upgrades are disabled.");
    this.app = createApp({ db: durableObjectDb(ctx.storage.sql), config, stripe });
  }

  override async fetch(request: Request): Promise<Response> {
    return this.app.fetch(request);
  }
}

export default {
  async fetch(request: Request, env: Bindings): Promise<Response> {
    // One global database, so every request goes to the same named instance.
    return env.LAUNCH_CHECK.getByName("main").fetch(request);
  },
} satisfies ExportedHandler<Bindings>;
