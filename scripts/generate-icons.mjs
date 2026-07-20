import { createHash } from "node:crypto";
import { access, cp, mkdir, mkdtemp, readFile, rename, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import png2icons from "png2icons";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourcePath = path.join(root, "assets", "icon.png");
const outputPath = path.join(root, "build", "icons");
const requiredPngSizes = [16, 24, 32, 48, 64, 96, 128, 256, 512, 1024];
const icoSizes = [16, 20, 24, 32, 40, 48, 64, 128, 256];
const masterSize = 1024;
const safeMarginPercent = 8;

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function createPngIco(frames) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(frames.length, 4);
  const entries = [];
  let offset = header.length + frames.length * 16;
  for (const frame of frames) {
    const entry = Buffer.alloc(16);
    entry.writeUInt8(frame.size === 256 ? 0 : frame.size, 0);
    entry.writeUInt8(frame.size === 256 ? 0 : frame.size, 1);
    entry.writeUInt8(0, 2);
    entry.writeUInt8(0, 3);
    entry.writeUInt16LE(1, 4);
    entry.writeUInt16LE(32, 6);
    entry.writeUInt32LE(frame.data.byteLength, 8);
    entry.writeUInt32LE(offset, 12);
    entries.push(entry);
    offset += frame.data.byteLength;
  }
  return Buffer.concat([header, ...entries, ...frames.map((frame) => frame.data)]);
}

async function pngBuffer(image, size) {
  return sharp(image)
    .resize(size, size, { fit: "fill" })
    .toColorspace("srgb")
    .png({ compressionLevel: 9, adaptiveFiltering: false })
    .toBuffer();
}

async function inspectAlpha(buffer) {
  const { data, info } = await sharp(buffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let minAlpha = 255;
  let maxAlpha = 0;
  let visiblePixels = 0;
  let opaqueBlackPixels = 0;
  let edgePixels = 0;
  for (let y = 0; y < info.height; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      const index = (y * info.width + x) * info.channels;
      const alpha = data[index + info.channels - 1] ?? 0;
      const red = data[index] ?? 0;
      const green = data[index + 1] ?? 0;
      const blue = data[index + 2] ?? 0;
      minAlpha = Math.min(minAlpha, alpha);
      maxAlpha = Math.max(maxAlpha, alpha);
      if (alpha > 0) {
        visiblePixels += 1;
        if (alpha >= 250 && red <= 2 && green <= 2 && blue <= 2) opaqueBlackPixels += 1;
        if (x === 0 || y === 0 || x === info.width - 1 || y === info.height - 1) edgePixels += 1;
      }
    }
  }
  return { width: info.width, height: info.height, minAlpha, maxAlpha, visiblePixels, opaqueBlackPixels, edgePixels };
}

async function main() {
  await access(sourcePath);
  const source = await readFile(sourcePath);
  const sourceMetadata = await sharp(source).metadata();
  const sourceWidth = sourceMetadata.width ?? 0;
  const sourceHeight = sourceMetadata.height ?? 0;
  if (sourceWidth < 1024 || sourceHeight < 1024) throw new Error(`Icon source must be at least 1024px; received ${sourceWidth}x${sourceHeight}.`);
  if (!sourceMetadata.hasAlpha) throw new Error("Icon source must include an alpha channel.");
  const sourceAlpha = await inspectAlpha(source);
  if (sourceAlpha.maxAlpha === 0) throw new Error("Icon source is fully transparent.");

  const safeSize = Math.floor(masterSize * (1 - safeMarginPercent / 100));
  const leading = Math.floor((masterSize - safeSize) / 2);
  const trailing = masterSize - safeSize - leading;
  const master = await sharp(source)
    .ensureAlpha()
    .resize(safeSize, safeSize, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .extend({ top: leading, bottom: trailing, left: leading, right: trailing, background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .toColorspace("srgb")
    .png({ compressionLevel: 9, adaptiveFiltering: false })
    .toBuffer();
  const masterAlpha = await inspectAlpha(master);
  if (masterAlpha.width !== masterSize || masterAlpha.height !== masterSize || masterAlpha.minAlpha !== 0 || masterAlpha.edgePixels !== 0) throw new Error("Generated master icon failed transparent-canvas validation.");

  const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), "suwol-icons-"));
  const temporaryOutput = path.join(temporaryRoot, "icons");
  await mkdir(temporaryOutput, { recursive: true });
  try {
    const outputFiles = new Map();
    const writeOutput = async (name, data) => { await writeFile(path.join(temporaryOutput, name), data); outputFiles.set(name, data); };
    await writeOutput("icon.png", master);
    for (const size of requiredPngSizes) await writeOutput(`icon-${size}.png`, await pngBuffer(master, size));

    const icoFrames = [];
    for (const size of icoSizes) icoFrames.push({ size, data: await pngBuffer(master, size) });
    await writeOutput("icon.ico", createPngIco(icoFrames));
    const icns = png2icons.createICNS(master, png2icons.BICUBIC, 0);
    if (!icns) throw new Error("Could not generate macOS ICNS icon.");
    await writeOutput("icon.icns", icns);

    const manifest = {
      version: 1,
      source: { path: "assets/icon.png", sha256: sha256(source), width: sourceWidth, height: sourceHeight, hasAlpha: Boolean(sourceMetadata.hasAlpha), colorSpace: sourceMetadata.space ?? "unknown", upscaled: false },
      canvas: { width: masterSize, height: masterSize, safeMarginPercent },
      outputs: Object.fromEntries([...outputFiles.entries()].map(([name, data]) => [name, { sha256: sha256(data), bytes: data.byteLength }]))
    };
    await writeOutput("manifest.json", Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`, "utf8"));
    await rm(outputPath, { recursive: true, force: true });
    try {
      await rename(temporaryOutput, outputPath);
    } catch (error) {
      if (error?.code !== "EXDEV") throw error;
      await cp(temporaryOutput, outputPath, { recursive: true, force: true });
    }
  } catch (error) {
    await rm(temporaryRoot, { recursive: true, force: true });
    throw error;
  }
  await rm(temporaryRoot, { recursive: true, force: true });
  console.log(`Generated ${requiredPngSizes.length} PNG sizes, ICO (${icoSizes.join(", ")}), and ICNS from ${sourceWidth}x${sourceHeight} RGBA source.`);
}

await main();
