import { access, readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
const exec = promisify(execFile);
const platform = process.argv[2] ?? "";
if (!["win", "linux", "mac"].includes(platform)) throw new Error("Usage: node scripts/package-smoke-test.mjs <win|linux|mac>");
const root = process.cwd();
const version = JSON.parse(await readFile(path.join(root, "package.json"), "utf8")).version;
const names = await readdir(path.join(root, "release"));
const expected = platform === "win" ? [`Suwol Tools-${version}-win-x64-setup.exe`, `Suwol Tools-${version}-win-x64-portable.exe`] : platform === "linux" ? [`Suwol Tools-${version}-linux-x64.AppImage`, `Suwol Tools-${version}-linux-x64.tar.gz`, "latest-linux.yml"] : [`Suwol Tools-${version}-mac-arm64.dmg`, `Suwol Tools-${version}-mac-arm64.zip`, "latest-mac.yml"];
for (const name of expected) { await access(path.join(root, "release", name)); }
if (names.includes("latest.yml")) throw new Error("Windows latest.yml must not be published.");
if (platform === "mac") await exec("unzip", ["-t", path.join(root, "release", expected[1])]);
if (platform === "linux") await exec("tar", ["-tzf", path.join(root, "release", expected[1])]);
console.log(`Smoke-tested ${platform} ${version}: ${expected.join(", ")}`);
