import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import ezyoBrand from "./brand/ezyoBrandPlugin.mjs";

// base "./" lets the build run from any folder or static host (GitHub Pages included).
// v10.8: the app is split into cached chunks (React, MUI, the Word/Excel generators load only when used) — faster first
// load and better Core Web Vitals. SINGLE_FILE=1 keeps the old single bundle (to ship the app as one HTML file).
export default defineConfig({
  // ezyoBrand(): re-skins the existing colours to the Ezyo palette (dark teal #004A77, glob teal #068E92/#0ABFA7, bright teal #10FCBE) at build time (EZYO_BRAND=off to disable).
  plugins: [ezyoBrand(), react()],
  base: "./",
  // Generative AI: during `npm run dev`, /api/ai is forwarded to the key-holding proxy (`npm run ai-proxy`).
  server: { proxy: { "/api": { target: "http://localhost:8787", changeOrigin: true } } },
  build: process.env.SINGLE_FILE === "1"
    ? { rollupOptions: { output: { inlineDynamicImports: true } }, chunkSizeWarningLimit: 6000 }
    : {
        chunkSizeWarningLimit: 2500,
        rollupOptions: { output: { manualChunks: (id) => (id.includes("node_modules/react") || id.includes("node_modules/scheduler") ? "react" : id.includes("node_modules/@mui") || id.includes("node_modules/@emotion") ? "mui" : undefined) } },
      },
});
