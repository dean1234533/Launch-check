// Adds a "Scan before launch" button to GitHub repository pages.
// GitHub navigates without full page loads, so re-check whenever the URL changes.
(() => {
  const BUTTON_ID = "launch-check-button";
  const reserved = ["settings", "orgs", "marketplace", "explore", "notifications", "topics", "sponsors", "login", "new"];

  function safeDecode(text) {
    try {
      return decodeURIComponent(text);
    } catch {
      return text;
    }
  }

  function currentRepo() {
    const [owner, repo, kind, ...rest] = location.pathname.split("/").filter(Boolean);
    if (!owner || !repo || reserved.includes(owner)) return null;
    // Only real repo pages have this meta tag.
    if (!document.querySelector('meta[name="octolytics-dimension-repository_nwo"]')) return null;
    // On /tree/<branch>/<folder> and /blob/<branch>/<file> pages the rest of the path may include a folder or
    // file after the branch; the server works out where the branch name ends.
    const onBranchPage = (kind === "tree" || kind === "blob") && rest.length;
    return { owner, repo, branch: onBranchPage ? safeDecode(rest.join("/")) : undefined };
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
    button.textContent = "Scan before launch";
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
