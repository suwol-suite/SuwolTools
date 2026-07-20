import { build } from "vite";
import { externalizeDepsPlugin } from "electron-vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";

const root = process.cwd();
const alias = { "@suwol/shared": resolve(root, "packages/shared/src"), "@suwol/core": resolve(root, "packages/core/src"), "@legacy": resolve(root, "../SuwolWebTools/src"), "@": resolve(root, "../SuwolWebTools/src") };
const rendererOutput = { manualChunks(id) { if (id.includes("pdf-lib")) return "vendor-pdf"; if (id.includes("jszip")) return "vendor-zip"; if (id.includes("packages/core/src")) return "tool-processors"; if (id.includes("SuwolWebTools/src")) return "legacy-tools"; return undefined; } };

await build({
  plugins: [externalizeDepsPlugin()],
  resolve: { alias },
  build: {
    ssr: true,
    outDir: resolve(root, "dist-electron"),
    emptyOutDir: true,
    rollupOptions: {
      input: { main: resolve(root, "apps/desktop/src/main/index.ts"), "job-worker": resolve(root, "apps/desktop/src/main/job-worker.ts"), "pdf-render-worker": resolve(root, "apps/desktop/src/main/pdf-render-worker.ts"), "gif-inspect-worker": resolve(root, "apps/desktop/src/main/gif-inspect-worker.ts") },
      output: { entryFileNames: "[name].js" },
    },
  },
});

await build({
  plugins: [externalizeDepsPlugin()],
  resolve: { alias },
  build: {
    ssr: true,
    outDir: resolve(root, "dist-electron"),
    emptyOutDir: false,
    rollupOptions: { input: resolve(root, "apps/desktop/src/preload/index.ts"), output: { entryFileNames: "preload.cjs", format: "cjs" } },
  },
});

await build({
  root: resolve(root, "apps/desktop/src/renderer"),
  plugins: [react()],
  resolve: { alias },
  build: { outDir: resolve(root, "dist-renderer"), emptyOutDir: true, chunkSizeWarningLimit: 500, modulePreload: false, rollupOptions: { input: resolve(root, "apps/desktop/src/renderer/index.html"), output: rendererOutput } },
});
