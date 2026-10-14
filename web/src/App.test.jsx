import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { App } from "./App.jsx";
import { Privacy } from "./Privacy.jsx";
import { config } from "./config.js";

describe("landing page", () => {
  it("shows the pitch, the prices from config, and an Add to Chrome button linking to the store", () => {
    render(<App />);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toMatch(/GitHub security scanner.*for AI-built apps/);
    expect(screen.getByText(/From code findings to a pull request/)).toBeTruthy();
    expect(screen.getByText(new RegExp(`${config.plans.free.scans} free scans and ${config.plans.free.fixes} free fixes`))).toBeTruthy();
    expect(screen.getByText(config.plans.pro.price)).toBeTruthy();
    for (const p of config.packs) expect(screen.getByText(p.price)).toBeTruthy();
    expect(config.storeUrl).toMatch(/^https:\/\/chromewebstore\.google\.com\/detail\//);
    const buttons = screen.getAllByText(/Add to Chrome/);
    expect(buttons.length).toBeGreaterThan(0);
    expect(buttons[0].closest("a").getAttribute("href")).toBe(config.storeUrl);
    expect(screen.queryByText(/Coming soon/)).toBeNull();
  });
  it("answers the safety questions", () => {
    render(<App />);
    expect(screen.getByText(/Will it change my code without asking/)).toBeTruthy();
    expect(screen.getByText(/Can the AI be wrong/)).toBeTruthy();
  });
});

describe("privacy policy", () => {
  it("states that the token isn't saved and names the third parties", () => {
    render(<Privacy />);
    expect(screen.getByText(/not saved in our database/)).toBeTruthy();
    for (const name of ["Anthropic", "OSV.dev", "Stripe"]) expect(screen.getAllByText(new RegExp(name)).length).toBeGreaterThan(0);
  });
});
