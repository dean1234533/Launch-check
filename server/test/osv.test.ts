import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { checkDependencies, parseLockfile } from "../src/osv.js";
import { resolvedSince } from "../src/scans.js";
import type { Issue } from "../src/types.js";

const lock = JSON.stringify({
  lockfileVersion: 3,
  packages: {
    "": { name: "app" },
    "node_modules/express": { version: "4.17.1" },
    "node_modules/a/node_modules/@scope/pkg": { version: "1.0.0" },
    "node_modules/jest": { version: "29.0.0", dev: true },
    "packages/local": { link: true },
  },
});

describe("parseLockfile", () => {
  it("keeps production packages with exact versions, including nested and scoped ones", () => {
    assert.deepEqual(parseLockfile(lock), [
      { name: "express", version: "4.17.1" },
      { name: "@scope/pkg", version: "1.0.0" },
    ]);
  });
  it("returns nothing for junk", () => assert.deepEqual(parseLockfile("not json"), []));
});

describe("checkDependencies", () => {
  const fake = (async (url: string) => {
    if (String(url).endsWith("/querybatch")) {
      return Response.json({ results: [{ vulns: [{ id: "GHSA-1" }] }, {}] });
    }
    return Response.json({ id: "GHSA-1", summary: "Prototype pollution", database_specific: { severity: "HIGH" } });
  }) as typeof fetch;

  it("reports one critical issue for high-severity vulnerabilities", async () => {
    const issue = await checkDependencies(parseLockfile(lock), fake);
    assert.equal(issue?.severity, "critical");
    assert.match(issue!.explanation, /express@4\.17\.1/);
  });
  it("reports nothing when the packages are clean", async () => {
    const clean = (async () => Response.json({ results: [{}, {}] })) as unknown as typeof fetch;
    assert.equal(await checkDependencies(parseLockfile(lock), clean), null);
  });
});

describe("resolvedSince", () => {
  const issue = (id: string, title = id): Issue => ({ id, severity: "critical", category: "security", title, explanation: "", files: ["a.ts"], line: null, fixPrompt: "" });
  it("lists issues that disappeared and matches renamed ids with the same title", () => {
    const out = resolvedSince([issue("x"), issue("y", "Same title")], [issue("z", "Same title")]);
    assert.deepEqual(out.map((o) => o.id), ["x"]);
  });
});
