import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { installChrome } from "../test-setup.js";

const issue = {
  id: "open-rules", severity: "critical", category: "security", title: "Database is open to everyone",
  explanation: "Anyone can read your data.", files: ["firestore.rules"], line: 3, fixPrompt: "Lock down firestore.rules",
};
const scan = {
  owner: "a", repo: "b", branch: "main", commitSha: "abcdef123456", scannedFiles: 4, truncated: false,
  issues: [issue], summary: "Not ready.", aiReview: false, resolved: [{ id: "old", title: "Old problem", severity: "warning" }],
  account: { login: "octo", plan: "free", limits: { scans: 3, fixes: 2 }, remaining: { scans: 2, fixes: 2 }, credits: 0, billingEnabled: true },
};
const accountWithPacks = { ...scan.account, packs: [{ id: "price_1", credits: 25, amount: 700, currency: "gbp" }] };

function mockServer(handlers) {
  globalThis.fetch = vi.fn(async (url, init) => {
    const path = new URL(url).pathname;
    const h = handlers[path];
    if (!h) return Response.json({ error: `unexpected ${path}` }, { status: 500 });
    const { status = 200, body } = h(init);
    return Response.json(body, { status });
  });
}

async function renderApp(search = "?owner=a&repo=b&scan=1") {
  history.replaceState(null, "", search);
  vi.resetModules();
  const { App } = await import("./App.jsx");
  return render(<App />);
}

beforeEach(() => {
  installChrome({ githubToken: "tok", serverUrl: "http://localhost:8787" });
});

describe("report page", () => {
  it("scans, shows the issues, the free-tier upsell and what got resolved", async () => {
    mockServer({ "/api/scan": () => ({ body: scan }), "/api/me": () => ({ body: accountWithPacks }) });
    await renderApp();
    expect(await screen.findByText("Database is open to everyone")).toBeTruthy();
    expect(screen.getByText(/Get the full AI code review/)).toBeTruthy();
    expect(screen.getByText(/no longer show up/)).toBeTruthy();
    expect(await screen.findByRole("button", { name: /Buy 25 credits/ })).toBeTruthy();
    expect(chrome.storage.local.set).toHaveBeenCalled(); // report saved for the popup
  });

  it("does not say 'ready to launch' when only the built-in checks ran", async () => {
    mockServer({ "/api/scan": () => ({ body: { ...scan, issues: [], resolved: [] } }), "/api/me": () => ({ body: accountWithPacks }) });
    await renderApp();
    expect(await screen.findByText("No obvious problems found")).toBeTruthy();
    expect(screen.getByText(/AI review has not run/)).toBeTruthy();
    expect(screen.queryByText(/Looks ready to launch/)).toBeNull();
  });

  it("still says ready to launch after a clean AI review", async () => {
    mockServer({ "/api/scan": () => ({ body: { ...scan, issues: [], resolved: [], aiReview: true } }), "/api/me": () => ({ body: accountWithPacks }) });
    await renderApp();
    expect(await screen.findByText(/Looks ready to launch/)).toBeTruthy();
  });

  it("shows an upgrade prompt with credit packs when the scan is over the limit", async () => {
    mockServer({
      "/api/scan": () => ({ status: 402, body: { error: "You've used your free scans.", code: "upgrade_required" } }),
      "/api/me": () => ({ body: accountWithPacks }),
    });
    await renderApp();
    expect(await screen.findByText("Upgrade to keep scanning")).toBeTruthy();
    expect(await screen.findByRole("button", { name: /Buy 25 credits/ })).toBeTruthy();
    expect(screen.queryByText("Try again")).toBeNull();
  });

  it("opens a pull request from the Fix button and shows the link", async () => {
    mockServer({
      "/api/scan": () => ({ body: { ...scan, aiReview: true, resolved: [] } }),
      "/api/me": () => ({ body: accountWithPacks }),
      "/api/fix": () => ({ body: { status: "pr_opened", pullRequestUrl: "https://github.com/a/b/pull/7", number: 7, manualSteps: ["Rotate the key"] } }),
    });
    await renderApp();
    await userEvent.click(await screen.findByRole("button", { name: /Fix it for me/ }));
    await waitFor(() => expect(screen.getByText("Pull request #7").getAttribute("href")).toBe("https://github.com/a/b/pull/7"));
    expect(screen.getByText("Rotate the key")).toBeTruthy();
  });

  it("shows the saved report without scanning when reopened", async () => {
    installChrome({ githubToken: "tok", "report:a/b": { ...scan, resolved: [], scannedAt: Date.now(), fixes: {} } });
    mockServer({ "/api/me": () => ({ body: accountWithPacks }) });
    await renderApp("?owner=a&repo=b");
    expect(await screen.findByText("Database is open to everyone")).toBeTruthy();
    expect(fetch).not.toHaveBeenCalledWith(expect.stringContaining("/api/scan"), expect.anything());
  });
});
