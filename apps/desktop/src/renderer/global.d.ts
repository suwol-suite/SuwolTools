import type { AppSettings, InputSource, Job, OutputTarget, UpdateState } from "@suwol/shared";

declare global {
  interface Window {
    suwol?: {
      app: { getBootstrap: () => Promise<{ settings: AppSettings; jobs: Job[]; platform: { platform: string; separator: string; supportsDriveLetters: boolean }; update: UpdateState }> };
      settings: { update: (patch: Partial<AppSettings>) => Promise<AppSettings> };
      files: { pick: () => Promise<InputSource | undefined>; pickFolder: (includeSubdirectories?: boolean) => Promise<InputSource | undefined>; adoptDroppedPaths: (paths: string[]) => Promise<InputSource>; pickOutputFolder: () => Promise<string | undefined>; preview: (value: { handleId: string; maxBytes?: number }) => Promise<{ name: string; mimeType?: string; size: number; data: Uint8Array }>; saveText: (value: { value: string; defaultName?: string }) => Promise<string | undefined> };
      clipboard: { createTextSource: (value: string) => Promise<InputSource>; createImageSource: () => Promise<InputSource>; readText: () => Promise<string>; writeText: (value: string) => Promise<boolean> };
      cache: { clear: () => Promise<boolean> };
      pdf: { inspect: (value: { handleId: string; scale?: number; renderThumbnails?: boolean }) => Promise<unknown> };
      media: { inspectGif: (value: { handleId: string }) => Promise<unknown>; status: () => Promise<{ available: boolean; source: "bundled" | "development" | "missing" }> };
      updates: { status: () => Promise<UpdateState>; check: () => Promise<UpdateState>; download: () => Promise<UpdateState>; cancel: () => Promise<boolean>; install: () => Promise<UpdateState>; onState: (listener: (state: UpdateState) => void) => () => void };
      network: { request: (value: { url: string; mode: "headers" | "redirect" | "open-graph" | "dns" | "tls" | "port" | "url-parse"; requestId?: string; recordType?: string; port?: number }) => Promise<unknown>; local: (value: { mode: "ip" | "ports" | "trace" | "certificate"; value: string; prefix?: string; protocol?: "all" | "TCP" | "UDP" }) => Promise<unknown>; cancel: (requestId: string) => Promise<boolean> };
      jobs: { enqueue: (request: { toolId: string; input: InputSource; output: OutputTarget; options: Record<string, unknown> }) => Promise<Job>; cancel: (jobId: string) => Promise<void>; cancelAll: () => Promise<void>; pause: (jobId: string) => Promise<void>; resume: (jobId: string) => Promise<void>; retry: (jobId: string) => Promise<Job | undefined>; clearCompleted: () => Promise<void>; openOutput: (jobId: string) => Promise<boolean>; openFile: (jobId: string) => Promise<boolean>; copyResult: (jobId: string) => Promise<boolean>; onUpdate: (listener: (job: Job) => void) => () => void };
    };
  }
}

export {};
