/** All environment-driven settings, read in one place so tests can override them. */
export interface Config {
  port: number;
  maxScanChars: number;
  allowedOrigins: string[];
  databasePath: string;
  /** Public base URL of this server, used for Stripe return pages. */
  publicUrl: string;
  stripe: { secretKey: string; webhookSecret: string; priceId: string } | null;
  limits: {
    free: { scans: number; fixes: number };
    pro: { scans: number; fixes: number };
  };
}

function int(value: string | undefined, fallback: number): number {
  const n = Number(value);
  return value && Number.isFinite(n) && n >= 0 ? Math.floor(n) : fallback;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const port = int(env.PORT, 8787);
  const { STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, STRIPE_PRICE_ID } = env;
  return {
    port,
    maxScanChars: int(env.MAX_SCAN_CHARS, 400_000),
    allowedOrigins: (env.ALLOWED_ORIGINS ?? "").split(",").map((s) => s.trim()).filter(Boolean),
    databasePath: env.DATABASE_PATH || "data/launch-check.db",
    publicUrl: (env.PUBLIC_URL || `http://localhost:${port}`).replace(/\/+$/, ""),
    stripe:
      STRIPE_SECRET_KEY && STRIPE_WEBHOOK_SECRET && STRIPE_PRICE_ID
        ? { secretKey: STRIPE_SECRET_KEY, webhookSecret: STRIPE_WEBHOOK_SECRET, priceId: STRIPE_PRICE_ID }
        : null,
    limits: {
      // Free: lifetime allowance. Pro: allowance per billing period.
      free: { scans: int(env.FREE_SCANS, 1), fixes: int(env.FREE_FIXES, 2) },
      pro: { scans: int(env.PRO_SCANS_PER_PERIOD, 10), fixes: int(env.PRO_FIXES_PER_PERIOD, 100) },
    },
  };
}
