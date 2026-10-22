import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Octokit } from "@octokit/rest";
import { fetchBlobTexts } from "../src/github.js";

const sha = (n: number) => n.toString(16).padStart(40, "0");

describe("fetchBlobTexts", () => {
  it("reads 100 files in 3 requests and keeps each file with its own path", async () => {
    const calls: string[] = [];
    const octokit = {
      graphql: async (query: string) => {
        calls.push(query);
        const repository: Record<string, unknown> = {};
        for (const m of query.matchAll(/(f\d+): object\(oid: "([0-9a-f]{40})"\)/g)) repository[m[1]] = { text: `content-${parseInt(m[2], 16)}`, isBinary: false, isTruncated: false };
        return { repository };
      },
    } as unknown as Octokit;
    const blobs = Array.from({ length: 100 }, (_, i) => ({ path: `src/f${i}.ts`, sha: sha(i + 1) }));
    const files = await fetchBlobTexts(octokit, "o", "r", blobs);
    assert.equal(calls.length, 3);
    assert.equal(files.length, 100);
    for (let i = 0; i < 100; i++) assert.deepEqual(files.find((f) => f.path === `src/f${i}.ts`), { path: `src/f${i}.ts`, content: `content-${i + 1}` });
  });

  it("skips binary, truncated and missing blobs", async () => {
    const octokit = {
      graphql: async () => ({
        repository: {
          f0: { text: "ok", isBinary: false, isTruncated: false },
          f1: { text: null, isBinary: true, isTruncated: false },
          f2: { text: "cut", isBinary: false, isTruncated: true },
          f3: null,
        },
      }),
    } as unknown as Octokit;
    const files = await fetchBlobTexts(octokit, "o", "r", [0, 1, 2, 3].map((i) => ({ path: `p${i}`, sha: sha(i + 1) })));
    assert.deepEqual(files, [{ path: "p0", content: "ok" }]);
  });

  it("refuses an id that is not a 40-character hash", async () => {
    const octokit = { graphql: async () => ({ repository: {} }) } as unknown as Octokit;
    await assert.rejects(fetchBlobTexts(octokit, "o", "r", [{ path: "x", sha: 'abc") { x } #' }]), /Unexpected blob id/);
  });
});
