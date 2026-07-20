import { rm } from "node:fs/promises";
import path from "node:path";
const metadata = path.join(process.cwd(), "release", "latest.yml");
await rm(metadata, { force: true });
console.log("Windows latest.yml removed; Windows updater metadata is not distributable.");
