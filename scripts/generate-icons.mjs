import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import png2icons from "png2icons";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const output = path.join(root, "build", "icons");
const svg = await readFile(path.join(root, "assets", "icon.svg"));
await mkdir(output, { recursive: true });
const master = await sharp(svg).resize(1024, 1024).png().toBuffer();
await writeFile(path.join(output, "icon.png"), master);
for (const size of [16, 24, 32, 48, 64, 96, 128, 256, 512]) await writeFile(path.join(output, `icon-${size}.png`), await sharp(master).resize(size, size).png().toBuffer());
const ico = png2icons.createICO(master, png2icons.BICUBIC, 0, false, true);
const icns = png2icons.createICNS(master, png2icons.BICUBIC, 0);
if (!ico || !icns) throw new Error("Could not generate application icons.");
await writeFile(path.join(output, "icon.ico"), ico);
await writeFile(path.join(output, "icon.icns"), icns);
