import { test } from "node:test";
import assert from "node:assert/strict";
import { runStaticChecks } from "../src/staticChecks.js";
import type { RepoFile, RepoSnapshot } from "../src/types.js";

function snap(files: RepoFile[], extraPaths: string[] = []): RepoSnapshot {
  return {
    owner: "o",
    repo: "r",
    branch: "main",
    commitSha: "abc",
    files,
    allPaths: [...files.map((f) => f.path), ...extraPaths],
    truncated: false,
  };
}

const fakeStripe = "sk_live_" + "a1B2c3D4e5F6g7H8i9J0k1L2";

test("flags a hardcoded Stripe live key with its line number", () => {
  const issues = runStaticChecks(
    snap([{ path: "src/pay.ts", content: `import x from "y";\nconst key = "${fakeStripe}";\n` }], [".gitignore"]),
  );
  const hit = issues.find((i) => i.id.startsWith("stripe-live-secret"));
  assert.ok(hit);
  assert.equal(hit.severity, "critical");
  assert.equal(hit.line, 2);
  assert.match(hit.explanation, /browser/);
});

test("ignores keys in example files", () => {
  const issues = runStaticChecks(snap([{ path: ".env.example", content: `STRIPE=${fakeStripe}` }], [".gitignore"]));
  assert.equal(issues.length, 0);
});

test("flags committed .env but not .env.example", () => {
  const issues = runStaticChecks(snap([], [".env", ".env.example", ".gitignore"]));
  assert.deepEqual(
    issues.map((i) => i.id),
    ["committed-env-.env"],
  );
});

test("flags open Firestore rules", () => {
  const rules = `rules_version = '2';\nservice cloud.firestore {\n  match /databases/{db}/documents {\n    match /{doc=**} {\n      allow read, write: if true;\n    }\n  }\n}`;
  const issues = runStaticChecks(snap([{ path: "firestore.rules", content: rules }], [".gitignore"]));
  const hit = issues.find((i) => i.id === "open-rules-firestore.rules");
  assert.ok(hit);
  assert.equal(hit.line, 5);
});

test("does not flag locked-down Firestore rules", () => {
  const rules = `match /users/{uid} {\n  allow read, write: if request.auth != null && request.auth.uid == uid;\n}`;
  const issues = runStaticChecks(snap([{ path: "firestore.rules", content: rules }], [".gitignore"]));
  assert.equal(issues.length, 0);
});

test("flags disabled Supabase RLS", () => {
  const issues = runStaticChecks(
    snap([{ path: "supabase/migrations/001.sql", content: "alter table todos disable row level security;" }], [".gitignore"]),
  );
  assert.equal(issues[0]?.id, "rls-disabled-supabase/migrations/001.sql");
});

test("warns when .gitignore is missing", () => {
  const issues = runStaticChecks(snap([{ path: "index.js", content: "console.log(1)" }]));
  assert.equal(issues[0]?.id, "missing-gitignore");
  assert.equal(issues[0]?.severity, "warning");
});
