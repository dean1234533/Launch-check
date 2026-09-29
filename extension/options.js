import { DEFAULT_SERVER, el, getAccount, getSettings, openBilling, planLine } from "./lib.js";

const token = document.getElementById("token");
const server = document.getElementById("server");
const status = document.getElementById("status");

const settings = await getSettings();
token.value = settings.githubToken;
server.value = settings.serverUrl === DEFAULT_SERVER ? "" : settings.serverUrl;

document.getElementById("save").addEventListener("click", async () => {
  status.className = "muted";
  let serverUrl = server.value.trim().replace(/\/+$/, "") || DEFAULT_SERVER;
  try {
    const url = new URL(serverUrl);
    const local = ["localhost", "127.0.0.1"].includes(url.hostname);
    if (!local && url.protocol !== "https:") throw new Error("The server URL must use https://");
    // Remote servers need an extra permission, which Chrome asks the user to approve.
    if (!local) {
      const granted = await chrome.permissions.request({ origins: [`${url.origin}/*`] });
      if (!granted) throw new Error("Permission to contact the server was not granted.");
    }
    serverUrl = url.origin + url.pathname.replace(/\/+$/, "");
  } catch (err) {
    status.className = "error";
    status.textContent = err instanceof TypeError ? "Enter a valid server URL." : err.message;
    return;
  }
  await chrome.storage.local.set({ githubToken: token.value.trim(), serverUrl });
  status.textContent = "Saved ✓";
});

async function showPlan() {
  const plan = document.getElementById("plan");
  const actions = document.getElementById("plan-actions");
  actions.replaceChildren();
  try {
    const account = await getAccount();
    plan.textContent = `${account.login}: ${planLine(account)}`;
    if (account.billingEnabled) {
      actions.append(
        el(
          "button",
          { class: account.plan === "pro" ? "" : "primary", onclick: () => openBilling(account.plan === "pro" ? "portal" : "checkout").catch((e) => (plan.textContent = e.message)) },
          account.plan === "pro" ? "Manage billing" : "Upgrade to Pro",
        ),
      );
    }
  } catch (err) {
    plan.textContent = settings.githubToken ? err.message : "Save your token to see your plan.";
  }
}
await showPlan();
document.getElementById("save").addEventListener("click", () => setTimeout(showPlan, 300));
