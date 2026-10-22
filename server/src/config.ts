/** All environment-driven settings, read in one place so tests can override them. On Cloudflare they come from the Worker's vars and secrets. */
export interface Config {
  maxScanChars: number;
  /** Scans plus fixes one account may start per hour (failed ones are refunded, so this stops loops of bad requests). */
  rateLimitPerHour: number;
  /** Let free accounts get the (paid-for) AI review. Off in production; handy for local development. */
  freeAiReview: boolean;
  allowedOrigins: string[];
  /** Public base URL of this server, used for Stripe return pages. */
  publicUrl: string;
  stripe: { secretKey: string; webhookSecret: string; priceId: string } | null;
  /** One-time credit packs sold through Stripe Checkout (each is a Stripe Price). */
  creditPacks: Array<{ priceId: string; credits: number }>;
  /** What one AI scan / one fix costs in credits. */
  creditCosts: { scan: number; fix: number };
  limits: {
    free: { scans: number; fixes: number };
    pro: { scans: number; fixes: number };
  };
}

function int(value: string | undefined, fallback: number): number {
  const n = Number(value);
  return value && Number.isFinite(n) && n >= 0 ? Math.floor(n) : fallback;
}

export function loadConfig(env: Record<string, string | undefined>): Config {
  const { STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, STRIPE_PRICE_ID } = env;
  return {
    maxScanChars: int(env.MAX_SCAN_CHARS, 250_000),
    rateLimitPerHour: int(env.RATE_LIMIT_PER_HOUR, 30),
    freeAiReview: env.FREE_AI_REVIEW === "1",
    allowedOrigins: (env.ALLOWED_ORIGINS ?? "").split(",").map((s) => s.trim()).filter(Boolean),
    publicUrl: (env.PUBLIC_URL || "http://localhost:8787").replace(/\/+$/, ""),
    stripe:
      STRIPE_SECRET_KEY && STRIPE_WEBHOOK_SECRET && STRIPE_PRICE_ID
        ? { secretKey: STRIPE_SECRET_KEY, webhookSecret: STRIPE_WEBHOOK_SECRET, priceId: STRIPE_PRICE_ID }
        : null,
    creditPacks: (env.CREDIT_PACKS ?? "")
      .split(",")
      .map((s) => s.trim().split(":"))
      .filter(([id, n]) => id && Number.isInteger(Number(n)) && Number(n) > 0)
      .map(([priceId, n]) => ({ priceId, credits: Number(n) })),
    creditCosts: { scan: int(env.CREDITS_PER_SCAN, 5), fix: int(env.CREDITS_PER_FIX, 2) },
    limits: {
      // Free: lifetime allowance (scans are static-only, so they cost nothing). Pro: allowance per billing period.
      free: { scans: int(env.FREE_SCANS, 3), fixes: int(env.FREE_FIXES, 2) },
      pro: { scans: int(env.PRO_SCANS_PER_PERIOD, 10), fixes: int(env.PRO_FIXES_PER_PERIOD, 25) },
    },
  };
}
