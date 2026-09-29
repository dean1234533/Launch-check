import { useCallback, useEffect, useState } from "react";
import { buyCredits, getAccount, openBilling, packLabel, planLine } from "./lib.js";

/**
 * The signed-in user's plan, usage and credit packs. Reloads when the tab regains focus, so the
 * plan updates after paying in the Stripe tab. `merge` folds in the account returned by a scan.
 */
export function useAccount() {
  const [account, setAccount] = useState(null);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    try {
      setAccount(await getAccount());
      setError("");
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    refresh();
    const onVisible = () => !document.hidden && refresh();
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [refresh]);

  const merge = useCallback((next) => setAccount((prev) => ({ ...prev, ...next })), []);
  return { account, error, refresh, merge };
}

/** Opens Stripe Checkout or the billing portal, showing any failure in an alert. */
export function startBilling(kind) {
  return openBilling(kind).catch((err) => alert(err.message));
}

export function PackButtons({ account }) {
  if (!account?.packs?.length) return null;
  return (
    <div className="actions">
      {account.packs.map((p) => (
        <button key={p.id} onClick={() => buyCredits(p.id).catch((err) => alert(err.message))}>
          {packLabel(p)}
        </button>
      ))}
    </div>
  );
}

/** "Pro · 7 of 10 scans left" with an Upgrade / Manage billing link. */
export function AccountBar({ account }) {
  if (!account?.plan) return <div className="muted account-bar" />;
  return (
    <div className="muted account-bar">
      {planLine(account)}
      {account.billingEnabled && (
        <button className="link" onClick={() => startBilling(account.plan === "pro" ? "portal" : "checkout")}>
          {account.plan === "pro" ? "Manage billing" : "Upgrade"}
        </button>
      )}
    </div>
  );
}
