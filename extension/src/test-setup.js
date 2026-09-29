import { afterEach, vi } from "vitest";
import { cleanup } from "@testing-library/react";

afterEach(cleanup);

// Minimal in-memory stand-in for the parts of the chrome.* API the pages use.
export function installChrome(initial = {}) {
  const store = { ...initial };
  globalThis.chrome = {
    storage: {
      local: {
        get: vi.fn(async (keys) => {
          const list = typeof keys === "string" ? [keys] : keys;
          return Object.fromEntries(list.filter((k) => k in store).map((k) => [k, store[k]]));
        }),
        set: vi.fn(async (obj) => void Object.assign(store, obj)),
      },
    },
    tabs: { create: vi.fn(), query: vi.fn(async () => []) },
    runtime: { openOptionsPage: vi.fn(), getURL: (p) => `chrome-extension://x/${p}` },
    permissions: { request: vi.fn(async () => true) },
  };
  return store;
}
