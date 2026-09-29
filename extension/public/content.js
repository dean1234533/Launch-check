// Adds a "Scan before launch" button to GitHub repository pages.
// GitHub navigates without full page loads, so re-check whenever the URL changes.
(() => {
  const BUTTON_ID = "launch-check-button";
  const reserved = ["settings", "orgs", "marketplace", "explore", "notifications", "topics", "sponsors", "login", "new"];

  function currentRepo() {
    const [owner, repo, kind, ...rest] = location.pathname.split("/").filter(Boolean);
    if (!owner || !repo || reserved.includes(owner)) return null;
    // Only real repo pages have this meta tag.
    if (!document.querySelector('meta[name="octolytics-dimension-repository_nwo"]')) return null;
    return { owner, repo, branch: kind === "tree" && rest.length ? rest.join("/") : undefined };
  }

  function ensureButton() {
    const repo = currentRepo();
    const existing = document.getElementById(BUTTON_ID);
    if (!repo) {
      existing?.remove();
      return;
    }
    if (existing) {
      existing.dataset.repo = JSON.stringify(repo);
      return;
    }
    const button = document.createElement("button");
    button.id = BUTTON_ID;
    button.type = "button";
    button.textContent = "🚀 Scan before launch";
    button.dataset.repo = JSON.stringify(repo);
    button.addEventListener("click", () => {
      chrome.runtime.sendMessage({ type: "open-report", ...JSON.parse(button.dataset.repo) });
    });
    document.body.append(button);
  }

  let lastUrl = "";
  const check = () => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      ensureButton();
    }
  };
  new MutationObserver(check).observe(document.documentElement, { childList: true, subtree: true });
  document.addEventListener("turbo:load", ensureButton);
  ensureButton();
})();
