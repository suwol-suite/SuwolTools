import { parentPort } from "node:worker_threads";
import { renderPdfPages } from "./pdf-rendering.js";

type RenderRequest = { type: "inspect"; data: Uint8Array; scale?: number; renderThumbnails?: boolean; maxPages?: number };

/**
 * PDF.js lives in its own worker boundary. File generation remains in job-worker.ts;
 * this worker only owns page inspection/thumbnail metadata so the renderer never
 * loads an entire PDF document. Bitmap rendering is enabled by the packaged
 * canvas adapter when one is supplied by the target platform.
 */
parentPort?.on("message", async (message: RenderRequest) => {
  try {
    const rendered = await renderPdfPages(message.data, { scale: message.scale ?? 0.18, format: "jpeg", maxPages: message.maxPages ?? 200 }, (fraction) => parentPort?.postMessage({ type: "progress", fraction }));
    parentPort?.postMessage({ type: "complete", pages: rendered.map((page) => ({ page: page.index + 1, data: message.renderThumbnails ? page.data : undefined })) });
  } catch (error) {
    parentPort?.postMessage({ type: "error", error: error instanceof Error ? error.message : "PDF.js worker failed" });
  }
});
