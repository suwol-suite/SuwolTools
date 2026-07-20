import { parentPort } from "node:worker_threads";
import { randomUUID } from "node:crypto";
import { copyFile, mkdir, mkdtemp, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { spawn, type ChildProcess } from "node:child_process";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";
import ffmpegStatic from "ffmpeg-static";
import * as PNG2ICONS from "png2icons";
import { DOMParser, XMLSerializer } from "@xmldom/xmldom";
import { parseHTML } from "linkedom";
import { executeJob, sanitizeRelativePath, type FileIoAdapter, type ResolvedInput } from "@suwol/core";
import type { InputItem, Job, OutputTarget } from "@suwol/shared";
import { renderPdfPages } from "./pdf-rendering.js";

type WorkerInput = InputItem & { sourcePath: string };
type WorkerRequest = { job: Job; inputs: WorkerInput[] };
type WorkerControl = { type: "cancel" | "pause" | "resume" };
let activeCancel = () => undefined;
let activePause = () => undefined;
let activeResume = () => undefined;
let activeChild: ChildProcess | undefined;

function stringOption(options: Record<string, unknown>, key: string, fallback: string): string {
  return typeof options[key] === "string" ? options[key] as string : fallback;
}

const nodeGlobals = globalThis as typeof globalThis & { DOMParser?: typeof DOMParser; XMLSerializer?: typeof XMLSerializer };
const xmlParser = new DOMParser();
const htmlDom = parseHTML("<!doctype html><html><body></body></html>");
const htmlGlobals = globalThis as typeof globalThis & { Node?: typeof htmlDom.window.Node; HTMLElement?: typeof htmlDom.window.HTMLElement };
if (!htmlGlobals.Node) htmlGlobals.Node = htmlDom.window.Node;
if (!htmlGlobals.HTMLElement) htmlGlobals.HTMLElement = htmlDom.window.HTMLElement;
nodeGlobals.DOMParser = class {
  parseFromString(source: string, mimeType: string) {
    if (mimeType === "text/html") {
      const htmlSource = /<\s*html[\s>]/i.test(source) ? source : `<html><body>${source}</body></html>`;
      return new htmlDom.window.DOMParser().parseFromString(htmlSource, mimeType);
    }
    const document = xmlParser.parseFromString(source, mimeType);
    const compatible = document as typeof document & { querySelector?: (selector: string) => Node | null };
    compatible.querySelector = (selector: string) => selector === "parsererror" ? document.getElementsByTagName("parsererror")[0] ?? null : null;
    return document;
  }
} as unknown as typeof DOMParser;
nodeGlobals.XMLSerializer = XMLSerializer;

function isWithin(parent: string, candidate: string): boolean {
  const relative = path.relative(parent, candidate);
  return relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative));
}

function ensureChildPath(parent: string, candidate: string): string {
  const resolved = path.resolve(parent, candidate);
  if (!isWithin(parent, resolved)) throw new Error("Path escapes the approved directory.");
  return resolved;
}

async function collisionPath(candidate: string, target: OutputTarget): Promise<string | undefined> {
  if (target.collision === "overwrite") return candidate;
  if (!(await stat(candidate).catch(() => undefined))) return candidate;
  if (target.collision === "skip") return undefined;
  const extension = path.extname(candidate);
  const stem = candidate.slice(0, -extension.length);
  for (let index = 1; index < 10000; index += 1) {
    const next = `${stem} (${index})${extension}`;
    if (!(await stat(next).catch(() => undefined))) return next;
  }
  throw new Error("Could not find a free output filename.");
}

function outputRoot(input: ResolvedInput, target: OutputTarget): string {
  if (target.kind === "directory") {
    if (!target.directory) throw new Error("Output directory is required.");
    return path.resolve(target.directory);
  }
  if (input.sourceRoot) return input.sourceRoot;
  if (!input.sourcePath) throw new Error("Input path is unavailable.");
  return path.dirname(input.sourcePath);
}

export function createImageCodec() {
  function safeSvgText(value: string): string {
    return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[character] ?? character);
  }
  function safeColor(value: unknown, fallback = "#ffffff"): string {
    return typeof value === "string" && /^(#[0-9a-f]{3,8}|rgba?\([^)]*\)|transparent)$/i.test(value.trim()) ? value.trim() : fallback;
  }
  function applyFormat(image: sharp.Sharp, outputFormat: "png" | "jpeg" | "webp", quality: number, background: string) {
    if (outputFormat === "png") return image.png();
    if (outputFormat === "jpeg") return image.flatten({ background }).jpeg({ quality });
    return image.webp({ quality });
  }
  return {
    convert: async (data: Uint8Array, options: Record<string, unknown>) => {
      const outputFormat = options.outputFormat === "png" || options.outputFormat === "jpeg" || options.outputFormat === "webp" ? options.outputFormat : "webp";
      const metadata = await sharp(data).metadata();
      let image = sharp(data);
      const width = typeof options.width === "number" ? Math.max(1, Math.round(options.width)) : undefined;
      const height = typeof options.height === "number" ? Math.max(1, Math.round(options.height)) : undefined;
      const fit = (options.fitMode === "cover" ? "cover" : options.fitMode === "contain" ? "contain" : options.fitMode === "stretch" || options.fitMode === "fill" ? "fill" : "inside") as "cover" | "contain" | "fill" | "inside";
      const backgroundMode = options.backgroundMode === "transparent" ? "transparent" : options.backgroundMode === "blur" ? "blur" : options.backgroundMode === "average" ? "average" : "color";
      const color = safeColor(options.backgroundColor);
      let background = color;
      if (backgroundMode === "average") {
        const stats = await sharp(data).stats(); const channel = stats.channels.slice(0, 3); background = `rgb(${Math.round(channel[0]?.mean ?? 255)},${Math.round(channel[1]?.mean ?? 255)},${Math.round(channel[2]?.mean ?? 255)})`;
      }
      if (width || height) {
        const paddingPercent = Math.max(0, Math.min(45, Number(options.paddingPercent) || 0));
        const padX = width ? Math.round(width * paddingPercent / 100) : 0; const padY = height ? Math.round(height * paddingPercent / 100) : 0;
        const innerWidth = width ? Math.max(1, width - padX * 2) : undefined; const innerHeight = height ? Math.max(1, height - padY * 2) : undefined;
        image = image.resize(innerWidth || null, innerHeight || null, { fit, withoutEnlargement: false, background: backgroundMode === "transparent" ? { r: 0, g: 0, b: 0, alpha: 0 } : background });
        if (padX || padY) image = image.extend({ top: padY, bottom: padY, left: padX, right: padX, background: backgroundMode === "transparent" ? { r: 0, g: 0, b: 0, alpha: 0 } : background });
        if (backgroundMode === "blur") image = image.ensureAlpha();
      }
      if (backgroundMode === "blur" && width && height) {
        const blurredBackground = await sharp(data).resize(width, height, { fit: "cover" }).blur(22).ensureAlpha().png().toBuffer();
        const foreground = await image.ensureAlpha().png().toBuffer();
        image = sharp(blurredBackground).composite([{ input: foreground, gravity: "center" }]);
      }
      const cropWidth = typeof options.cropWidth === "number" && options.cropWidth > 0 ? Math.round(options.cropWidth) : 0;
      const cropHeight = typeof options.cropHeight === "number" && options.cropHeight > 0 ? Math.round(options.cropHeight) : 0;
      if (options.operation === "crop" && cropWidth && cropHeight) {
        const cropMetadata = await image.metadata(); const sourceWidth = cropMetadata.width ?? cropWidth; const sourceHeight = cropMetadata.height ?? cropHeight; const left = Math.min(Math.max(0, Math.round(Number(options.cropX) || 0)), Math.max(0, sourceWidth - 1)); const top = Math.min(Math.max(0, Math.round(Number(options.cropY) || 0)), Math.max(0, sourceHeight - 1)); image = image.extract({ left, top, width: Math.min(cropWidth, sourceWidth - left), height: Math.min(cropHeight, sourceHeight - top) });
      }
      const rotate = Number(options.rotate) || 0;
      if (rotate === 90 || rotate === 180 || rotate === 270) image = image.rotate(rotate);
      if (options.flip === "horizontal") image = image.flop();
      if (options.flip === "vertical") image = image.flip();
      if (options.operation === "adjust" || options.brightness !== undefined || options.contrast !== undefined || options.saturation !== undefined || options.hue !== undefined) image = image.modulate({ brightness: Math.max(0, 1 + (Number(options.brightness) || 0) / 100), saturation: Math.max(0, 1 + (Number(options.saturation) || 0) / 100), hue: Number(options.hue) || 0 }).linear(1 + (Number(options.contrast) || 0) / 100, 128 - 128 * (Number(options.contrast) || 0) / 100);
      if (options.blur !== undefined || options.operation === "blur") image = image.blur(Math.max(0.3, Number(options.blur) || 3));
      if (options.sharpen !== undefined || options.operation === "sharpen") image = image.sharpen(Math.max(0.1, Number(options.sharpen) || 1));
      const finalMetadata = await image.metadata();
      const mask = options.mask === "circle" || options.cornerRadiusMode === "circle" ? "circle" : options.mask === "rounded" || options.cornerRadiusMode === "rounded" ? "rounded" : "none";
      if (mask !== "none") {
        const maskWidth = width ?? finalMetadata.width ?? metadata.width ?? 1; const maskHeight = height ?? finalMetadata.height ?? metadata.height ?? 1; const radius = mask === "circle" ? Math.min(maskWidth, maskHeight) / 2 : Math.min(maskWidth, maskHeight) * 0.18;
        const shape = mask === "circle" ? `<circle cx="${maskWidth / 2}" cy="${maskHeight / 2}" r="${radius}" fill="white"/>` : `<rect x="0" y="0" width="${maskWidth}" height="${maskHeight}" rx="${radius}" fill="white"/>`;
        image = image.ensureAlpha().composite([{ input: Buffer.from(`<svg width="${maskWidth}" height="${maskHeight}" xmlns="http://www.w3.org/2000/svg">${shape}</svg>`), blend: "dest-in" }]);
      }
      const quality = typeof options.quality === "number" ? Math.min(100, Math.max(1, Math.round(options.quality))) : 85;
      const buffer = await applyFormat(image, outputFormat, quality, color).toBuffer();
      return { data: new Uint8Array(buffer), mimeType: `image/${outputFormat === "jpeg" ? "jpeg" : outputFormat}`, extension: outputFormat === "jpeg" ? "jpg" : outputFormat };
    },
    compose: async (data: Uint8Array[], options: Record<string, unknown>) => {
      const images = await Promise.all(data.map(async (value) => ({ value, metadata: await sharp(value).metadata() })));
      if (!images.length) throw new Error("No images to compose.");
      const direction = options.direction === "horizontal" ? "horizontal" : "vertical";
      const sizeMode = options.sizeMode === "original" ? "original" : options.sizeMode === "custom" ? "custom" : "first";
      const gap = Math.max(0, Math.round(Number(options.gap) || 0)); const overlap = Math.max(0, Math.round(Number(options.overlap) || 0)); const spacing = gap - overlap; const padding = Math.max(0, Math.round(Number(options.outerPadding) || 0));
      const firstWidth = images[0]!.metadata.width ?? 1; const firstHeight = images[0]!.metadata.height ?? 1;
      const span = sizeMode === "original" ? undefined : sizeMode === "custom" ? Math.max(1, Math.round(Number(options.customSize) || 1080)) : direction === "vertical" ? firstWidth : firstHeight;
      const resized = await Promise.all(images.map(async (item) => { const width = item.metadata.width ?? 1; const height = item.metadata.height ?? 1; const ratio = span ? span / (direction === "vertical" ? width : height) : 1; const nextWidth = Math.max(1, Math.round(width * ratio)); const nextHeight = Math.max(1, Math.round(height * ratio)); return { buffer: await sharp(item.value).resize(nextWidth, nextHeight, { fit: "fill" }).png().toBuffer(), width: nextWidth, height: nextHeight }; }));
      const contentWidth = direction === "vertical" ? Math.max(...resized.map((item) => item.width)) : Math.max(1, resized.reduce((sum, item) => sum + item.width, 0) + spacing * Math.max(0, resized.length - 1));
      const contentHeight = direction === "vertical" ? Math.max(1, resized.reduce((sum, item) => sum + item.height, 0) + spacing * Math.max(0, resized.length - 1)) : Math.max(...resized.map((item) => item.height));
      const composites: sharp.OverlayOptions[] = []; let cursor = padding;
      resized.forEach((item) => { const left = direction === "vertical" ? padding + Math.round((contentWidth - item.width) / 2) : cursor; const top = direction === "vertical" ? cursor : padding + Math.round((contentHeight - item.height) / 2); composites.push({ input: item.buffer, left, top }); cursor += (direction === "vertical" ? item.height : item.width) + spacing; });
      const base = sharp({ create: { width: Math.max(1, contentWidth + padding * 2), height: Math.max(1, contentHeight + padding * 2), channels: 4, background: options.transparentBackground ? { r: 0, g: 0, b: 0, alpha: 0 } : (typeof options.backgroundColor === "string" ? options.backgroundColor : "#ffffff") } });
      const composedBuffer = await base.composite(composites).png().toBuffer();
      let composed = sharp(composedBuffer);
      const redactions = Array.isArray(options.redactions) ? options.redactions as Array<Record<string, unknown>> : [];
      const canvasWidth = contentWidth + padding * 2; const canvasHeight = contentHeight + padding * 2;
      for (const redact of redactions) {
        const redactWidth = Math.max(1, Math.round(Number(redact.width) || 1)); const redactHeight = Math.max(1, Math.round(Number(redact.height) || 1)); const left = Math.max(0, Math.min(canvasWidth - 1, Math.round(Number(redact.x) || 0))); const top = Math.max(0, Math.min(canvasHeight - 1, Math.round(Number(redact.y) || 0))); const width = Math.min(redactWidth, canvasWidth - left); const height = Math.min(redactHeight, canvasHeight - top); const kind = stringOption(redact, "kind", "black");
        if (kind === "blur" || kind === "pixelate") {
          const region = sharp(composedBuffer).extract({ left, top, width, height });
          const processed = kind === "blur" ? region.blur(Math.max(2, Number(redact.radius) || 10)) : region.resize(Math.max(1, Math.round(width / 12)), Math.max(1, Math.round(height / 12)), { fit: "fill" }).resize(width, height, { fit: "fill", kernel: "nearest" });
          composed = composed.composite([{ input: await processed.png().toBuffer(), left, top }]);
        } else {
          const fill = safeColor(redact.fillColor, kind === "white" ? "#ffffff" : kind === "translucent" ? "#ef4444" : "#000000"); const stroke = safeColor(redact.strokeColor, "#ef4444"); const opacity = Math.max(0, Math.min(1, Number(redact.opacity) || 1)); const strokeWidth = Math.max(1, Number(redact.strokeWidth) || 4); const noFill = redact.noFill === true || kind === "outline";
          const shape = kind === "ellipse" ? `<ellipse cx="${width / 2}" cy="${height / 2}" rx="${width / 2}" ry="${height / 2}" fill="${noFill ? "none" : fill}"/>` : kind === "line" || kind === "arrow" ? `<line x1="0" y1="0" x2="${width}" y2="${height}"/>${kind === "arrow" ? `<path d="M${width} ${height} l-14 -4 l4 -14 z" fill="${stroke}"/>` : ""}` : `<rect width="100%" height="100%" fill="${noFill ? "none" : fill}"/>`;
          composed = composed.composite([{ input: Buffer.from(`<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg"><g opacity="${opacity}" stroke="${stroke}" stroke-width="${strokeWidth}" fill="${noFill ? "none" : fill}">${shape}</g></svg>`), left, top }]);
        }
      }
      const labels = Array.isArray(options.labels) ? options.labels as Array<Record<string, unknown>> : [];
      if (labels.length) {
        const labelSvg = labels.map((label) => { const x = Math.max(0, Number(label.x) || 0); const y = Math.max(0, Number(label.y) || 0); const text = safeSvgText(stringOption(label, "text", "")); const fill = safeColor(label.color, "#ffffff"); const background = safeColor(label.backgroundColor, "#111827"); const fontSize = Math.max(8, Number(label.fontSize) || 24); const fontWeight = label.bold === false ? "normal" : "700"; const width = Math.max(24, text.length * fontSize * 0.6 + 16); const height = fontSize * 1.35; return `<g><rect x="${x}" y="${y}" width="${width}" height="${height}" rx="${Math.round(fontSize * 0.2)}" fill="${label.noBackground === true ? "none" : background}"/><text x="${x + 8}" y="${y + fontSize}" fill="${fill}" font-size="${fontSize}" font-family="sans-serif" font-weight="${fontWeight}">${text}</text></g>`; }).join("");
        composed = composed.composite([{ input: Buffer.from(`<svg width="${canvasWidth}" height="${canvasHeight}" xmlns="http://www.w3.org/2000/svg">${labelSvg}</svg>`) }]);
      }
      const format = options.outputFormat === "jpeg" ? "jpeg" : options.outputFormat === "webp" ? "webp" : "png"; const quality = Math.min(100, Math.max(1, Math.round(Number(options.quality) || 92)));
      const buffer = await applyFormat(composed, format, quality, typeof options.backgroundColor === "string" ? options.backgroundColor : "#ffffff").toBuffer();
      return { data: new Uint8Array(buffer), mimeType: `image/${format}`, extension: format === "jpeg" ? "jpg" : format };
    },
    extractFrames: async (data: Uint8Array, options: Record<string, unknown>) => {
      const source = sharp(data, { animated: true }); const metadata = await source.metadata(); const pages = Math.max(1, metadata.pages ?? 1); const requested = typeof options.frameRange === "string" ? options.frameRange.split(",").flatMap((part) => { const [startValue, endValue] = part.trim().split("-").map(Number); const start = typeof startValue === "number" && Number.isFinite(startValue) ? Math.max(1, startValue) : 1; const end = typeof endValue === "number" && Number.isFinite(endValue) ? Math.max(start, endValue) : start; return Array.from({ length: end - start + 1 }, (_, offset) => start - 1 + offset); }).filter((index) => index >= 0 && index < pages) : []; const selectedFrames = requested.length ? [...new Set(requested)] : Array.from({ length: pages }, (_, index) => index);
      const format = options.outputFormat === "jpeg" ? "jpeg" : options.outputFormat === "webp" ? "webp" : "png";
      const results = [];
      for (const index of selectedFrames) { let image = sharp(data, { page: index }); if (Number(options.width) > 0 || Number(options.height) > 0) image = image.resize(Number(options.width) > 0 ? Number(options.width) : null, Number(options.height) > 0 ? Number(options.height) : null, { fit: "inside" }); if (options.crop && typeof options.crop === "object") { const crop = options.crop as Record<string, unknown>; const cropWidth = Math.max(1, Math.round(Number(crop.width) || 0)); const cropHeight = Math.max(1, Math.round(Number(crop.height) || 0)); const cropMetadata = await image.metadata(); const sourceWidth = cropMetadata.width ?? cropWidth; const sourceHeight = cropMetadata.height ?? cropHeight; const left = Math.min(Math.max(0, Math.round(Number(crop.x) || 0)), Math.max(0, sourceWidth - 1)); const top = Math.min(Math.max(0, Math.round(Number(crop.y) || 0)), Math.max(0, sourceHeight - 1)); if (cropWidth > 0 && cropHeight > 0) image = image.extract({ left, top, width: Math.min(cropWidth, sourceWidth - left), height: Math.min(cropHeight, sourceHeight - top) }); } const buffer = await applyFormat(image, format, 92, "#ffffff").toBuffer(); const delayMs = Array.isArray(metadata.delay) ? metadata.delay[index] ?? 83 : 83; results.push({ data: new Uint8Array(buffer), mimeType: `image/${format}`, extension: format === "jpeg" ? "jpg" : format, index, delayMs }); }
      return results;
    },
    encodeFrames: async (frames: Array<{ data: Uint8Array; delayMs?: number }>, options: Record<string, unknown>) => {
      const frameBuffers = frames.map((frame) => Buffer.from(frame.data));
      if (frameBuffers.length === 0) throw new Error("No frames to encode.");
      const metadata = await sharp(frameBuffers[0]).metadata(); const width = metadata.width ?? 1; const height = metadata.height ?? 1;
      const joined = await sharp({ create: { width, height, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).composite([{ input: frameBuffers[0] }]).gif({ loop: options.loop === false ? 1 : 0, delay: Math.max(20, Math.round(Number(options.delayMs) || 83)) }).toBuffer();
      return { data: new Uint8Array(joined), mimeType: "image/gif", extension: "gif" };
    },
    renderProject: async (data: Uint8Array, options: Record<string, unknown>) => {
      let image = sharp(data).ensureAlpha();
      const cropWidth = Math.max(0, Math.round(Number(options.cropWidth) || 0)); const cropHeight = Math.max(0, Math.round(Number(options.cropHeight) || 0));
      if (cropWidth && cropHeight) { const metadata = await image.metadata(); const sourceWidth = metadata.width ?? cropWidth; const sourceHeight = metadata.height ?? cropHeight; const left = Math.min(Math.max(0, Math.round(Number(options.cropX) || 0)), Math.max(0, sourceWidth - 1)); const top = Math.min(Math.max(0, Math.round(Number(options.cropY) || 0)), Math.max(0, sourceHeight - 1)); image = image.extract({ left, top, width: Math.min(cropWidth, sourceWidth - left), height: Math.min(cropHeight, sourceHeight - top) }); }
      const rotation = Number(options.rotate) || 0; if (rotation === 90 || rotation === 180 || rotation === 270) image = image.rotate(rotation); if (options.flip === "horizontal") image = image.flop(); if (options.flip === "vertical") image = image.flip();
      if (Number(options.brightness) || Number(options.saturation) || Number(options.hue) || Number(options.contrast)) image = image.modulate({ brightness: Math.max(0, 1 + (Number(options.brightness) || 0) / 100), saturation: Math.max(0, 1 + (Number(options.saturation) || 0) / 100), hue: Number(options.hue) || 0 }).linear(1 + (Number(options.contrast) || 0) / 100, 128 - 128 * (Number(options.contrast) || 0) / 100);
      if (Number(options.blur) > 0) image = image.blur(Math.max(0.3, Number(options.blur))); if (Number(options.sharpen) > 0) image = image.sharpen(Math.max(0.1, Number(options.sharpen)));
      const metadata = await image.metadata(); const width = metadata.width ?? 1; const height = metadata.height ?? 1; const layers = Array.isArray(options.layers) ? options.layers.filter((value): value is Record<string, unknown> => Boolean(value && typeof value === "object" && value.visible !== false)) : [];
      const shapes = layers.filter((layer) => stringOption(layer, "type", "rectangle") !== "eraser").map((layer) => { const x = Number(layer.x) || 0; const y = Number(layer.y) || 0; const w = Math.max(1, Number(layer.width) || 100); const h = Math.max(1, Number(layer.height) || 100); const fill = safeColor(layer.fill, "#ffffff"); const stroke = safeColor(layer.stroke, "#000000"); const strokeWidth = Math.max(0, Number(layer.strokeWidth) || 0); const transform = `rotate(${Number(layer.rotation) || 0} ${x + w / 2} ${y + h / 2})`; const type = stringOption(layer, "type", "rectangle"); if (type === "text") return `<text x="${x}" y="${y + h}" fill="${fill}" opacity="${Math.max(0, Math.min(1, Number(layer.opacity) || 1))}" font-size="${Math.max(8, Number(layer.fontSize) || 32)}" font-family="sans-serif">${safeSvgText(stringOption(layer, "text", ""))}</text>`; if (type === "ellipse" || type === "circle") return `<ellipse cx="${x + w / 2}" cy="${y + h / 2}" rx="${w / 2}" ry="${h / 2}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" transform="${transform}"/>`; if (type === "line" || type === "arrow") return `<line x1="${x}" y1="${y}" x2="${x + w}" y2="${y + h}" stroke="${stroke}" stroke-width="${Math.max(1, strokeWidth || 4)}" marker-end="${type === "arrow" ? "url(#arrow)" : ""}"/>`; if (type === "path" || type === "brush") return `<path d="${safeSvgText(stringOption(layer, "path", ""))}" fill="none" stroke="${stroke}" stroke-width="${Math.max(1, strokeWidth || 4)}" stroke-linecap="round"/>`; return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${Math.max(0, Number(layer.radius) || 0)}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" transform="${transform}"/>`; }).join("");
      const svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg"><defs><marker id="arrow" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto"><path d="M0,0 L0,6 L9,3 z" fill="#000"/></marker></defs>${shapes}</svg>`;
      image = image.composite([{ input: Buffer.from(svg) }]);
      for (const layer of layers.filter((candidate) => stringOption(candidate, "type", "") === "eraser")) { const pathData = safeSvgText(stringOption(layer, "path", "")); const strokeWidth = Math.max(1, Number(layer.strokeWidth) || 8); image = image.composite([{ input: Buffer.from(`<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg"><path d="${pathData}" fill="none" stroke="white" stroke-width="${strokeWidth}" stroke-linecap="round"/></svg>`), blend: "dest-out" }]); }
      const format = options.outputFormat === "jpeg" ? "jpeg" : options.outputFormat === "webp" ? "webp" : "png"; const encoded = await applyFormat(image, format, Math.max(1, Math.min(100, Math.round(Number(options.quality) || 92))), safeColor(options.backgroundColor)).toBuffer();
      return { data: new Uint8Array(encoded), mimeType: `image/${format === "jpeg" ? "jpeg" : format}`, extension: format === "jpeg" ? "jpg" : format };
    },
  };
}

function findFfmpeg(): string {
  const isPackaged = process.env.SUWOL_APP_PACKAGED === "1";
  const configured = process.env.SUWOL_FFMPEG_PATH;
  if (!isPackaged && configured && existsSync(configured)) return configured;
  const platformDirectory = process.platform === "win32" ? "win-x64" : process.platform === "darwin" ? (process.arch === "arm64" ? "mac-arm64" : "mac-x64") : "linux-x64";
  const filename = process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg";
  const packagedCandidates = isPackaged ? [path.join(process.resourcesPath, "ffmpeg", platformDirectory, filename)] : [];
  const packaged = packagedCandidates.find((candidate) => existsSync(candidate));
  if (packaged) return packaged;
  // ffmpeg-static is a host-platform development fallback. A packaged app must
  // never select a cross-built host binary; packaged resources or the platform
  // command are the only valid production candidates.
  if (!isPackaged && ffmpegStatic && existsSync(ffmpegStatic)) return ffmpegStatic;
  throw new Error("이 배포판에는 현재 플랫폼용 FFmpeg가 포함되지 않았습니다. 해당 미디어 도구는 비활성화됩니다.");
}

function createPdfCodec(reportProgress: (fraction: number) => void) {
  return {
    renderPages: (data: Uint8Array, options: Record<string, unknown>) => renderPdfPages(data, options, reportProgress),
  };
}

export function createMediaCodec(reportProgress: (fraction: number) => void) {
  async function runFfmpeg(command: string, args: string[], duration: number, onProgress?: (fraction: number) => void): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      const child = spawn(command, args, { stdio: ["ignore", "ignore", "pipe"] });
      activeChild = child;
      let stderr = ""; let lastProgress = 0;
      child.stderr?.on("data", (chunk: Buffer) => { const text = chunk.toString(); stderr += text; const match = text.match(/out_time_ms=(\d+)/); if (match) { const fraction = Math.min(0.99, Number(match[1]) / Math.max(1, duration * 1_000_000)); if (fraction > lastProgress) { lastProgress = fraction; (onProgress ?? reportProgress)(fraction); } } });
      child.once("error", (error) => { activeChild = undefined; reject(new Error(`FFmpeg를 실행할 수 없습니다. SUWOL_FFMPEG_PATH 또는 패키지 리소스를 확인하세요: ${error.message}`)); });
      child.once("close", (code, signal) => { activeChild = undefined; if (code === 0) resolve(); else reject(new Error(signal === "SIGTERM" ? "FFmpeg 작업이 취소되었습니다." : `FFmpeg 처리 실패(${code ?? signal}): ${stderr.slice(-1000)}`)); });
    });
  }
  return {
    convertFile: async (sourcePath: string, options: Record<string, unknown>, onProgress?: (fraction: number) => void) => {
      const directory = await mkdtemp(path.join(os.tmpdir(), "suwol-media-"));
      const format = ["wav", "mp3", "flac", "ogg", "m4a", "webp", "gif"].includes(String(options.outputFormat)) ? String(options.outputFormat) : "wav";
      const filePath = path.join(directory, `${randomUUID()}.${format}`);
      const args = ["-hide_banner", "-y"];
      if (typeof options.start === "number" && options.start > 0) args.push("-ss", String(options.start));
      if (typeof options.duration === "number" && options.duration > 0) args.push("-t", String(options.duration));
      if (typeof options.loopCount === "number" && options.loopCount > 1) args.push("-stream_loop", String(Math.round(options.loopCount) - 1));
      if (sourcePath) args.push("-i", sourcePath); else args.push("-f", "lavfi", "-i", `sine=frequency=${Math.max(20, Number(options.frequency) || 440)}:duration=${Math.max(0.1, Number(options.duration) || 1)}`);
      const filters: string[] = [];
      if (typeof options.volumeDb === "number") filters.push(`volume=${options.volumeDb}dB`);
      if (typeof options.fadeSeconds === "number") filters.push(`afade=t=${options.fadeDirection === "out" ? "out" : "in"}:d=${Math.max(0.01, options.fadeSeconds)}`);
      if (typeof options.speed === "number" && options.speed !== 1) { let speed = Math.max(0.25, Math.min(4, options.speed)); while (speed > 2) { filters.push("atempo=2"); speed /= 2; } while (speed < 0.5) { filters.push("atempo=0.5"); speed *= 2; } filters.push(`atempo=${speed}`); }
      if (typeof options.deleteStart === "number" && typeof options.deleteEnd === "number" && options.deleteEnd > options.deleteStart) filters.push(`aselect='not(between(t,${Math.max(0, options.deleteStart)},${Math.max(options.deleteStart, options.deleteEnd)}))',asetpts=N/SR/TB`);
      if (typeof options.silenceThresholdDb === "number") filters.push(`silenceremove=stop_periods=-1:stop_duration=${Math.max(0.01, Number(options.silenceDuration) || 0.2)}:stop_threshold=${options.silenceThresholdDb}dB`);
      if (options.normalize === true) filters.push("loudnorm=I=-16:TP=-1.5:LRA=11");
      if (options.reverse === true) filters.push("areverse");
      if (filters.length) args.push("-af", filters.join(","));
      if (options.channels === "mono") args.push("-ac", "1"); else if (options.channels === "stereo") args.push("-ac", "2");
      if (typeof options.sampleRate === "number" && options.sampleRate >= 8000) args.push("-ar", String(Math.round(options.sampleRate)));
      if (typeof options.bitrate === "number" && options.bitrate > 0) args.push("-b:a", `${Math.round(options.bitrate)}k`);
      if (format === "gif" || format === "webp") {
        const fps = Math.max(1, Number(options.fps) || 12); const width = Math.max(2, Math.round(Number(options.width) || 640)); const height = Number(options.height) > 0 ? Math.max(2, Math.round(Number(options.height))) : -2; const crop = options.crop && typeof options.crop === "object" ? options.crop as Record<string, unknown> : undefined; const filtersVideo = [`fps=${fps}`, `scale=${width}:${height}:force_original_aspect_ratio=${options.keepAspectRatio === false ? "disable" : "decrease"}:flags=lanczos`]; if (crop) filtersVideo.push(`crop=${Math.max(2, Number(crop.width) || width)}:${Math.max(2, Number(crop.height) || height)}:${Math.max(0, Number(crop.x) || 0)}:${Math.max(0, Number(crop.y) || 0)}`); if (Number(options.rotate) === 90) filtersVideo.push("transpose=1"); else if (Number(options.rotate) === 270) filtersVideo.push("transpose=2"); else if (Number(options.rotate) === 180) filtersVideo.push("hflip,vflip"); args.push("-vf", filtersVideo.join(","), "-an", "-loop", options.loop === false ? "1" : "0"); if (format === "webp") args.push("-q:v", String(Math.max(1, Math.min(100, Math.round(Number(options.quality) || 75)))), "-preset", String(options.preset ?? "picture"));
      } else if (format === "m4a") args.push("-c:a", "aac"); else if (format === "mp3") args.push("-c:a", "libmp3lame"); else if (format === "flac") args.push("-c:a", "flac"); else if (format === "ogg") args.push("-c:a", "libvorbis");
      args.push("-progress", "pipe:2", "-nostats", filePath);
      const command = findFfmpeg();
      try { await runFfmpeg(command, args, Math.max(0.1, Number(options.duration) || 10), onProgress); } catch (error) { await rm(directory, { recursive: true, force: true }).catch(() => undefined); throw error; }
      const size = (await stat(filePath)).size;
      const mimeType = format === "wav" ? "audio/wav" : format === "mp3" ? "audio/mpeg" : format === "flac" ? "audio/flac" : format === "ogg" ? "audio/ogg" : format === "m4a" ? "audio/mp4" : `image/${format}`;
      return { filePath, mimeType, extension: format, size };
    },
    encodeFrames: async (frames: Array<{ data: Uint8Array; delayMs?: number }>, options: Record<string, unknown>, onProgress?: (fraction: number) => void) => {
      const directory = await mkdtemp(path.join(os.tmpdir(), "suwol-gif-")); const outputPath = path.join(directory, `${randomUUID()}.${options.outputFormat === "webp" ? "webp" : "gif"}`);
      try {
        const fps = Math.max(1, Math.round(Number(options.fps) || 12)); const defaultDelay = 1000 / fps; const manifestLines: string[] = []; let totalDuration = 0;
        for (let index = 0; index < frames.length; index += 1) { const framePath = path.join(directory, `frame-${String(index + 1).padStart(6, "0")}.png`); await writeFile(framePath, frames[index]!.data); const delay = Math.max(20, Number(frames[index]!.delayMs) || defaultDelay); totalDuration += delay; manifestLines.push(`file '${framePath.replaceAll("'", "'\\''")}'`, `duration ${(delay / 1000).toFixed(6)}`); }
        if (frames.length) manifestLines.push(manifestLines.at(-2)!);
        const manifestPath = path.join(directory, "frames.txt"); await writeFile(manifestPath, `${manifestLines.join("\n")}\n`);
        const format = options.outputFormat === "webp" ? "webp" : "gif"; const loopCount = Number.isFinite(Number(options.loopCount)) ? Math.max(0, Math.round(Number(options.loopCount))) : options.loop === false ? 1 : 0; const args = ["-hide_banner", "-y", "-f", "concat", "-safe", "0", "-i", manifestPath, "-an", "-vsync", "vfr"]; if (format === "gif") args.push("-loop", String(loopCount)); else args.push("-c:v", "libwebp", "-lossless", "0", "-q:v", String(Math.max(1, Math.min(100, Math.round(Number(options.quality) || 85)))), "-loop", String(loopCount)); args.push("-progress", "pipe:2", "-nostats", outputPath); await runFfmpeg(findFfmpeg(), args, Math.max(0.1, totalDuration / 1000), onProgress); const size = (await stat(outputPath)).size; return { filePath: outputPath, mimeType: format === "gif" ? "image/gif" : "image/webp", extension: format, size };
      } catch (error) { await rm(directory, { recursive: true, force: true }).catch(() => undefined); throw error; }
    },
  };
}

async function run(request: WorkerRequest) {
  let cancelled = false;
  let paused = false;
  let pauseAcknowledged = false;
  let pauseResolver: (() => void) | undefined;
  const waitIfPaused = async () => {
    if (!paused) return;
    if (!pauseAcknowledged) { pauseAcknowledged = true; parentPort?.postMessage({ type: "paused", jobId: request.job.id }); }
    await new Promise<void>((resolve) => { pauseResolver = resolve; });
    pauseAcknowledged = false;
    parentPort?.postMessage({ type: "resumed", jobId: request.job.id });
  };
  activeCancel = () => { cancelled = true; activeChild?.kill("SIGTERM"); pauseResolver?.(); };
  activePause = () => { paused = true; };
  activeResume = () => { paused = false; pauseResolver?.(); pauseResolver = undefined; };
  const resolved: ResolvedInput[] = request.inputs.map((input) => ({ ...input, sourcePath: input.sourcePath, read: () => readFile(input.sourcePath).then((value) => new Uint8Array(value)) }));
  const io: FileIoAdapter = {
    writeOutput: async ({ input, output, target, relativeOutputPath }) => {
      const root = outputRoot(input, target);
      const safeRelative = sanitizeRelativePath(relativeOutputPath);
      const candidate = ensureChildPath(root, safeRelative);
      if (!isWithin(root, candidate)) throw new Error("Output path escapes the approved root.");
      const selected = await collisionPath(candidate, target);
      if (!selected) { if (output.filePath) { const temporaryDirectory = path.dirname(output.filePath); await rm(output.filePath, { force: true }).catch(() => undefined); await rm(temporaryDirectory, { recursive: true, force: true }).catch(() => undefined); } return { inputName: input.name, outputName: path.basename(candidate), mimeType: output.mimeType, size: 0, skipped: true }; }
      await mkdir(path.dirname(selected), { recursive: true });
      const temporary = `${selected}.${request.job.id}.part`;
      if (output.data) await writeFile(temporary, output.data);
      else if (output.filePath) await copyFile(output.filePath, temporary);
      else throw new Error("Processor returned no output data.");
      await rename(temporary, selected);
      if (output.filePath) { const temporaryDirectory = path.dirname(output.filePath); await rm(output.filePath, { force: true }).catch(() => undefined); await rm(temporaryDirectory, { recursive: true, force: true }).catch(() => undefined); }
      return { inputName: input.name, outputName: path.basename(selected), path: selected, mimeType: output.mimeType, size: output.size ?? output.data?.byteLength ?? 0 };
    },
  };
  const result = await executeJob({ job: request.job, inputs: resolved }, io, {
    imageCodec: createImageCodec(),
    iconCodec: {
      createIco: (png) => { const value = PNG2ICONS.createICO(Buffer.from(png), PNG2ICONS.BICUBIC, 0, true, false); if (!value) throw new Error("ICO generation failed."); return new Uint8Array(value); },
      createIcns: (png) => { const value = PNG2ICONS.createICNS(Buffer.from(png), PNG2ICONS.BICUBIC, 0); if (!value) throw new Error("ICNS generation failed."); return new Uint8Array(value); },
    },
    mediaCodec: createMediaCodec((fraction) => parentPort?.postMessage({ type: "progress", jobId: request.job.id, processedItems: 0, totalItems: request.inputs.length, bytesProcessed: 0, fraction })),
    pdfCodec: createPdfCodec((fraction) => parentPort?.postMessage({ type: "progress", jobId: request.job.id, processedItems: 0, totalItems: request.inputs.length, bytesProcessed: 0, fraction })),
    isCancelled: () => cancelled,
    waitIfPaused,
    onProgress: (progress) => parentPort?.postMessage({ type: "progress", jobId: request.job.id, ...progress }),
  });
  activeCancel = () => undefined; activePause = () => undefined; activeResume = () => undefined;
  return result;
}

parentPort?.on("message", async (message: WorkerRequest | WorkerControl) => {
  if ("type" in message) { if (message.type === "cancel") activeCancel(); if (message.type === "pause") activePause(); if (message.type === "resume") activeResume(); return; }
  try {
    const result = await run(message as WorkerRequest);
    parentPort?.postMessage({ type: "complete", jobId: (message as WorkerRequest).job.id, result });
  } catch (error) {
    parentPort?.postMessage({ type: "error", jobId: (message as WorkerRequest).job.id, error: error instanceof Error ? error.message : "Unknown worker error" });
  }
});
