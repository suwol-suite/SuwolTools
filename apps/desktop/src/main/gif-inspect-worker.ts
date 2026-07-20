import { parentPort } from "node:worker_threads";
import sharp from "sharp";

parentPort?.on("message", async (message: { data: Uint8Array; maxFrames?: number }) => {
  try {
    const source = sharp(message.data, { animated: true });
    const metadata = await source.metadata(); const pageCount = Math.min(Math.max(1, metadata.pages ?? 1), Math.max(1, Math.min(300, message.maxFrames ?? 300)));
    const frames: Array<{ index: number; delayMs: number; data: Uint8Array }> = [];
    for (let index = 0; index < pageCount; index += 1) {
      const buffer = await sharp(message.data, { page: index }).resize(160, 120, { fit: "inside" }).png().toBuffer();
      frames.push({ index, delayMs: Array.isArray(metadata.delay) ? metadata.delay[index] ?? 83 : 83, data: new Uint8Array(buffer) });
    }
    parentPort?.postMessage({ type: "complete", width: metadata.width ?? 0, height: metadata.pageHeight ?? metadata.height ?? 0, pageCount: metadata.pages ?? 1, loop: metadata.loop ?? 0, frames });
  } catch (error) { parentPort?.postMessage({ type: "error", error: error instanceof Error ? error.message : "GIF inspection failed." }); }
});
