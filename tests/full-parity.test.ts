import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { getMediaProcessor } from "@suwol/core";
import { audioProcessor, retroSfxProcessor, videoProcessor } from "@suwol/core";
import type { ImageCodec, MediaCodec, ResolvedInput } from "@suwol/core";
import { localNetworkDiagnostic, restrictedNetworkRequest, validateResolvedAddresses } from "../apps/desktop/src/main/network-policy";

const bytes = (value: string) => new TextEncoder().encode(value);
function input(name: string, data = bytes("source")): ResolvedInput { return { handleId: name, name, relativePath: name, mimeType: name.endsWith(".pdf") ? "application/pdf" : "image/png", size: data.byteLength, read: async () => data, sourcePath: `/tmp/${name}` }; }
const imageCodec: ImageCodec = {
  convert: async () => ({ data: bytes("PNG"), mimeType: "image/png", extension: "png" }),
  compose: async () => ({ data: bytes("PNG"), mimeType: "image/png", extension: "png" }),
  extractFrames: async () => [{ data: bytes("P1"), mimeType: "image/png", extension: "png", index: 0 }, { data: bytes("P2"), mimeType: "image/png", extension: "png", index: 1 }],
};
const mediaCodec: MediaCodec = { convertFile: async (_path, options) => ({ filePath: `/tmp/result.${String(options.outputFormat ?? "wav")}`, mimeType: String(options.outputFormat).startsWith("audio") ? "audio/wav" : "image/gif", extension: String(options.outputFormat ?? "wav"), size: 10 }) };
const context = { imageCodec, mediaCodec, iconCodec: { createIco: () => bytes("ICO"), createIcns: () => bytes("ICNS") }, isCancelled: () => false };

describe("remaining migrated processors", () => {
  it.each([
    ["app-icon-generator", "zip"], ["android-asset-generator", "zip"], ["ios-asset-generator", "zip"],
    ["image-editor", "image"], ["screenshot-stitch-redact", "image"], ["gif-frame-editor", "zip"],
  ])("runs %s through the common processor contract", async (toolId, kind) => {
    const processor = getMediaProcessor(toolId);
    expect(processor).toBeDefined();
    const result = await processor!(input(`${toolId}.png`), {}, context);
    expect(result.length).toBeGreaterThan(0);
    expect(kind === "zip" ? result[0]!.mimeType === "application/zip" : result[0]!.mimeType.startsWith("image/")).toBe(true);
  });

  it("creates, merges, rotates, and splits PDF pages in the worker processor", async () => {
    const first = await PDFDocument.create(); first.addPage([100, 100]); const second = await PDFDocument.create(); second.addPage([120, 120]);
    const processor = getMediaProcessor("pdf-tools")!; const merged = await processor(input("one.pdf", new Uint8Array(await first.save())), { mode: "merge" }, { ...context, inputs: [input("one.pdf", new Uint8Array(await first.save())), input("two.pdf", new Uint8Array(await second.save()))] });
    expect(merged[0]!.mimeType).toBe("application/pdf");
    const rotated = await processor(input("one.pdf", new Uint8Array(await first.save())), { mode: "rotate", ranges: "1", angle: 90 }, context); expect(rotated[0]!.mimeType).toBe("application/pdf");
    const split = await processor(input("one.pdf", new Uint8Array(await first.save())), { mode: "split", ranges: "1" }, context); expect(split[0]!.mimeType).toBe("application/pdf");
  });

  it("keeps retro SFX deterministic and supports JSON project output", async () => {
    const first = await retroSfxProcessor(input("retro.txt"), { seed: "fixed", duration: 0.03, sampleRate: 22050 });
    const second = await retroSfxProcessor(input("retro.txt"), { seed: "fixed", duration: 0.03, sampleRate: 22050 });
    expect(Array.from(first[0]!.data ?? [])).toEqual(Array.from(second[0]!.data ?? []));
    const project = await retroSfxProcessor(input("retro.txt"), { outputMode: "json", seed: "fixed" }); expect(project[0]!.mimeType).toContain("json");
  });

  it("routes audio conversion and video conversion to MediaCodec", async () => {
    const audio = await audioProcessor(input("sample.wav"), { operation: "trim", outputFormat: "flac", duration: 0.2 }, context); expect(audio[0]!.filePath).toContain("flac");
    const video = await videoProcessor(input("sample.mp4"), { outputFormat: "webp", width: 320, fps: 8, duration: 1 }, context); expect(video[0]!.filePath).toContain("webp");
  });
});

describe("network safety boundary", () => {
  it.each(["file:///etc/passwd", "http://127.0.0.1", "http://169.254.169.254", "http://localhost"]) ("blocks %s", async (url) => {
    await expect(restrictedNetworkRequest(url, "url-parse")).rejects.toThrow();
  });
  it("rejects DNS rebinding results containing a private address", () => {
    expect(() => validateResolvedAddresses([{ address: "93.184.216.34", family: 4 }, { address: "127.0.0.1", family: 4 }])).toThrow("blocked");
    expect(validateResolvedAddresses([{ address: "93.184.216.34", family: 4 }])).toEqual([{ address: "93.184.216.34", family: 4 }]);
  });
  it("keeps IP and port diagnostics local", async () => {
    const subnet = await localNetworkDiagnostic("ip", "192.168.0.10/24");
    expect((subnet as { networkAddress?: string }).networkAddress).toBe("192.168.0.0");
    const ports = await localNetworkDiagnostic("ports", "http", { protocol: "TCP" });
    expect(Array.isArray(ports)).toBe(true);
  });
});
