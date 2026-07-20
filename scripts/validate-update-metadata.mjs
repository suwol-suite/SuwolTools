import { createHash } from "node:crypto";
import { readFile, access } from "node:fs/promises";
import path from "node:path";

export function parseMetadata(text) {
  const version = text.match(/^version:\s*(.+)$/m)?.[1]?.trim();
  const artifact = text.match(/^path:\s*["']?(.+?)["']?\s*$/m)?.[1]?.trim();
  const digest = text.match(/^sha512:\s*(.+)$/m)?.[1]?.trim();
  const size = Number(text.match(/^    size:\s*(\d+)$/m)?.[1] ?? 0);
  return { version, artifact, digest, size };
}

const platform = process.argv[2];
if (import.meta.url === `file://${process.argv[1]}`) {
  if (!["linux", "mac"].includes(platform)) throw new Error("Usage: node scripts/validate-update-metadata.mjs <linux|mac>");
  const root = process.cwd();
  const packageJson = JSON.parse(await readFile(path.join(root, "package.json"), "utf8"));
  const metadataPath = path.join(root, "release", `latest-${platform}.yml`);
  const metadata = parseMetadata(await readFile(metadataPath, "utf8"));
  if (metadata.version !== packageJson.version || !metadata.artifact || !metadata.digest || !metadata.size) throw new Error("Update metadata is incomplete or version-mismatched.");
  const localArtifact = await access(path.join(root, "release", metadata.artifact)).then(() => metadata.artifact).catch(async () => {
    const fallback = metadata.artifact.replace("Suwol.Tools-", "Suwol Tools-");
    await access(path.join(root, "release", fallback));
    return fallback;
  });
  const bytes = await readFile(path.join(root, "release", localArtifact));
  const digest = createHash("sha512").update(bytes).digest("base64");
  if (digest !== metadata.digest || bytes.byteLength !== metadata.size) throw new Error("Update metadata checksum or size mismatch.");
  await access(path.join(root, "release", platform === "linux" ? "latest-linux.yml" : "latest-mac.yml"));
  console.log(`Validated ${platform} update metadata for ${metadata.artifact}.`);
}
