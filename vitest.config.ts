import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

export default defineConfig({
  resolve: { alias: { "@suwol/shared": resolve("packages/shared/src"), "@suwol/core": resolve("packages/core/src"), "@legacy": resolve("packages/legacy/src"), "@": resolve("packages/legacy/src") } },
  test: { environment: "node" },
});
