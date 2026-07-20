import { contextBridge, ipcRenderer } from "electron";
import type { AppSettings, InputSource, Job, OutputTarget, UpdateState } from "@suwol/shared";

const api = {
  app: {
    getBootstrap: (): Promise<{ settings: AppSettings; jobs: Job[]; platform: { platform: string; separator: string; supportsDriveLetters: boolean }; update: UpdateState }> => ipcRenderer.invoke("app:getBootstrap"),
  },
  settings: {
    update: (patch: Partial<AppSettings>): Promise<AppSettings> => ipcRenderer.invoke("settings:update", patch),
  },
  files: {
    pick: (): Promise<InputSource | undefined> => ipcRenderer.invoke("files:pick"),
    pickFolder: (includeSubdirectories = true): Promise<InputSource | undefined> => ipcRenderer.invoke("files:pickFolder", includeSubdirectories),
    adoptDroppedPaths: (paths: string[]): Promise<InputSource> => ipcRenderer.invoke("files:adoptDroppedPaths", paths),
    pickOutputFolder: (): Promise<string | undefined> => ipcRenderer.invoke("files:pickOutputFolder"),
    preview: (value: { handleId: string; maxBytes?: number }): Promise<{ name: string; mimeType?: string; size: number; data: Uint8Array }> => ipcRenderer.invoke("files:preview", value),
    saveText: (value: { value: string; defaultName?: string }): Promise<string | undefined> => ipcRenderer.invoke("files:saveText", value),
  },
  clipboard: {
    createTextSource: (value: string): Promise<InputSource> => ipcRenderer.invoke("clipboard:createTextSource", value),
    createImageSource: (): Promise<InputSource> => ipcRenderer.invoke("clipboard:createImageSource"),
    readText: (): Promise<string> => ipcRenderer.invoke("clipboard:readText"),
    writeText: (value: string): Promise<boolean> => ipcRenderer.invoke("clipboard:writeText", value),
  },
  cache: { clear: (): Promise<boolean> => ipcRenderer.invoke("cache:clear") },
  pdf: { inspect: (value: { handleId: string; scale?: number; renderThumbnails?: boolean }): Promise<unknown> => ipcRenderer.invoke("pdf:inspect", value) },
  media: { inspectGif: (value: { handleId: string }): Promise<unknown> => ipcRenderer.invoke("media:inspectGif", value), status: (): Promise<{ available: boolean; source: "bundled" | "development" | "missing" }> => ipcRenderer.invoke("media:status") },
  updates: {
    status: (): Promise<UpdateState> => ipcRenderer.invoke("updates:status"),
    check: (): Promise<UpdateState> => ipcRenderer.invoke("updates:check"),
    download: (): Promise<UpdateState> => ipcRenderer.invoke("updates:download"),
    cancel: (): Promise<boolean> => ipcRenderer.invoke("updates:cancel"),
    install: (): Promise<UpdateState> => ipcRenderer.invoke("updates:install"),
    onState: (listener: (state: UpdateState) => void): (() => void) => { const handler = (_event: Electron.IpcRendererEvent, state: UpdateState) => listener(state); ipcRenderer.on("updates:state", handler); return () => ipcRenderer.removeListener("updates:state", handler); },
  },
  network: {
    request: (value: { url: string; mode: "headers" | "redirect" | "open-graph" | "dns" | "tls" | "port" | "url-parse"; requestId?: string; recordType?: string; port?: number }): Promise<unknown> => ipcRenderer.invoke("network:request", value),
    local: (value: { mode: "ip" | "ports" | "trace" | "certificate"; value: string; prefix?: string; protocol?: "all" | "TCP" | "UDP" }): Promise<unknown> => ipcRenderer.invoke("network:local", value),
    cancel: (requestId: string): Promise<boolean> => ipcRenderer.invoke("network:cancel", requestId),
  },
  jobs: {
    enqueue: (request: { toolId: string; input: InputSource; output: OutputTarget; options: Record<string, unknown> }): Promise<Job> => ipcRenderer.invoke("jobs:enqueue", request),
    cancel: (jobId: string): Promise<void> => ipcRenderer.invoke("jobs:cancel", jobId),
    cancelAll: (): Promise<void> => ipcRenderer.invoke("jobs:cancelAll"),
    pause: (jobId: string): Promise<void> => ipcRenderer.invoke("jobs:pause", jobId),
    resume: (jobId: string): Promise<void> => ipcRenderer.invoke("jobs:resume", jobId),
    retry: (jobId: string): Promise<Job | undefined> => ipcRenderer.invoke("jobs:retry", jobId),
    clearCompleted: (): Promise<void> => ipcRenderer.invoke("jobs:clearCompleted"),
    openOutput: (jobId: string): Promise<boolean> => ipcRenderer.invoke("jobs:openOutput", jobId),
    openFile: (jobId: string): Promise<boolean> => ipcRenderer.invoke("jobs:openFile", jobId),
    copyResult: (jobId: string): Promise<boolean> => ipcRenderer.invoke("jobs:copyResult", jobId),
    onUpdate: (listener: (job: Job) => void): (() => void) => { const handler = (_event: Electron.IpcRendererEvent, job: Job) => listener(job); ipcRenderer.on("jobs:update", handler); return () => ipcRenderer.removeListener("jobs:update", handler); },
  },
};

contextBridge.exposeInMainWorld("suwol", api);
