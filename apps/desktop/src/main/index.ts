import { app, BrowserWindow, clipboard, dialog, ipcMain, nativeImage, shell } from "electron";
import path from "node:path";
import os from "node:os";
import { readFile, readdir, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { Worker as ThreadWorker } from "node:worker_threads";
import { fileURLToPath } from "node:url";
import { isInputSource, isOutputTarget, isSafeToolId, type AppSettings, type InputSource, type OutputTarget } from "@suwol/shared";
import { getToolById } from "@suwol/shared";
import { FileHandleStore } from "./file-handles";
import { JobQueue } from "./job-queue";
import { normalizeOutputDirectory } from "./path-policy";
import { SettingsStore } from "./settings-store";
import { platformPathInfo } from "./platform-path";
import { cancelNetworkRequest, localNetworkDiagnostic, restrictedNetworkRequest } from "./network-policy";
import { UpdateService } from "./update-service";
import ffmpegStatic from "ffmpeg-static";

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const isDevelopment = !app.isPackaged;
process.env.SUWOL_APP_PACKAGED = app.isPackaged ? "1" : "0";
let mainWindow: BrowserWindow | undefined;
let handles: FileHandleStore;
let jobs: JobQueue;
let settings: SettingsStore;
let updateService: UpdateService;
let isQuitting = false;
const approvedOutputDirectories = new Set<string>();

function ffmpegStatus(): { available: boolean; source: "bundled" | "development" | "missing" } {
  const platformDirectory = process.platform === "win32" ? "win-x64" : process.platform === "darwin" ? (process.arch === "arm64" ? "mac-arm64" : "mac-x64") : "linux-x64";
  const filename = process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg";
  if (app.isPackaged && existsSync(path.join(process.resourcesPath, "ffmpeg", platformDirectory, filename))) return { available: true, source: "bundled" };
  if (!app.isPackaged && ((typeof process.env.SUWOL_FFMPEG_PATH === "string" && existsSync(process.env.SUWOL_FFMPEG_PATH)) || (ffmpegStatic && existsSync(ffmpegStatic)))) return { available: true, source: "development" };
  return { available: false, source: "missing" };
}

async function inspectPdf(handleId: string, scale: number, renderThumbnails: boolean): Promise<unknown> {
  const handle = handles.resolve(handleId);
  if (!/\.pdf$/i.test(handle.name)) throw new Error("PDF input is required.");
  const bytes = await readFile(handle.path);
  if (bytes.byteLength > 100 * 1024 * 1024) throw new Error("PDF preview is limited to 100 MB.");
  return new Promise((resolve, reject) => {
    const worker = new ThreadWorker(new URL("./pdf-render-worker.js", import.meta.url));
    const timer = setTimeout(() => { void worker.terminate(); reject(new Error("PDF preview timed out.")); }, 30_000);
    const finish = (callback: () => void) => { clearTimeout(timer); void worker.terminate(); callback(); };
    worker.once("message", (message: { type?: string; pages?: unknown; error?: string }) => {
      if (message.type === "complete") finish(() => resolve(message.pages ?? []));
      else if (message.type === "error") finish(() => reject(new Error(message.error ?? "PDF preview failed.")));
    });
    worker.once("error", (error) => finish(() => reject(error)));
    worker.postMessage({ type: "inspect", data: new Uint8Array(bytes), scale, renderThumbnails, maxPages: 200 });
  });
}

async function inspectGif(handleId: string): Promise<unknown> {
  const handle = handles.resolve(handleId);
  if (!/\.gif$/i.test(handle.name)) throw new Error("GIF input is required.");
  const bytes = await readFile(handle.path);
  if (bytes.byteLength > 100 * 1024 * 1024) throw new Error("GIF preview is limited to 100 MB.");
  return new Promise((resolve, reject) => {
    const worker = new ThreadWorker(new URL("./gif-inspect-worker.js", import.meta.url));
    const timer = setTimeout(() => { void worker.terminate(); reject(new Error("GIF preview timed out.")); }, 30_000);
    const finish = (callback: () => void) => { clearTimeout(timer); void worker.terminate(); callback(); };
    worker.once("message", (message: { type?: string; error?: string } & Record<string, unknown>) => message.type === "complete" ? finish(() => resolve(message)) : finish(() => reject(new Error(message.error ?? "GIF preview failed."))));
    worker.once("error", (error) => finish(() => reject(error)));
    worker.postMessage({ data: new Uint8Array(bytes), maxFrames: 300 });
  });
}

async function cleanupMediaTemp(): Promise<void> {
  const root = os.tmpdir();
  for (const entry of await readdir(root, { withFileTypes: true }).catch(() => [])) if (entry.isDirectory() && entry.name.startsWith("suwol-media-")) await rm(path.join(root, entry.name), { recursive: true, force: true }).catch(() => undefined);
}

function assertOptions(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid tool options.");
  const record = value as Record<string, unknown>;
  if (Object.keys(record).length > 100) throw new Error("Too many tool options.");
  for (const key of Object.keys(record)) if (!/^[a-zA-Z0-9_-]{1,80}$/.test(key)) throw new Error("Invalid option key.");
  return record;
}

function assertInput(value: unknown): InputSource {
  if (!isInputSource(value)) throw new Error("Invalid input source.");
  if (value.items.length > 10000) throw new Error("Too many input files.");
  for (const item of value.items) {
    if (!/^[0-9a-f-]{36}$/.test(item.handleId) || item.name.length > 512 || item.relativePath.length > 4096) throw new Error("Invalid input handle.");
  }
  return value;
}

async function assertOutput(value: unknown): Promise<OutputTarget> {
  if (!isOutputTarget(value)) throw new Error("Invalid output target.");
  let output: OutputTarget = value;
  if (output.kind === "directory") {
    if (!output.directory) throw new Error("Output directory is required.");
    const normalizedDirectory = await normalizeOutputDirectory(output.directory);
    if (!approvedOutputDirectories.has(normalizedDirectory)) throw new Error("Choose the output directory using the file dialog first.");
    output = { ...output, directory: normalizedDirectory };
  }
  if (output.prefix.length > 100 || output.suffix.length > 100 || output.numberingStart < 0 || output.numberingStart > 999999) throw new Error("Invalid output naming rules.");
  return output;
}

function send(channel: string, payload: unknown): void {
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send(channel, payload);
}

async function rememberSource(source: InputSource): Promise<InputSource> {
  const paths = handles.pathsFor(source.items);
  const current = settings.get();
  const recentFiles = [...paths, ...current.recentFiles.filter((candidate) => !paths.includes(candidate))].slice(0, 40);
  const recentFolders = source.kind === "folder" && source.label ? [source.label, ...current.recentFolders.filter((candidate) => candidate !== source.label)].slice(0, 20) : current.recentFolders;
  const lastInputDirectory = paths[0] ? path.dirname(paths[0]) : source.label;
  await settings.update({ recentFiles, recentFolders, lastInputDirectory });
  return source;
}

async function createWindow(): Promise<void> {
  const configured = settings.get().windowBounds;
  mainWindow = new BrowserWindow({
    width: configured?.width ?? 1280,
    height: configured?.height ?? 820,
    x: configured?.x,
    y: configured?.y,
    minWidth: 980,
    minHeight: 640,
    webPreferences: {
      preload: path.join(currentDirectory, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      devTools: isDevelopment,
    },
  });
  mainWindow.webContents.setWindowOpenHandler(({ url }) => { void shell.openExternal(url); return { action: "deny" }; });
  mainWindow.webContents.on("will-navigate", (event, url) => { const allowedFile = url.startsWith("file://"); const allowedDevelopmentUrl = isDevelopment && url.startsWith("http://localhost:"); if (!allowedFile && !allowedDevelopmentUrl) event.preventDefault(); });
  mainWindow.on("close", () => { const bounds = mainWindow?.getBounds(); if (bounds) void settings.update({ windowBounds: bounds }); });
  if (isDevelopment && process.env.ELECTRON_RENDERER_URL) await mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
  else await mainWindow.loadFile(path.join(currentDirectory, "../dist-renderer/index.html"));
}

function registerIpc(): void {
  ipcMain.handle("app:getBootstrap", () => ({ settings: settings.get(), jobs: jobs.list(), platform: platformPathInfo(), update: updateService.getState() }));
  ipcMain.handle("settings:update", async (_event, patch: unknown) => {
    if (!patch || typeof patch !== "object" || Array.isArray(patch)) throw new Error("Invalid settings patch.");
    const safe = patch as Partial<AppSettings>;
    if (safe.defaultOutputDirectory) safe.defaultOutputDirectory = await normalizeOutputDirectory(safe.defaultOutputDirectory);
    return settings.update(safe);
  });
  ipcMain.handle("files:pick", async () => {
    const lastInput = settings.get().lastInputDirectory;
    const result = await dialog.showOpenDialog(mainWindow!, { properties: ["openFile", "multiSelections"], ...(lastInput ? { defaultPath: lastInput } : {}) });
    return result.canceled ? undefined : rememberSource(await handles.registerFiles(result.filePaths));
  });
  ipcMain.handle("files:pickFolder", async (_event, includeSubdirectories: unknown) => {
    const lastInput = settings.get().lastInputDirectory;
    const result = await dialog.showOpenDialog(mainWindow!, { properties: ["openDirectory"], ...(lastInput ? { defaultPath: lastInput } : {}) });
    return result.canceled ? undefined : rememberSource(await handles.registerFolder(result.filePaths[0]!, includeSubdirectories !== false));
  });
  ipcMain.handle("files:adoptDroppedPaths", async (_event, paths: unknown) => {
    if (!Array.isArray(paths) || paths.length > 100) throw new Error("Invalid dropped paths.");
    return rememberSource(await handles.registerDroppedPaths(paths.filter((value): value is string => typeof value === "string")));
  });
  ipcMain.handle("files:preview", async (_event, value: unknown) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid preview request.");
    const request = value as { handleId?: unknown; maxBytes?: unknown };
    if (typeof request.handleId !== "string" || !/^[0-9a-f-]{36}$/.test(request.handleId)) throw new Error("Invalid preview handle.");
    const handle = handles.resolve(request.handleId);
    const maxBytes = typeof request.maxBytes === "number" && Number.isInteger(request.maxBytes)
      ? Math.max(64 * 1024, Math.min(32 * 1024 * 1024, request.maxBytes))
      : 16 * 1024 * 1024;
    if ((handle.size ?? 0) > maxBytes) throw new Error("Preview is limited to 32 MB. The original file is still processed in the Worker.");
    return { name: handle.name, mimeType: handle.mimeType, size: handle.size ?? 0, data: new Uint8Array(await readFile(handle.path)) };
  });
  ipcMain.handle("files:saveText", async (_event, value: unknown) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid text save request.");
    const request = value as { value?: unknown; defaultName?: unknown };
    if (typeof request.value !== "string" || request.value.length > 20 * 1024 * 1024) throw new Error("Invalid text result.");
    const textValue = request.value;
    const defaultName = typeof request.defaultName === "string" && /^[^\\/:*?"<>|]{1,180}$/.test(request.defaultName) ? request.defaultName : "network-result.json";
    const result = await dialog.showSaveDialog(mainWindow!, { defaultPath: defaultName, filters: [{ name: "JSON", extensions: ["json"] }, { name: "Text", extensions: ["txt"] }] });
    if (result.canceled || !result.filePath) return undefined;
    await import("node:fs/promises").then(({ writeFile }) => writeFile(result.filePath!, textValue, "utf8"));
    return result.filePath;
  });
  ipcMain.handle("clipboard:createTextSource", async (_event, value: unknown) => {
    if (typeof value !== "string") throw new Error("Invalid clipboard text.");
    return rememberSource(await handles.registerText(value));
  });
  ipcMain.handle("clipboard:createImageSource", async () => {
    const image = clipboard.readImage();
    if (image.isEmpty()) throw new Error("Clipboard does not contain an image.");
    return rememberSource(await handles.registerBytes(new Uint8Array(image.toPNG()), "clipboard.png", "image/png"));
  });
  ipcMain.handle("clipboard:readText", () => clipboard.readText());
  ipcMain.handle("clipboard:writeText", (_event, value: unknown) => {
    if (typeof value !== "string" || value.length > 10 * 1024 * 1024) throw new Error("Invalid clipboard text.");
    clipboard.writeText(value);
    return true;
  });
  ipcMain.handle("cache:clear", async () => { await handles.clearCache(jobs.referencedInputPaths()); return true; });
  ipcMain.handle("pdf:inspect", async (_event, value: unknown) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid PDF preview request.");
    const request = value as { handleId?: unknown; scale?: unknown; renderThumbnails?: unknown };
    if (typeof request.handleId !== "string" || !/^[0-9a-f-]{36}$/.test(request.handleId)) throw new Error("Invalid PDF handle.");
    const scale = typeof request.scale === "number" && Number.isFinite(request.scale) ? Math.max(0.08, Math.min(1, request.scale)) : 0.18;
    return inspectPdf(request.handleId, scale, request.renderThumbnails === true);
  });
  ipcMain.handle("media:inspectGif", async (_event, value: unknown) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid GIF preview request.");
    const handleId = (value as { handleId?: unknown }).handleId;
    if (typeof handleId !== "string" || !/^[0-9a-f-]{36}$/.test(handleId)) throw new Error("Invalid GIF handle.");
    return inspectGif(handleId);
  });
  ipcMain.handle("media:status", () => ffmpegStatus());
  ipcMain.handle("updates:status", () => updateService.getState());
  ipcMain.handle("updates:check", () => updateService.checkForUpdates());
  ipcMain.handle("updates:download", () => updateService.downloadUpdate());
  ipcMain.handle("updates:cancel", () => updateService.cancelDownload());
  ipcMain.handle("updates:install", () => updateService.installUpdate());
  ipcMain.handle("network:request", async (_event, value: unknown) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid network request.");
    const request = value as { url?: unknown; mode?: unknown; requestId?: unknown; recordType?: unknown; port?: unknown };
    if (typeof request.url !== "string" || request.url.length > 2048) throw new Error("Invalid network URL.");
    const allowedModes = ["headers", "redirect", "open-graph", "dns", "tls", "port", "url-parse"] as const;
    const mode = allowedModes.includes(request.mode as (typeof allowedModes)[number]) ? request.mode as (typeof allowedModes)[number] : "headers";
    if (request.requestId !== undefined && (typeof request.requestId !== "string" || request.requestId.length > 100)) throw new Error("Invalid network request ID.");
    const recordType = typeof request.recordType === "string" && ["A", "AAAA", "CNAME", "MX", "TXT", "NS", "SOA", "CAA"].includes(request.recordType) ? request.recordType : "A";
    const port = typeof request.port === "number" && Number.isInteger(request.port) ? request.port : 443;
    return restrictedNetworkRequest(request.url, mode, { requestId: typeof request.requestId === "string" ? request.requestId : undefined, recordType, port });
  });
  ipcMain.handle("network:cancel", (_event, requestId: unknown) => { if (typeof requestId !== "string" || requestId.length > 100) throw new Error("Invalid network request ID."); return cancelNetworkRequest(requestId); });
  ipcMain.handle("network:local", async (_event, value: unknown) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid local network request.");
    const request = value as { mode?: unknown; value?: unknown; prefix?: unknown; protocol?: unknown };
    const modes = ["ip", "ports", "trace", "certificate"] as const;
    if (!modes.includes(request.mode as (typeof modes)[number]) || typeof request.value !== "string") throw new Error("Invalid local network diagnostic.");
    const protocol = request.protocol === "TCP" || request.protocol === "UDP" ? request.protocol : "all";
    return localNetworkDiagnostic(request.mode as (typeof modes)[number], request.value, { prefix: typeof request.prefix === "string" ? request.prefix : undefined, protocol });
  });
  ipcMain.handle("files:pickOutputFolder", async () => {
    const result = await dialog.showOpenDialog(mainWindow!, { properties: ["openDirectory", "createDirectory"] });
    if (result.canceled) return undefined;
    const directory = await normalizeOutputDirectory(result.filePaths[0]!);
    approvedOutputDirectories.add(directory);
    await settings.update({ defaultOutputDirectory: directory });
    return directory;
  });
  ipcMain.handle("jobs:enqueue", async (_event, request: unknown) => {
    if (!request || typeof request !== "object") throw new Error("Invalid job request.");
    const candidate = request as { toolId?: unknown; input?: unknown; output?: unknown; options?: unknown };
    if (!isSafeToolId(candidate.toolId) || !getToolById(candidate.toolId)?.migrated) throw new Error("This tool is not available in the Electron executor yet.");
    return jobs.enqueue(candidate.toolId, assertInput(candidate.input), await assertOutput(candidate.output), assertOptions(candidate.options ?? {}));
  });
  ipcMain.handle("jobs:cancel", (_event, jobId: unknown) => { if (typeof jobId !== "string") throw new Error("Invalid job ID."); return jobs.cancel(jobId); });
  ipcMain.handle("jobs:cancelAll", () => jobs.cancelAll());
  ipcMain.handle("jobs:pause", (_event, jobId: unknown) => { if (typeof jobId !== "string") throw new Error("Invalid job ID."); return jobs.pause(jobId); });
  ipcMain.handle("jobs:resume", (_event, jobId: unknown) => { if (typeof jobId !== "string") throw new Error("Invalid job ID."); return jobs.resume(jobId); });
  ipcMain.handle("jobs:retry", (_event, jobId: unknown) => { if (typeof jobId !== "string") throw new Error("Invalid job ID."); return jobs.retry(jobId); });
  ipcMain.handle("jobs:clearCompleted", () => jobs.clearCompleted());
  ipcMain.handle("jobs:openOutput", async (_event, jobId: unknown) => {
    if (typeof jobId !== "string") throw new Error("Invalid job ID.");
    const result = jobs.getResult(jobId);
    const first = result?.outputs.find((output) => output.path);
    if (!first?.path) return false;
    await shell.openPath(path.dirname(first.path));
    return true;
  });
  ipcMain.handle("jobs:openFile", async (_event, jobId: unknown) => {
    if (typeof jobId !== "string") throw new Error("Invalid job ID.");
    const result = jobs.getResult(jobId);
    const first = result?.outputs.find((output) => output.path);
    if (!first?.path) return false;
    await shell.openPath(first.path);
    return true;
  });
  ipcMain.handle("jobs:copyResult", async (_event, jobId: unknown) => {
    if (typeof jobId !== "string") throw new Error("Invalid job ID.");
    const result = jobs.getResult(jobId);
    const first = result?.outputs.find((output) => output.path);
    if (!first?.path) return false;
    if (first.mimeType.startsWith("text/") || first.mimeType === "application/json") clipboard.writeText(await import("node:fs/promises").then(({ readFile }) => readFile(first.path!, "utf8")));
    else clipboard.writeImage(nativeImage.createFromPath(first.path));
    return true;
  });
  jobs.onUpdate((job) => send("jobs:update", job));
}

app.whenReady().then(async () => {
  await cleanupMediaTemp();
  settings = new SettingsStore(app.getPath("userData"));
  const loadedSettings = await settings.load();
  if (loadedSettings.defaultOutputDirectory) {
    const directory = await normalizeOutputDirectory(loadedSettings.defaultOutputDirectory).catch(() => undefined);
    if (directory) approvedOutputDirectories.add(directory);
  }
  handles = new FileHandleStore(path.join(app.getPath("userData"), "input-cache"));
  jobs = new JobQueue(handles, app.getPath("userData"));
  await jobs.restore();
  await handles.cleanup(jobs.referencedInputPaths());
  updateService = new UpdateService({ isPackaged: app.isPackaged, platform: process.platform, appImagePath: process.env.APPIMAGE, version: app.getVersion() });
  updateService.subscribe((state) => send("updates:state", state));
  registerIpc();
  await createWindow();
  jobs.resumeRestored();
  void updateService.checkOnStartup(loadedSettings.autoUpdate);
  app.on("activate", () => { if (BrowserWindow.getAllWindows().length === 0) void createWindow(); });
});

app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });
app.on("before-quit", (event) => {
  if (isQuitting || !jobs) return;
  event.preventDefault();
  isQuitting = true;
  void jobs.shutdown().then(() => handles.cleanup(jobs.referencedInputPaths(), 0)).then(cleanupMediaTemp).finally(() => app.quit());
});
