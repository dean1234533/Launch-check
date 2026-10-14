import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Development runs at /; production is hosted under dean-da-dev.co.uk/quick-scan-first/.
export default defineConfig(({ command, mode, isSsrBuild }) => ({
  base: command === "build" || mode === "production" ? "/quick-scan-first/" : "/",
  cacheDir: process.env.VITE_CACHE_DIR || "node_modules/.vite",
  ssr: { noExternal: ["react", "react-dom"] },
  plugins: [react()],
  build: { outDir: process.env.BUILD_OUTPUT_DIR || "dist", emptyOutDir:true, rollupOptions: { input: isSsrBuild ? "src/entry-server.jsx" : { index: "index.html", privacy: "privacy.html" } } },
  test: { environment: "jsdom", setupFiles: ["src/test-setup.js"] },
}));
