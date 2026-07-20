import { defineConfig, externalizeDepsPlugin } from "electron-vite";
import { resolve } from "node:path";
import react from "@vitejs/plugin-react";

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    resolve: { alias: { "@suwol/shared": resolve("packages/shared/src"), "@suwol/core": resolve("packages/core/src"), "@legacy": resolve("packages/legacy/src"), "@": resolve("packages/legacy/src") } },
    build: { outDir: resolve("dist-electron"), rollupOptions: { input: { main: resolve("apps/desktop/src/main/index.ts"), "job-worker": resolve("apps/desktop/src/main/job-worker.ts"), "pdf-render-worker": resolve("apps/desktop/src/main/pdf-render-worker.ts"), "gif-inspect-worker": resolve("apps/desktop/src/main/gif-inspect-worker.ts") }, output: { entryFileNames: "[name].js" } } }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: { outDir: resolve("dist-electron"), rollupOptions: { input: resolve("apps/desktop/src/preload/index.ts"), output: { entryFileNames: "preload.cjs", format: "cjs" } } }
  },
  renderer: {
    root: resolve("apps/desktop/src/renderer"),
    plugins: [react()],
    resolve: { alias: { "@suwol/shared": resolve("packages/shared/src"), "@suwol/core": resolve("packages/core/src") } },
    build: { outDir: resolve("dist-renderer"), chunkSizeWarningLimit: 500, modulePreload: false, rollupOptions: { input: resolve("apps/desktop/src/renderer/index.html"), output: { manualChunks(id) { if (id.includes("pdf-lib")) return "vendor-pdf"; if (id.includes("jszip")) return "vendor-zip"; if (id.includes("packages/core/src")) return "tool-processors"; if (id.includes("packages/legacy/src")) return "legacy-tools"; return undefined; } } } }
  }
});
