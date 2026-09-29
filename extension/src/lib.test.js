import { describe, expect, it } from "vitest";
import { packLabel, parseRepoUrl, planLine } from "./lib.js";

describe("parseRepoUrl", () => {
  it("reads owner, repo and branch from GitHub URLs", () => {
    expect(parseRepoUrl("https://github.com/a/b")).toEqual({ owner: "a", repo: "b", branch: undefined });
    expect(parseRepoUrl("https://github.com/a/b.git/tree/feat/x")).toEqual({ owner: "a", repo: "b", branch: "feat/x" });
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
    expect(packLabel({ credits: 25, amount: 700, currency: "gbp" })).toMatch(/Buy 25 credits · £7\.00/);
    expect(packLabel({ credits: 25, amount: null, currency: null })).toBe("Buy 25 credits");
  });
});
