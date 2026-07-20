import { randomUUID } from "node:crypto";
import { mkdir, readdir, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import type { InputItem, InputSource } from "@suwol/shared";
import { normalizeExistingPath } from "./path-policy";

type StoredHandle = InputItem & { path: string };

const extensionMime: Record<string, string> = {
  ".txt": "text/plain", ".json": "application/json", ".csv": "text/csv", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".gif": "image/gif", ".pdf": "application/pdf",
};

function mimeFor(filePath: string): string | undefined {
  return extensionMime[path.extname(filePath).toLowerCase()];
}

export class FileHandleStore {
  private readonly handles = new Map<string, StoredHandle>();

  constructor(private readonly cacheRoot: string) {}

  async cleanup(protectedPaths: string[] = [], maxAgeMs = 7 * 24 * 60 * 60 * 1000, maxBytes = 200 * 1024 * 1024): Promise<void> {
    const protectedSet = new Set(protectedPaths.map((value) => path.resolve(value)));
    const entries = await readdir(this.cacheRoot, { withFileTypes: true }).catch(() => []);
    const candidates: Array<{ path: string; size: number; mtimeMs: number }> = [];
    for (const entry of entries) {
      if (!entry.isFile()) continue;
      const filePath = path.join(this.cacheRoot, entry.name);
      const info = await stat(filePath).catch(() => undefined);
      if (info) candidates.push({ path: filePath, size: info.size, mtimeMs: info.mtimeMs });
    }
    const now = Date.now();
    for (const candidate of candidates) if (!protectedSet.has(path.resolve(candidate.path)) && now - candidate.mtimeMs > maxAgeMs) await rm(candidate.path, { force: true }).catch(() => undefined);
    const remaining = candidates.filter((candidate) => protectedSet.has(path.resolve(candidate.path)) || now - candidate.mtimeMs <= maxAgeMs).sort((a, b) => a.mtimeMs - b.mtimeMs);
    let total = remaining.reduce((sum, candidate) => sum + candidate.size, 0);
    for (const candidate of remaining) { if (total <= maxBytes || protectedSet.has(path.resolve(candidate.path))) continue; await rm(candidate.path, { force: true }).catch(() => undefined); total -= candidate.size; }
  }

  async clearCache(protectedPaths: string[] = []): Promise<void> {
    const protectedSet = new Set(protectedPaths.map((value) => path.resolve(value)));
    const entries = await readdir(this.cacheRoot, { withFileTypes: true }).catch(() => []);
    for (const entry of entries) { if (!entry.isFile()) continue; const filePath = path.join(this.cacheRoot, entry.name); if (!protectedSet.has(path.resolve(filePath))) await rm(filePath, { force: true }).catch(() => undefined); }
    for (const [handleId, handle] of this.handles) if (!protectedSet.has(path.resolve(handle.path))) this.handles.delete(handleId);
  }

  async registerText(value: string, origin: InputSource["origin"] = "clipboard"): Promise<InputSource> {
    return this.registerBytes(new TextEncoder().encode(value), "clipboard.txt", "text/plain", origin);
  }

  async registerBytes(value: Uint8Array, name: string, mimeType: string, origin: InputSource["origin"] = "clipboard"): Promise<InputSource> {
    if (value.byteLength > 25 * 1024 * 1024) throw new Error("Clipboard input is too large.");
    await mkdir(this.cacheRoot, { recursive: true });
    const handleId = randomUUID();
    const extension = path.extname(name) || ".bin";
    const filePath = path.join(this.cacheRoot, `${handleId}${extension}`);
    await writeFile(filePath, value);
    const item = { handleId, name, relativePath: name, size: value.byteLength, mimeType } satisfies InputItem;
    this.handles.set(handleId, { ...item, path: filePath });
    return { kind: "clipboard", items: [item], includeSubdirectories: false, origin, label: "클립보드" };
  }

  async registerFiles(paths: string[], origin: InputSource["origin"] = "dialog"): Promise<InputSource> {
    const items: InputItem[] = [];
    for (const candidate of paths) {
      const normalized = await normalizeExistingPath(candidate, "file");
      const info = await stat(normalized);
      const handleId = randomUUID();
      const item = { handleId, name: path.basename(normalized), relativePath: path.basename(normalized), size: info.size, mimeType: mimeFor(normalized) } satisfies InputItem;
      this.handles.set(handleId, { ...item, path: normalized });
      items.push(item);
    }
    return { kind: "files", items, includeSubdirectories: false, origin };
  }

  async registerFolder(folderPath: string, includeSubdirectories = true, origin: InputSource["origin"] = "dialog"): Promise<InputSource> {
    const root = await normalizeExistingPath(folderPath, "directory");
    const items: InputItem[] = [];
    const visit = async (directory: string) => {
      for (const entry of await readdir(directory, { withFileTypes: true })) {
        const next = path.join(directory, entry.name);
        if (entry.isSymbolicLink()) continue;
        if (entry.isDirectory() && includeSubdirectories) {
          await visit(next);
        } else if (entry.isFile()) {
          const info = await stat(next);
          const handleId = randomUUID();
          const relativePath = path.relative(root, next).split(path.sep).join("/");
          const item = { handleId, name: entry.name, relativePath, size: info.size, mimeType: mimeFor(next) } satisfies InputItem;
          this.handles.set(handleId, { ...item, path: next });
          items.push(item);
        }
      }
    };
    await visit(root);
    return { kind: "folder", items, includeSubdirectories, origin, label: root };
  }

  async registerDroppedPaths(paths: string[]): Promise<InputSource> {
    const files: string[] = [];
    const folders: string[] = [];
    for (const candidate of paths) {
      const normalized = path.resolve(candidate);
      const info = await stat(normalized).catch(() => undefined);
      if (!info) continue;
      if (info.isDirectory()) folders.push(normalized); else if (info.isFile()) files.push(normalized);
    }
    if (folders.length > 0) return this.registerFolder(folders[0]!, true, "drop");
    return this.registerFiles(files, "drop");
  }

  resolve(handleId: string): StoredHandle {
    const handle = this.handles.get(handleId);
    if (!handle) throw new Error("File handle has expired. Choose the files again.");
    return handle;
  }

  tryResolve(handleId: string): StoredHandle | undefined {
    return this.handles.get(handleId);
  }

  resolveMany(items: InputItem[]): StoredHandle[] {
    return items.map((item) => this.resolve(item.handleId));
  }

  pathsFor(items: InputItem[]): string[] {
    return this.resolveMany(items).map((handle) => handle.path);
  }
}
