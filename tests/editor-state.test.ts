import { describe, expect, it } from "vitest";
import { getMediaProcessor, type ImageCodec, type ResolvedInput } from "@suwol/core";
import { moveItem, replaceInputItems } from "../apps/desktop/src/renderer/features/shared";
import type { InputSource } from "@suwol/shared";

const source: InputSource = { kind: "files", origin: "dialog", items: [
  { handleId: "one", name: "one.png", relativePath: "one.png", size: 1, mimeType: "image/png" },
  { handleId: "two", name: "two.png", relativePath: "two.png", size: 1, mimeType: "image/png" },
] };
const imageInput = (name = "frame.gif"): ResolvedInput => ({ handleId: name, name, relativePath: name, size: 3, mimeType: "image/gif", read: async () => new Uint8Array([1, 2, 3]) });

describe("editor state contracts", () => {
  it("moves input items without mutating the original source", () => {
    const moved = moveItem(source.items, 1, 0);
    expect(moved.map((item) => item.handleId)).toEqual(["two", "one"]);
    expect(source.items.map((item) => item.handleId)).toEqual(["one", "two"]);
    expect(replaceInputItems(source, moved)?.items).toEqual(moved);
  });

  it("keeps GIF frame order, duplicates and per-frame delays in the worker contract", async () => {
    const calls: Array<{ frames: Array<{ data: Uint8Array; delayMs?: number }>; options: Record<string, unknown> }> = [];
    const imageCodec: ImageCodec = {
      convert: async () => ({ data: new Uint8Array([1]), mimeType: "image/png", extension: "png" }),
      extractFrames: async () => [
        { data: new Uint8Array([10]), mimeType: "image/png", extension: "png", index: 0 },
        { data: new Uint8Array([20]), mimeType: "image/png", extension: "png", index: 1 },
      ],
    };
    const result = await getMediaProcessor("gif-frame-editor")!(imageInput(), { mode: "gif", frameOrder: [1, 0, 1], frameDelays: { "0": 120, "1": 160 }, loopCount: 2 }, {
      imageCodec,
      mediaCodec: { encodeFrames: async (frames, options) => { calls.push({ frames, options }); return { filePath: "/tmp/out.gif", mimeType: "image/gif", extension: "gif", size: 1 }; } },
      isCancelled: () => false,
    });
    expect(result[0]?.filePath).toBe("/tmp/out.gif");
    expect(calls[0]?.frames.map((frame) => frame.delayMs)).toEqual([160, 120, 160]);
    expect(calls[0]?.options).toMatchObject({ loopCount: 2 });
  });
});
