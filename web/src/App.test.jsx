import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { App } from "./App.jsx";
import { Privacy } from "./Privacy.jsx";
import { config } from "./config.js";

describe("landing page", () => {
  it("shows the pitch, the prices from config, and a Coming soon button until a store link is set", () => {
    render(<App />);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toMatch(/Scan your code before you launch/);
    expect(screen.getByText(config.plans.pro.price)).toBeTruthy();
    for (const p of config.packs) expect(screen.getByText(p.price)).toBeTruthy();
    const buttons = screen.getAllByText(/Coming soon/);
    expect(buttons.length).toBeGreaterThan(0);
    expect(buttons[0].getAttribute("aria-disabled")).toBe("true");
    expect(buttons[0].getAttribute("href")).toBeNull();
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
