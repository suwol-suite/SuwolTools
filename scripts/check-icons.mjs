import { createHash } from "node:crypto";
import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourcePath = path.join(root, "assets", "icon.png");
const outputPath = path.join(root, "build", "icons");
const pngSizes = [16, 24, 32, 48, 64, 96, 128, 256, 512, 1024];
const icoSizes = [16, 20, 24, 32, 40, 48, 64, 128, 256];

function sha256(value) { return createHash("sha256").update(value).digest("hex"); }
function fail(message) { throw new Error(`Icon check failed: ${message}`); }

async function checkPng(filePath, expectedSize, { allowSource = false } = {}) {
  const data = await readFile(filePath);
  const metadata = await sharp(data).metadata();
  if (metadata.width !== expectedSize || metadata.height !== expectedSize) fail(`${path.relative(root, filePath)} is ${metadata.width}x${metadata.height}, expected ${expectedSize}x${expectedSize}.`);
  if (!allowSource && !metadata.hasAlpha) fail(`${path.relative(root, filePath)} has no alpha channel.`);
  const { data: raw, info } = await sharp(data).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let minAlpha = 255;
  let visible = 0;
  let opaqueBlack = 0;
  let edgeVisible = 0;
  let edgeOpaque = 0;
  for (let y = 0; y < info.height; y += 1) for (let x = 0; x < info.width; x += 1) {
    const index = (y * info.width + x) * info.channels;
    const alpha = raw[index + info.channels - 1] ?? 0;
    minAlpha = Math.min(minAlpha, alpha);
      if (alpha > 0) {
        visible += 1;
      if (alpha >= 250 && (raw[index] ?? 0) <= 2 && (raw[index + 1] ?? 0) <= 2 && (raw[index + 2] ?? 0) <= 2) opaqueBlack += 1;
        if (x === 0 || y === 0 || x === info.width - 1 || y === info.height - 1) {
          edgeVisible += 1;
          if (alpha >= 250) edgeOpaque += 1;
        }
    }
  }
  if (!allowSource && minAlpha !== 0) fail(`${path.relative(root, filePath)} has no transparent pixels.`);
  if (visible > 0 && opaqueBlack / visible > 0.98) fail(`${path.relative(root, filePath)} appears to have an opaque black background.`);
  if (!allowSource && edgeOpaque !== 0) fail(`${path.relative(root, filePath)} is clipped at the canvas edge.`);
  return { data, metadata, edgeVisible, edgeOpaque };
}

function parseIco(data) {
  if (data.readUInt16LE(0) !== 0 || data.readUInt16LE(2) !== 1) fail("icon.ico has an invalid ICO header.");
  const count = data.readUInt16LE(4);
  const sizes = [];
  let offset = 6;
  for (let index = 0; index < count; index += 1) {
    const width = data.readUInt8(offset) || 256;
    const height = data.readUInt8(offset + 1) || 256;
    const bytes = data.readUInt32LE(offset + 8);
    const imageOffset = data.readUInt32LE(offset + 12);
    if (imageOffset + bytes > data.byteLength) fail("icon.ico contains an out-of-range image frame.");
    const frame = data.subarray(imageOffset, imageOffset + bytes);
    if (width === 256 && !frame.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) fail("icon.ico 256px frame is not PNG encoded.");
    sizes.push(width === height ? width : `${width}x${height}`);
    offset += 16;
  }
  for (const size of icoSizes) if (!sizes.includes(size)) fail(`icon.ico is missing ${size}px frame.`);
  return sizes;
}

function parseIcns(data) {
  if (data.toString("ascii", 0, 4) !== "icns" || data.readUInt32BE(4) !== data.byteLength) fail("icon.icns has an invalid ICNS header.");
  const types = new Set();
  let offset = 8;
  while (offset + 8 <= data.byteLength) {
    const type = data.toString("ascii", offset, offset + 4);
    const length = data.readUInt32BE(offset + 4);
    if (length < 8 || offset + length > data.byteLength) fail("icon.icns contains an invalid chunk.");
    types.add(type);
    offset += length;
  }
  for (const type of ["ic11", "ic12", "ic07", "ic13", "ic08", "ic14", "ic09", "ic10"]) if (!types.has(type)) fail(`icon.icns is missing ${type}.`);
  return [...types];
}

await access(sourcePath);
const source = await readFile(sourcePath);
const sourceMetadata = await sharp(source).metadata();
if ((sourceMetadata.width ?? 0) < 1024 || (sourceMetadata.height ?? 0) < 1024) fail("source is below the 1024px no-upscale threshold.");
if (!sourceMetadata.hasAlpha) fail("source has no alpha channel.");
const builderConfig = await readFile(path.join(root, "electron-builder.yml"), "utf8");
for (const reference of ["build/icons/icon.png", "build/icons/icon.ico", "build/icons/icon.icns", "build/icons"]) if (!builderConfig.includes(reference)) fail(`electron-builder.yml does not reference ${reference}.`);
try { await access(path.join(root, "assets", "icon.svg")); fail("legacy assets/icon.svg still exists."); } catch (error) { if (error?.code !== "ENOENT") throw error; }
const checked = [];
for (const size of pngSizes) { await checkPng(path.join(outputPath, `icon-${size}.png`), size); checked.push(`icon-${size}.png`); }
const master = await checkPng(path.join(outputPath, "icon.png"), 1024);
const ico = parseIco(await readFile(path.join(outputPath, "icon.ico")));
const icns = parseIcns(await readFile(path.join(outputPath, "icon.icns")));
const manifest = JSON.parse(await readFile(path.join(outputPath, "manifest.json"), "utf8"));
if (manifest.source?.sha256 !== sha256(source)) fail("manifest source hash does not match assets/icon.png.");
if (manifest.outputs?.["icon.png"]?.sha256 !== sha256(master.data)) fail("manifest master hash does not match build/icons/icon.png.");
console.log(JSON.stringify({ source: { width: sourceMetadata.width, height: sourceMetadata.height, hasAlpha: sourceMetadata.hasAlpha }, png: checked.concat("icon.png"), ico, icns, manifest: path.relative(root, path.join(outputPath, "manifest.json")) }, null, 2));
