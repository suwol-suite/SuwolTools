import { describe, expect, it } from "vitest";
import { getProcessor, getMediaProcessor, type ResolvedInput } from "@suwol/core";
import { tools } from "@suwol/shared";
import { validateNetworkUrl } from "../apps/desktop/src/main/network-policy";
import { FileHandleStore } from "../apps/desktop/src/main/file-handles";
import { mkdtemp, writeFile, stat, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

function input(name: string, value = "# Title\n\nBody"): ResolvedInput {
  const bytes = new TextEncoder().encode(value);
  return { handleId: "test-handle", name, relativePath: name, size: bytes.byteLength, mimeType: "text/plain", read: async () => bytes };
}

describe("remaining Electron migrations", () => {
  it("marks all migrated local and restricted-network feature contracts accurately", () => {
    expect(tools.filter((tool) => tool.migrated)).toHaveLength(69);
    expect(tools.filter((tool) => !tool.migrated)).toHaveLength(0);
    const network = tools.find((tool) => tool.id === "network-tools");
    expect(network?.electronSupport).toBe("full");
    expect(network?.externalApi).toBe(true);
    expect(network?.worker).toBe(false);
  });

  it("uses the legacy markdown and date-time contracts", async () => {
    const markdown = await getProcessor("markdown-tools")(input("note.md"), { tab: "html", sanitize: true }, { isCancelled: () => false });
    const date = await getProcessor("date-time-tools")(input("timestamp.txt", "0"), { tab: "timestamp", timestampUnit: "seconds" }, { isCancelled: () => false });
    expect(new TextDecoder().decode(markdown[0]?.data)).toContain("<h1>");
    expect(new TextDecoder().decode(date[0]?.data)).toContain("1970");
  });

  it("generates media asset archives through the injected image codec", async () => {
    const processor = getMediaProcessor("app-icon-generator");
    expect(processor).toBeDefined();
    const result = await processor!(input("logo.png"), { selectedPresets: ["favicon"] }, { isCancelled: () => false, imageCodec: { convert: async () => ({ data: new Uint8Array([137, 80, 78, 71]), mimeType: "image/png", extension: "png" }) } });
    expect(result[0]?.mimeType).toBe("application/zip");
    expect(result[0]?.data?.byteLength).toBeGreaterThan(20);
  });

  it("generates deterministic WAV output without Web Audio", async () => {
    const result = await getProcessor("retro-sfx-generator")(input("source.txt"), { waveform: "square", duration: 0.02, seed: "qa" }, { isCancelled: () => false });
    expect(result[0]?.mimeType).toBe("audio/wav");
    expect(new TextDecoder().decode(result[0]?.data?.slice(0, 4))).toBe("RIFF");
  });

  it("rejects unsafe network targets before any request", async () => {
    await expect(validateNetworkUrl("file:///etc/passwd")).rejects.toThrow("Only http and https");
    await expect(validateNetworkUrl("http://127.0.0.1")).rejects.toThrow("blocked");
  });

  it("protects active clipboard cache files while cleaning stale entries", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "suwol-cache-test-"));
    const store = new FileHandleStore(root);
    const source = await store.registerText("active");
    const stale = path.join(root, "stale.txt"); await writeFile(stale, "stale");
    await store.cleanup([store.resolve(source.items[0]!.handleId).path], 7 * 24 * 60 * 60 * 1000, 0);
    await expect(stat(stale)).rejects.toThrow();
    await expect(stat(store.resolve(source.items[0]!.handleId).path)).resolves.toBeTruthy();
    await store.clearCache([store.resolve(source.items[0]!.handleId).path]);
    await expect(stat(store.resolve(source.items[0]!.handleId).path)).resolves.toBeTruthy();
    await rm(root, { recursive: true, force: true });
  });
});
