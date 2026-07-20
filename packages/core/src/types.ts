import type { InputItem, Job, OutputRecord, OutputTarget } from "@suwol/shared";

export type ResolvedInput = InputItem & {
  read: () => Promise<Uint8Array>;
  sourcePath?: string;
  sourceRoot?: string;
};

export type ProcessedOutput = {
  name: string;
  data?: Uint8Array;
  filePath?: string;
  size?: number;
  mimeType: string;
};

export type ImageCodec = {
  convert: (data: Uint8Array, options: Record<string, unknown>) => Promise<{ data: Uint8Array; mimeType: string; extension: string }>;
  compose?: (data: Uint8Array[], options: Record<string, unknown>) => Promise<{ data: Uint8Array; mimeType: string; extension: string }>;
  extractFrames?: (data: Uint8Array, options: Record<string, unknown>) => Promise<Array<{ data: Uint8Array; mimeType: string; extension: string; index: number }>>;
  encodeFrames?: (frames: Array<{ data: Uint8Array; delayMs?: number }>, options: Record<string, unknown>) => Promise<{ data: Uint8Array; mimeType: string; extension: string }>;
  renderProject?: (data: Uint8Array, options: Record<string, unknown>) => Promise<{ data: Uint8Array; mimeType: string; extension: string }>;
};

export type IconCodec = {
  createIco: (png: Uint8Array) => Uint8Array;
  createIcns: (png: Uint8Array) => Uint8Array;
};

export type MediaCodec = {
  convertFile: (sourcePath: string, options: Record<string, unknown>, onProgress?: (fraction: number) => void) => Promise<{ filePath: string; mimeType: string; extension: string; size: number }>;
  encodeFrames?: (frames: Array<{ data: Uint8Array; delayMs?: number }>, options: Record<string, unknown>, onProgress?: (fraction: number) => void) => Promise<{ filePath: string; mimeType: string; extension: string; size: number }>;
};

export type PdfCodec = {
  renderPages: (data: Uint8Array, options: Record<string, unknown>, onProgress?: (fraction: number) => void) => Promise<Array<{ data: Uint8Array; mimeType: string; extension: string; index: number }>>;
};

export type ProcessorContext = {
  imageCodec?: ImageCodec;
  iconCodec?: IconCodec;
  mediaCodec?: MediaCodec;
  pdfCodec?: PdfCodec;
  isCancelled: () => boolean;
  inputs?: ResolvedInput[];
  waitIfPaused?: () => Promise<void>;
};

export type ToolProcessor = ((input: ResolvedInput, options: Record<string, unknown>, context: ProcessorContext) => Promise<ProcessedOutput[]>) & { batch?: boolean };

export type PlatformOutput = OutputRecord & {
  data?: Uint8Array;
};

export type FileIoAdapter = {
  writeOutput: (request: {
    input: ResolvedInput;
    output: ProcessedOutput;
    target: OutputTarget;
    relativeOutputPath: string;
  }) => Promise<PlatformOutput>;
};

export type ExecutionCallbacks = {
  imageCodec?: ImageCodec;
  iconCodec?: IconCodec;
  mediaCodec?: MediaCodec;
  pdfCodec?: PdfCodec;
  onProgress?: (progress: { processedItems: number; totalItems: number; bytesProcessed: number }) => void;
  isCancelled?: () => boolean;
  waitIfPaused?: () => Promise<void>;
};

export type JobExecutionRequest = {
  job: Pick<Job, "id" | "toolId" | "options" | "output">;
  inputs: ResolvedInput[];
};
