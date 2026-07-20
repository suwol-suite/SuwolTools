import { assertRegisteredTool, type JobResult, type OutputTarget } from "@suwol/shared";
import { buildOutputRelativePath } from "./output-naming";
import { getProcessor } from "./processors";
import type { ExecutionCallbacks, FileIoAdapter, JobExecutionRequest, PlatformOutput } from "./types";

function now(): string {
  return new Date().toISOString();
}

export async function executeJob(request: JobExecutionRequest, io: FileIoAdapter, callbacks: ExecutionCallbacks = {}): Promise<JobResult> {
  const tool = assertRegisteredTool(request.job.toolId);
  if (!tool.migrated) throw new Error(`Tool ${tool.id} is registered but has not been migrated to the shared executor.`);
  const processor = getProcessor(tool.id);
  const outputs: PlatformOutput[] = [];
  let bytesProcessed = 0;

  if (processor.batch) {
    const input = request.inputs[0];
    if (!input) return { jobId: request.job.id, status: "completed", outputs: [], completedAt: now() };
    if (callbacks.isCancelled?.()) return { jobId: request.job.id, status: "cancelled", outputs: [], completedAt: now() };
    await callbacks.waitIfPaused?.();
    const processed = await processor(input, request.job.options, { imageCodec: callbacks.imageCodec, iconCodec: callbacks.iconCodec, mediaCodec: callbacks.mediaCodec, pdfCodec: callbacks.pdfCodec, isCancelled: callbacks.isCancelled ?? (() => false), waitIfPaused: callbacks.waitIfPaused, inputs: request.inputs });
    for (const output of processed) {
      const relativeOutputPath = buildOutputRelativePath(input.relativePath || input.name, output.name, request.job.output, 0);
      outputs.push(await io.writeOutput({ input, output, target: request.job.output, relativeOutputPath }));
    }
    callbacks.onProgress?.({ processedItems: request.inputs.length, totalItems: request.inputs.length, bytesProcessed: request.inputs.reduce((sum, item) => sum + (item.size ?? 0), 0) });
    return { jobId: request.job.id, status: "completed", outputs, completedAt: now() };
  }

  for (let index = 0; index < request.inputs.length; index += 1) {
    await callbacks.waitIfPaused?.();
    if (callbacks.isCancelled?.()) {
      return { jobId: request.job.id, status: "cancelled", outputs, completedAt: now() };
    }
    const input = request.inputs[index];
    if (!input) continue;
    const processed = await processor(input, request.job.options, { imageCodec: callbacks.imageCodec, iconCodec: callbacks.iconCodec, mediaCodec: callbacks.mediaCodec, pdfCodec: callbacks.pdfCodec, isCancelled: callbacks.isCancelled ?? (() => false), waitIfPaused: callbacks.waitIfPaused, inputs: request.inputs });
    for (const output of processed) {
      const relativeOutputPath = buildOutputRelativePath(input.relativePath || input.name, output.name, request.job.output, index);
      outputs.push(await io.writeOutput({ input, output, target: request.job.output, relativeOutputPath }));
    }
    bytesProcessed += input.size ?? 0;
    callbacks.onProgress?.({ processedItems: index + 1, totalItems: request.inputs.length, bytesProcessed });
  }

  return { jobId: request.job.id, status: "completed", outputs, completedAt: now() };
}

export function defaultOutputTarget(): OutputTarget {
  return { kind: "sibling", preserveStructure: true, prefix: "", suffix: "", numbering: "none", numberingStart: 1, collision: "rename" };
}
