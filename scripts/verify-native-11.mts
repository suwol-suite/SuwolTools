import { spawn } from "node:child_process";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";
import JSZip from "jszip";
import { PDFDocument } from "pdf-lib";
import * as PNG2ICONS from "png2icons";
import { getMediaProcessor } from "../packages/core/src/media-processors";
import { audioProcessor, retroSfxProcessor, videoProcessor } from "../packages/core/src/audio-processors";
import type { MediaCodec, PdfCodec, ResolvedInput } from "../packages/core/src/types";
import { createImageCodec, createMediaCodec } from "../apps/desktop/src/main/job-worker";
import { renderPdfPages } from "../apps/desktop/src/main/pdf-rendering";

const root = path.join(os.tmpdir(), "suwol-native-11-qa");
const out = path.join(root, "outputs");
await mkdir(out, { recursive: true });
const imageCodec = createImageCodec();
const mediaCodec = createMediaCodec(() => undefined) as MediaCodec;
const pdfCodec: PdfCodec = { renderPages: (data, options) => renderPdfPages(data, options) };
const iconCodec = {
  createIco: (data: Uint8Array) => new Uint8Array(PNG2ICONS.createICO(Buffer.from(data), PNG2ICONS.BICUBIC, 0, true, false) ?? []),
  createIcns: (data: Uint8Array) => new Uint8Array(PNG2ICONS.createICNS(Buffer.from(data), PNG2ICONS.BICUBIC, 0) ?? []),
};
const context = { imageCodec, mediaCodec, pdfCodec, iconCodec, isCancelled: () => false };
const makeInput = (name: string, data: Uint8Array, sourcePath?: string, mimeType?: string): ResolvedInput => ({ handleId: name, name, relativePath: name, sourcePath, mimeType, size: data.byteLength, read: async () => data });
const sourcePng = new Uint8Array(await sharp({ create: { width: 320, height: 180, channels: 4, background: { r: 28, g: 92, b: 176, alpha: 1 } } }).png().toBuffer());
const inputPng = makeInput("qa.png", sourcePng, path.join(root, "qa.png"), "image/png");
await writeFile(inputPng.sourcePath!, sourcePng);

async function saveResult(label: string, result: { data?: Uint8Array; filePath?: string; name: string }): Promise<string> {
  const target = path.join(out, result.name.replaceAll(/[\\/:*?"<>|]/g, "-"));
  if (result.data) await writeFile(target, result.data); else if (result.filePath) await writeFile(target, await readFile(result.filePath)); else throw new Error(`${label} returned no data`);
  const info = await stat(target); if (info.size === 0) throw new Error(`${label} returned an empty file`); return target;
}

const zipTools = ["app-icon-generator", "android-asset-generator", "ios-asset-generator"] as const;
for (const toolId of zipTools) {
  const result = await getMediaProcessor(toolId)!(inputPng, {}, context);
  const archive = await saveResult(toolId, result[0]!);
  const zip = await JSZip.loadAsync(await readFile(archive));
  if (Object.keys(zip.files).length < 5) throw new Error(`${toolId} ZIP is incomplete`);
  console.log(`${toolId}: ${Object.keys(zip.files).length} ZIP entries`);
}

const edited = await getMediaProcessor("image-editor")!(inputPng, { operation: "render-project", outputFormat: "png", layers: [{ type: "rectangle", x: 12, y: 16, width: 80, height: 40, fill: "#ff0000", visible: true }] }, context);
console.log(`image-editor: ${path.basename(await saveResult("image-editor", edited[0]!))}`);
const stitched = await getMediaProcessor("screenshot-stitch-redact")!(inputPng, { direction: "vertical", redactions: [{ kind: "black", x: 10, y: 10, width: 50, height: 20 }] }, { ...context, inputs: [inputPng, inputPng] });
console.log(`screenshot-stitch-redact: ${path.basename(await saveResult("screenshot-stitch-redact", stitched[0]!))}`);

const pdf = await PDFDocument.create(); pdf.addPage([240, 160]); pdf.addPage([260, 180]); const pdfData = new Uint8Array(await pdf.save()); const pdfInput = makeInput("qa.pdf", pdfData, path.join(root, "qa.pdf"), "application/pdf"); await writeFile(pdfInput.sourcePath!, pdfData);
for (const [mode, options] of [["metadata", {}], ["rotate", { ranges: "1", angle: 90 }], ["split", { ranges: "1,2" }], ["pdfToImage", { format: "png", scale: 0.5 }]] as const) {
  const result = await getMediaProcessor("pdf-tools")!(pdfInput, { mode, ...options }, { ...context, inputs: [pdfInput] });
  for (const item of result) await saveResult(`pdf-tools/${mode}`, item);
  console.log(`pdf-tools/${mode}: ${result.length} output(s)`);
}

const frameOne = sourcePng; const frameTwo = new Uint8Array(await sharp({ create: { width: 320, height: 180, channels: 4, background: { r: 176, g: 42, b: 92, alpha: 1 } } }).png().toBuffer());
const animated = await mediaCodec.encodeFrames!([{ data: frameOne, delayMs: 80 }, { data: frameTwo, delayMs: 180 }], { outputFormat: "gif", loop: true, fps: 12 });
const gifData = new Uint8Array(await readFile(animated.filePath)); const gifInput = makeInput("qa.gif", gifData, animated.filePath, "image/gif");
const gifResult = await getMediaProcessor("gif-frame-editor")!(gifInput, { mode: "gif", frameRange: "1-2", delayMs: 120, loop: true }, context); await saveResult("gif-frame-editor", gifResult[0]!); console.log("gif-frame-editor: edited GIF");

const retro = await retroSfxProcessor(makeInput("qa.txt", new TextEncoder().encode("qa")), { preset: "coin", seed: "native-qa", duration: 0.08 }); const wavPath = path.join(root, "qa.wav"); await writeFile(wavPath, retro[0]!.data!); const wavInput = makeInput("qa.wav", retro[0]!.data!, wavPath, "audio/wav");
const audio = await audioProcessor(wavInput, { operation: "trim", outputFormat: "flac", start: 0, duration: 0.04 }, context); await saveResult("audio-toolkit", audio[0]!); console.log("audio-toolkit: trimmed FLAC");
const retroJson = await retroSfxProcessor(makeInput("qa.txt", new TextEncoder().encode("qa")), { preset: "gameboy", outputMode: "json", seed: "native-qa" }); await saveResult("retro-sfx-generator", retroJson[0]!); console.log("retro-sfx-generator: reproducible JSON");

const ffmpeg = (await import("ffmpeg-static")).default;
if (!ffmpeg) throw new Error("ffmpeg-static is unavailable");
const videoPath = path.join(root, "qa.mp4");
await new Promise<void>((resolve, reject) => { const child = spawn(ffmpeg, ["-hide_banner", "-loglevel", "error", "-y", "-f", "lavfi", "-i", "color=c=blue:s=320x180:d=0.5", "-pix_fmt", "yuv420p", videoPath]); child.once("error", reject); child.once("close", (code) => code === 0 ? resolve() : reject(new Error(`ffmpeg sample exited ${code}`))); });
const videoData = new Uint8Array(await readFile(videoPath)); const videoInput = makeInput("qa.mp4", videoData, videoPath, "video/mp4"); const video = await videoProcessor(videoInput, { outputFormat: "gif", width: 160, fps: 8, start: 0, duration: 0.5 }, context); await saveResult("video-to-gif-webp", video[0]!); console.log("video-to-gif-webp: GIF");

console.log(`native QA outputs: ${out}`);
