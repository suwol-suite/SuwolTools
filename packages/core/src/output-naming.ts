import type { OutputTarget } from "@suwol/shared";

export function dirnameOf(relativePath: string): string {
  const normalized = relativePath.replaceAll("\\", "/");
  const index = normalized.lastIndexOf("/");
  return index < 0 ? "" : normalized.slice(0, index);
}

export function basenameOf(relativePath: string): string {
  const normalized = relativePath.replaceAll("\\", "/");
  return normalized.slice(normalized.lastIndexOf("/") + 1);
}

export function replaceExtension(name: string, extension: string): string {
  const dot = name.lastIndexOf(".");
  const stem = dot > 0 ? name.slice(0, dot) : name;
  return `${stem}.${extension.replace(/^\./, "")}`;
}

export function buildOutputRelativePath(inputRelativePath: string, outputName: string, target: OutputTarget, index: number): string {
  const prefix = target.prefix ?? "";
  const suffix = target.suffix ?? "";
  const named = `${prefix}${outputName.replace(/\.[^/.]+$/, "")}${suffix}${outputName.match(/\.[^/.]+$/)?.[0] ?? ""}`;
  const numbered = target.numbering === "sequential" ? `${String(target.numberingStart + index).padStart(3, "0")}-${named}` : named;
  const directory = target.preserveStructure ? dirnameOf(inputRelativePath) : "";
  return directory ? `${directory}/${numbered}` : numbered;
}

export function sanitizeRelativePath(value: string): string {
  return value.replaceAll("\\", "/").split("/").filter((part) => part && part !== "." && part !== "..").join("/");
}
