import { access, copyFile, mkdir, readdir, rm } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const platform = process.argv[2] ?? "";
const version = JSON.parse(await (await import("node:fs/promises")).readFile(path.join(root, "package.json"), "utf8")).version;
if (!["win", "linux", "mac"].includes(platform)) throw new Error("Usage: node scripts/collect-release-artifact.mjs <win|linux|mac>");
const release = path.join(root, "release");
const output = path.join(root, "release-artifacts");
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
const entries = await readdir(release, { withFileTypes: true }).catch(() => []);
const selected = entries.filter((entry) => {
  if (!entry.isFile()) return false;
  const name = entry.name;
  if ((!name.includes(version) && !/^latest-(linux|mac)\.yml$/.test(name)) || name.startsWith("latest.yml") || name === "builder-debug.yml") return false;
  if (platform === "win") return /-win-x64-(setup|portable)\.exe(?:\.blockmap)?$/i.test(name);
  if (platform === "linux") return /-linux-x64\.(AppImage|tar\.gz)(?:\.blockmap)?$/i.test(name) || name === "latest-linux.yml";
  return /-mac-arm64\.(dmg|zip)(?:\.blockmap)?$/i.test(name) || name === "latest-mac.yml";
});
if (selected.length === 0) throw new Error(`No ${platform} artifacts for version ${version} found in ${release}.`);
for (const entry of selected) await copyFile(path.join(release, entry.name), path.join(output, entry.name));
for (const name of ["THIRD_PARTY_NOTICES.md", "suwol-release-public-key.asc"]) {
  await access(path.join(root, name)).then(() => copyFile(path.join(root, name), path.join(output, name))).catch(() => undefined);
}
console.log(`Collected ${selected.length} ${platform} release artifacts for ${version}.`);
