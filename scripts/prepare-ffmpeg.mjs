import { access, copyFile, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";

const root = process.cwd();
const output = path.join(root, "build", "ffmpeg");
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });

const sourceManifest = JSON.parse(await readFile(path.join(root, "config", "ffmpeg-sources.json"), "utf8"));
const targets = Object.entries(sourceManifest.platforms).map(([directory, descriptor]) => {
  const environmentName = descriptor.environment;
  const filename = directory === "win-x64" ? "ffmpeg.exe" : "ffmpeg";
  return [environmentName, directory, filename];
});
const manifest = { version: 1, generatedAt: new Date().toISOString(), binaries: {} };
const supplied = [];
for (const [environmentName, directory, filename] of targets) {
  const source = process.env[environmentName];
  const destination = path.join(output, directory, filename);
  await mkdir(path.dirname(destination), { recursive: true });
  if (source) {
    await access(source);
    const sha256 = createHash("sha256").update(await readFile(source)).digest("hex");
    const expected = process.env[`${environmentName}_SHA256`]?.trim().toLowerCase();
    if (!expected || !/^[a-f0-9]{64}$/.test(expected)) throw new Error(`${environmentName}_SHA256 must contain the expected 64-character SHA-256 digest.`);
    if (sha256 !== expected) throw new Error(`${environmentName} SHA-256 did not match ${environmentName}_SHA256.`);
    await copyFile(source, destination);
    manifest.binaries[directory] = { filename, sha256, source: process.env[`${environmentName}_SOURCE`] ?? "release-provided" };
    supplied.push(`${directory}: SHA-256 ${sha256}`);
  } else {
    await writeFile(path.join(output, directory, "README.txt"), `Set ${environmentName} and ${environmentName}_SHA256 to an LGPL-compatible FFmpeg binary before packaging this target.\n`);
  }
}
await writeFile(path.join(output, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
await writeFile(path.join(output, "README.txt"), [
  "Suwol Tools FFmpeg resource slots.", "",
  "This directory is populated by scripts/prepare-ffmpeg.mjs.",
  "A supplied binary is copied only after its environment-provided SHA-256 digest matches.",
  "Only LGPL-compatible builds may be distributed with the default application license.",
  "See THIRD_PARTY_NOTICES.md and docs/deployment.md for redistribution obligations.",
  supplied.length ? `Supplied in this build:\n${supplied.join("\n")}` : "No platform binary was supplied in this build; packaged media tools remain unavailable, while development may use ffmpeg-static or system FFmpeg.", "",
].join("\n"));
