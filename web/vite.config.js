import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Two static pages: the landing page and the privacy policy.
export default defineConfig({
  plugins: [react()],
  build: { rollupOptions: { input: { index: "index.html", privacy: "privacy.html" } } },
  test: { environment: "jsdom", setupFiles: ["src/test-setup.js"] },
});
