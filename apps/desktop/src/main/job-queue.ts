import { randomUUID } from "node:crypto";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { Worker } from "node:worker_threads";
import os from "node:os";
import { readdir, rm } from "node:fs/promises";
import type { InputSource, Job, JobResult, OutputTarget } from "@suwol/shared";
import type { FileHandleStore } from "./file-handles";

type QueueListener = (job: Job) => void;
type WorkerInput = InputSource["items"][number] & { sourcePath: string };

export class JobQueue {
  private readonly jobs = new Map<string, Job>();
  private readonly results = new Map<string, JobResult>();
  private readonly listeners = new Set<QueueListener>();
  private readonly queue: string[] = [];
  private running: { jobId: string; worker: Worker } | undefined;
  private readonly persistencePath: string;

  constructor(private readonly handles: FileHandleStore, userDataPath: string) {
    this.persistencePath = path.join(userDataPath, "jobs.json");
  }

  async restore(): Promise<void> {
    try {
      const parsed = JSON.parse(await readFile(this.persistencePath, "utf8")) as { jobs?: Job[]; results?: JobResult[] };
      for (const job of parsed.jobs ?? []) {
        if (job.status === "running" || job.status === "queued") { job.status = "queued"; this.queue.push(job.id); }
        delete job.pauseRequested;
        this.jobs.set(job.id, job);
      }
      for (const result of parsed.results ?? []) this.results.set(result.jobId, result);
    } catch { /* first run */ }
  }

  onUpdate(listener: QueueListener): () => void { this.listeners.add(listener); return () => this.listeners.delete(listener); }
  list(): Job[] { return [...this.jobs.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt)); }
  getResult(jobId: string): JobResult | undefined { return this.results.get(jobId); }
  referencedInputPaths(): string[] { return this.list().filter((job) => job.status === "queued" || job.status === "running" || job.status === "paused").flatMap((job) => job.input.items.map((item) => item.sourcePath).filter((value): value is string => Boolean(value))); }
  resumeRestored(): void { void this.startNext(); }

  async enqueue(toolId: string, input: InputSource, output: OutputTarget, options: Record<string, unknown>): Promise<Job> {
    const now = new Date().toISOString();
    const persistedInput: InputSource = { ...input, items: input.items.map((item) => ({ ...item, sourcePath: this.handles.resolve(item.handleId).path })) };
    const job: Job = { id: randomUUID(), toolId, input: persistedInput, output, options, status: "queued", progress: 0, processedItems: 0, totalItems: input.items.length, createdAt: now, updatedAt: now };
    this.jobs.set(job.id, job);
    this.queue.push(job.id);
    await this.persist();
    this.emit(job);
    void this.startNext();
    return structuredClone(job);
  }

  async cancel(jobId: string): Promise<void> {
    const job = this.jobs.get(jobId);
    if (!job) return;
    if (this.running?.jobId === jobId) {
      const worker = this.running.worker;
      this.running = undefined;
      await worker.terminate();
      await this.cleanupMediaTemp();
    }
    delete job.pauseRequested;
    job.status = "cancelled";
    job.updatedAt = new Date().toISOString();
    this.emit(job);
    await this.persist();
    void this.startNext();
  }

  async cancelAll(): Promise<void> {
    if (this.running) {
      const worker = this.running.worker;
      this.running = undefined;
      await worker.terminate();
      await this.cleanupMediaTemp();
    }
    this.queue.length = 0;
    const now = new Date().toISOString();
    for (const job of this.jobs.values()) {
      if (job.status === "queued" || job.status === "running" || job.status === "paused") {
        job.status = "cancelled";
        delete job.pauseRequested;
        job.updatedAt = now;
        this.emit(job);
      }
    }
    await this.persist();
  }

  async shutdown(): Promise<void> {
    if (this.running) {
      const current = this.jobs.get(this.running.jobId);
      if (current) {
        current.status = "queued";
        delete current.pauseRequested;
        current.updatedAt = new Date().toISOString();
        if (!this.queue.includes(current.id)) this.queue.unshift(current.id);
      }
      const worker = this.running.worker;
      this.running = undefined;
      await worker.terminate();
      await this.cleanupMediaTemp();
    }
    await this.persist();
  }

  async pause(jobId: string): Promise<void> {
    const job = this.jobs.get(jobId);
    if (!job) return;
    if (this.running?.jobId === jobId && job.status === "running") {
      if (job.pauseRequested) return;
      job.pauseRequested = true;
      job.updatedAt = new Date().toISOString();
      this.running.worker.postMessage({ type: "pause" });
      this.emit(job); await this.persist(); return;
    }
    if (job.status !== "queued") return;
    const index = this.queue.indexOf(jobId);
    if (index >= 0) this.queue.splice(index, 1);
    job.status = "paused";
    delete job.pauseRequested;
    job.updatedAt = new Date().toISOString();
    this.emit(job);
    await this.persist();
  }

  async resume(jobId: string): Promise<void> {
    const job = this.jobs.get(jobId);
    if (!job || job.status !== "paused") return;
    if (this.running?.jobId === jobId) { job.status = "running"; delete job.pauseRequested; job.updatedAt = new Date().toISOString(); this.running.worker.postMessage({ type: "resume" }); this.emit(job); await this.persist(); return; }
    job.status = "queued";
    delete job.pauseRequested;
    job.updatedAt = new Date().toISOString();
    this.queue.push(jobId);
    this.emit(job);
    await this.persist();
    void this.startNext();
  }

  async retry(jobId: string): Promise<Job | undefined> {
    const job = this.jobs.get(jobId);
    if (!job) return undefined;
    job.status = "queued"; job.progress = 0; job.processedItems = 0; delete job.pauseRequested; delete job.error; job.updatedAt = new Date().toISOString();
    this.queue.push(job.id);
    await this.persist(); this.emit(job); void this.startNext();
    return structuredClone(job);
  }

  async clearCompleted(): Promise<void> {
    for (const [jobId, job] of this.jobs) if (job.status === "completed" || job.status === "cancelled") { this.jobs.delete(jobId); this.results.delete(jobId); }
    await this.persist();
  }

  private emit(job: Job): void { for (const listener of this.listeners) listener(structuredClone(job)); }

  private async startNext(): Promise<void> {
    if (this.running) return;
    const jobId = this.queue.shift();
    if (!jobId) return;
    const job = this.jobs.get(jobId);
    if (!job || job.status === "cancelled") return void this.startNext();
    let inputs: WorkerInput[];
    try {
      inputs = job.input.items.map((item) => { const handle = this.handles.tryResolve(item.handleId); const sourcePath = handle?.path ?? item.sourcePath; if (!sourcePath) throw new Error(`Input file is unavailable after restart: ${item.name}`); return { handleId: item.handleId, name: item.name, relativePath: item.relativePath, size: item.size, ...(item.mimeType ? { mimeType: item.mimeType } : {}), sourcePath, ...(job.input.kind === "folder" && job.input.label ? { sourceRoot: job.input.label } : {}) }; });
    } catch (error) {
      job.status = "failed"; job.error = error instanceof Error ? error.message : "Input file is unavailable"; job.updatedAt = new Date().toISOString(); this.emit(job); await this.persist(); void this.startNext(); return;
    }
    job.status = "running"; job.updatedAt = new Date().toISOString(); this.emit(job); await this.persist();
    const worker = new Worker(new URL("./job-worker.js", import.meta.url));
    this.running = { jobId, worker };
    worker.on("message", (message: { type: string; jobId: string; processedItems?: number; totalItems?: number; bytesProcessed?: number; fraction?: number; result?: JobResult; error?: string }) => {
      if (message.type === "paused") {
        if (job.status === "running" && job.pauseRequested) { job.status = "paused"; delete job.pauseRequested; job.updatedAt = new Date().toISOString(); this.emit(job); void this.persist(); }
        return;
      }
      if (message.type === "resumed") {
        if (job.status === "paused") { job.status = "running"; job.updatedAt = new Date().toISOString(); this.emit(job); void this.persist(); }
        return;
      }
      if (message.type === "progress") {
        if (typeof message.fraction === "number") job.progress = Math.max(0, Math.min(99, Math.round(message.fraction * 100)));
        else { job.processedItems = message.processedItems ?? job.processedItems; job.totalItems = message.totalItems ?? job.totalItems; job.progress = job.totalItems ? Math.round((job.processedItems / job.totalItems) * 100) : 100; }
        job.updatedAt = new Date().toISOString(); this.emit(job); return;
      }
      if (message.type === "complete" && message.result) { job.status = message.result.status; job.progress = 100; job.processedItems = job.totalItems; this.results.set(job.id, message.result); }
      if (message.type === "error") { job.status = "failed"; job.error = message.error ?? "Worker failed"; }
      job.updatedAt = new Date().toISOString(); this.emit(job); void this.finishWorker(worker);
    });
    worker.on("error", (error) => { job.status = "failed"; job.error = error.message; job.updatedAt = new Date().toISOString(); this.emit(job); void this.finishWorker(worker); });
    worker.postMessage({ job, inputs });
  }

  private async finishWorker(worker: Worker): Promise<void> {
    if (this.running?.worker === worker) {
      await worker.terminate();
      this.running = undefined;
    }
    await this.persist();
    void this.startNext();
  }

  private async persist(): Promise<void> {
    await mkdir(path.dirname(this.persistencePath), { recursive: true });
    await writeFile(this.persistencePath, JSON.stringify({ jobs: this.list(), results: [...this.results.values()] }, null, 2), "utf8");
  }

  private async cleanupMediaTemp(): Promise<void> {
    for (const entry of await readdir(os.tmpdir(), { withFileTypes: true }).catch(() => [])) if (entry.isDirectory() && entry.name.startsWith("suwol-media-")) await rm(path.join(os.tmpdir(), entry.name), { recursive: true, force: true }).catch(() => undefined);
  }
}
