import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Three extension pages (popup, options, report). Everything in public/ (manifest, icons,
// background and content scripts) is copied to dist/ as-is. Load the dist/ folder in Chrome.
export default defineConfig({
  base: "./",
  plugins: [react()],
  build: {
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      input: { popup: "popup.html", options: "options.html", report: "report.html" },
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["src/test-setup.js"],
  },
});
