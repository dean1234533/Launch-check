// Opens the report page when the "Scan before launch" button on GitHub is clicked.
chrome.runtime.onMessage.addListener((msg) => {
  if (msg?.type !== "open-report") return;
  const params = new URLSearchParams({ owner: msg.owner, repo: msg.repo, scan: "1" });
  if (msg.branch) params.set("branch", msg.branch);
  chrome.tabs.create({ url: chrome.runtime.getURL(`report.html?${params}`) });
});

chrome.runtime.onInstalled.addListener(async ({ reason }) => {
  if (reason === "install") chrome.runtime.openOptionsPage();
});
