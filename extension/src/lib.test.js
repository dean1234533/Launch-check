import { describe, expect, it } from "vitest";
import { packLabel, parseRepoUrl, planLine, safeHttpsUrl } from "./lib.js";

describe("parseRepoUrl", () => {
  it("reads owner, repo and branch from GitHub URLs", () => {
    expect(parseRepoUrl("https://github.com/a/b")).toEqual({ owner: "a", repo: "b", branch: undefined });
    expect(parseRepoUrl("https://github.com/a/b.git/tree/feat/x")).toEqual({ owner: "a", repo: "b", branch: "feat/x" });
  });
  it("reads the branch from file pages too", () => {
    expect(parseRepoUrl("https://github.com/a/b/blob/main/src/x.js")).toEqual({ owner: "a", repo: "b", branch: "main/src/x.js" });
  });
  it("ignores non-repo pages", () => {
    expect(parseRepoUrl("https://github.com/settings/profile")).toBeNull();
    expect(parseRepoUrl("https://example.com/a/b")).toBeNull();
  });
});

describe("planLine and packLabel", () => {
  const base = { limits: { scans: 3 }, remaining: { scans: 2 }, credits: 0 };
  it("describes free and pro plans, with credits when there are any", () => {
    expect(planLine({ ...base, plan: "free" })).toBe("Free · 2 of 3 scans left");
    expect(planLine({ ...base, plan: "free", credits: 12 })).toContain("12 credits");
    expect(planLine({ ...base, plan: "pro", limits: { scans: 10 }, remaining: { scans: 7 }, periodEnd: null })).toBe("Pro · 7 of 10 scans left this period");
  });
  it("formats a pack with its price", () => {
    expect(packLabel({ credits: 25, amount: 700, currency: "gbp" })).toBe("Buy 25 credits · £7.00");
    expect(packLabel({ credits: 25, amount: null, currency: null })).toBe("Buy 25 credits");
  });
});

describe("safeHttpsUrl", () => {
  it("accepts https links only", () => {
    expect(safeHttpsUrl("https://github.com/a/b/pull/3")).toBe("https://github.com/a/b/pull/3");
    expect(safeHttpsUrl("javascript:alert(1)")).toBeNull();
    expect(safeHttpsUrl("http://example.com")).toBeNull();
    expect(safeHttpsUrl("data:text/html,x")).toBeNull();
    expect(safeHttpsUrl("not a url")).toBeNull();
    expect(safeHttpsUrl(undefined)).toBeNull();
  });
});
