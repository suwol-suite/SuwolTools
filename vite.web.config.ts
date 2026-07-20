import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";

export default defineConfig({
  root: resolve("apps/web"),
  plugins: [react()],
  resolve: { alias: { "@suwol/shared": resolve("packages/shared/src"), "@suwol/core": resolve("packages/core/src"), "@legacy": resolve("../SuwolWebTools/src"), "@": resolve("../SuwolWebTools/src") } },
  build: { outDir: resolve("dist-web"), emptyOutDir: true, chunkSizeWarningLimit: 500, modulePreload: false, rollupOptions: { output: { manualChunks(id) { if (id.includes("pdf-lib")) return "vendor-pdf"; if (id.includes("jszip")) return "vendor-zip"; if (id.includes("packages/core/src")) return "tool-processors"; if (id.includes("SuwolWebTools/src")) return "legacy-tools"; return undefined; } } } }
});
