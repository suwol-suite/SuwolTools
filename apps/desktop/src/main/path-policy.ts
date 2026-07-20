import { access, realpath, stat } from "node:fs/promises";
import path from "node:path";

export function isWithin(parent: string, candidate: string): boolean {
  const relative = path.relative(parent, candidate);
  return relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative));
}

export async function normalizeExistingPath(candidate: string, expected: "file" | "directory"): Promise<string> {
  if (typeof candidate !== "string" || candidate.length === 0 || candidate.length > 32768) throw new Error("Invalid path.");
  const resolved = path.resolve(candidate);
  await access(resolved);
  const normalized = await realpath(resolved);
  const info = await stat(normalized);
  if (expected === "file" && !info.isFile()) throw new Error("Expected a file.");
  if (expected === "directory" && !info.isDirectory()) throw new Error("Expected a directory.");
  return normalized;
}

export async function normalizeOutputDirectory(candidate: string): Promise<string> {
  if (typeof candidate !== "string" || candidate.length === 0 || candidate.length > 32768) throw new Error("Invalid output directory.");
  const resolved = path.resolve(candidate);
  const info = await stat(resolved).catch(() => undefined);
  if (info && !info.isDirectory()) throw new Error("Output target is not a directory.");
  return info ? realpath(resolved) : resolved;
}

export function ensureChildPath(parent: string, candidate: string): string {
  const resolved = path.resolve(parent, candidate);
  if (!isWithin(parent, resolved)) throw new Error("Path escapes the approved directory.");
  return resolved;
}
