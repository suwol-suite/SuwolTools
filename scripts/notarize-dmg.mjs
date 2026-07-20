import { access, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
const exec = promisify(execFile);
const root = process.cwd();
const release = path.join(root, "release");
const names = await (await import("node:fs/promises")).readdir(release);
const dmg = process.argv[2] ? path.resolve(process.argv[2]) : path.join(release, names.find((name) => /-mac-arm64\.dmg$/i.test(name)) ?? "");
await access(dmg);
const profile = process.env.NOTARYTOOL_PROFILE ?? "suwol-tools-notary-profile";
await mkdir(path.join(root, "diagnostics"), { recursive: true });
try {
  const result = await exec("xcrun", ["notarytool", "submit", dmg, "--keychain-profile", profile, "--wait", "--output-format", "json"], { maxBuffer: 4 * 1024 * 1024 });
  await writeFile(path.join(root, "diagnostics", "notary-dmg.json"), result.stdout, "utf8");
  await exec("xcrun", ["stapler", "staple", "-v", dmg]);
  await exec("xcrun", ["stapler", "validate", "-v", dmg]);
  console.log(`Notarized and stapled ${dmg}.`);
} catch (error) {
  const detail = error instanceof Error ? error.message : String(error);
  await writeFile(path.join(root, "diagnostics", "notary-dmg.json"), JSON.stringify({ error: detail, dmg, profile }, null, 2), "utf8");
  throw new Error(`DMG notarization failed. See diagnostics/notary-dmg.json: ${detail}`);
}
