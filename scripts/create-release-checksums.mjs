import { createHash } from "node:crypto";
import { readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

const directory = path.resolve(process.argv[2] ?? "release-downloads");
const entries = (await readdir(directory, { withFileTypes: true })).filter((entry) => entry.isFile() && (/^Suwol[ .]Tools-/.test(entry.name) || /^latest-(linux|mac)\.yml$/.test(entry.name))).sort((a, b) => a.name.localeCompare(b.name));
if (!entries.length) throw new Error(`No release assets found in ${directory}.`);
const lines = [];
for (const entry of entries) lines.push(`${createHash("sha256").update(await readFile(path.join(directory, entry.name))).digest("hex")}  ${entry.name}`);
await writeFile(path.join(directory, "checksums.txt"), `${lines.join("\n")}\n`, "utf8");
console.log(`Wrote checksums.txt for ${entries.length} assets.`);
