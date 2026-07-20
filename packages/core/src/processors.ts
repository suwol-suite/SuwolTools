import { getToolById } from "@suwol/shared";
import type { ProcessedOutput, ResolvedInput, ToolProcessor } from "./types";
import { getLegacyProcessor } from "./legacy-processors";
import { getExtendedProcessor } from "./extended-processors";
import { getMediaProcessor } from "./media-processors";
import { audioProcessor, retroSfxProcessor, videoProcessor } from "./audio-processors";

const textDecoder = new TextDecoder();
const textEncoder = new TextEncoder();

function asText(data: Uint8Array): string {
  return textDecoder.decode(data);
}

async function digest(data: Uint8Array): Promise<string> {
  if (!globalThis.crypto?.subtle) throw new Error("Web Crypto digest is unavailable.");
  const buffer = await globalThis.crypto.subtle.digest("SHA-256", data as BufferSource);
  return Array.from(new Uint8Array(buffer), (value) => value.toString(16).padStart(2, "0")).join("");
}

const fileHashProcessor: ToolProcessor = async (input) => {
  const data = await input.read();
  const value = await digest(data);
  const name = `${input.name.replace(/\.[^/.]+$/, "")}.sha256.txt`;
  return [{ name, data: textEncoder.encode(`${value}  ${input.name}\n`), mimeType: "text/plain;charset=utf-8" }];
};

const textNormalizeProcessor: ToolProcessor = async (input, options) => {
  const value = asText(await input.read());
  const mode = options.mode === "upper" || options.mode === "lower" ? options.mode : "trim";
  const normalized = mode === "upper" ? value.toUpperCase() : mode === "lower" ? value.toLowerCase() : value.replaceAll(/\s+$/gm, "");
  return [{ name: `${input.name.replace(/\.[^/.]+$/, "")}.normalized.txt`, data: textEncoder.encode(normalized), mimeType: "text/plain;charset=utf-8" }];
};

function imageProcessor(input: ResolvedInput, options: Record<string, unknown>, context: { imageCodec?: { convert: (data: Uint8Array, options: Record<string, unknown>) => Promise<{ data: Uint8Array; mimeType: string; extension: string }> } }): Promise<ProcessedOutput[]> {
  if (!context.imageCodec) throw new Error("This image tool is unavailable in the current platform adapter.");
  const imageOptions = { ...options };
  if (imageOptions.outputFormat === "original") imageOptions.outputFormat = input.mimeType === "image/png" ? "png" : input.mimeType === "image/jpeg" ? "jpeg" : "webp";
  if (typeof imageOptions.maxWidth === "number" && imageOptions.maxWidth > 0) imageOptions.width = imageOptions.maxWidth;
  if (typeof imageOptions.maxHeight === "number" && imageOptions.maxHeight > 0) imageOptions.height = imageOptions.maxHeight;
  return input.read().then((data) => context.imageCodec!.convert(data, imageOptions).then((result) => [{
    name: `${input.name.replace(/\.[^/.]+$/, "")}.${result.extension}`,
    data: result.data,
    mimeType: result.mimeType,
  }]));
}

export function getProcessor(toolId: string): ToolProcessor {
  const legacyProcessor = getLegacyProcessor(getToolById(toolId)?.id ?? toolId);
  if (legacyProcessor) return legacyProcessor;
  const extendedProcessor = getExtendedProcessor(getToolById(toolId)?.id ?? toolId);
  if (extendedProcessor) return extendedProcessor;
  const mediaProcessor = getMediaProcessor(getToolById(toolId)?.id ?? toolId);
  if (mediaProcessor) return mediaProcessor;
  if (toolId === "audio-toolkit") return audioProcessor;
  if (toolId === "retro-sfx-generator") return retroSfxProcessor;
  if (toolId === "video-to-gif-webp") return videoProcessor;
  switch (getToolById(toolId)?.id) {
    case "file-hash-generator":
      return fileHashProcessor;
    case "image-resizer":
      return (input, options, context) => imageProcessor(input, { ...options, operation: "resize" }, context);
    case "webp-converter":
      return (input, options, context) => imageProcessor(input, { ...options, operation: "convert" }, context);
    case "image-compressor":
      return (input, options, context) => imageProcessor(input, { ...options, operation: "compress" }, context);
    case "text-case-converter":
      return textNormalizeProcessor;
    default:
      throw new Error(`Tool ${toolId} has not been migrated to the shared file processor yet.`);
  }
}
