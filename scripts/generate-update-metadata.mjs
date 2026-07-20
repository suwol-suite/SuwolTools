import { createHash } from "node:crypto";
import { readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

export function sha512Base64(bytes) { return createHash("sha512").update(bytes).digest("base64"); }
export function metadataFor(platform, version, artifact, bytes) {
  const digest = sha512Base64(bytes);
  return `version: ${version}\nfiles:\n  - url: ${JSON.stringify(artifact)}\n    sha512: ${digest}\n    size: ${bytes.byteLength}\npath: ${JSON.stringify(artifact)}\nsha512: ${digest}\nreleaseDate: ${new Date().toISOString()}\n`;
}

const platform = process.argv[2];
if (import.meta.url === `file://${process.argv[1]}`) {
  if (!["linux", "mac"].includes(platform)) throw new Error("Usage: node scripts/generate-update-metadata.mjs <linux|mac>");
  const root = process.cwd();
  const packageJson = JSON.parse(await readFile(path.join(root, "package.json"), "utf8"));
  const files = await readdir(path.join(root, "release"), { withFileTypes: true });
  const suffix = platform === "linux" ? "-linux-x64.AppImage" : "-mac-arm64.zip";
  const artifact = files.find((entry) => entry.isFile() && entry.name === `Suwol Tools-${packageJson.version}${suffix}`)?.name;
  if (!artifact) throw new Error(`Expected ${suffix} artifact for ${packageJson.version} was not found.`);
  const bytes = await readFile(path.join(root, "release", artifact));
  await writeFile(path.join(root, "release", `latest-${platform}.yml`), metadataFor(platform, packageJson.version, artifact, bytes), "utf8");
  console.log(`Generated latest-${platform}.yml for ${artifact}.`);
}
