import { DEFAULT_SERVER, getSettings } from "./lib.js";

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
