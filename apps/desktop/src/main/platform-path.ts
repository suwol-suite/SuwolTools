import os from "node:os";
import path from "node:path";

export type DesktopPlatform = "win32" | "darwin" | "linux" | "other";

export function currentPlatform(): DesktopPlatform {
  return process.platform === "win32" || process.platform === "darwin" || process.platform === "linux" ? process.platform : "other";
}

export function isWindowsDrivePath(value: string): boolean {
  return /^[a-zA-Z]:[\\/]/.test(value);
}

export function sanitizeFilename(value: string, fallback = "output"): string {
  const sanitized = value.replace(/[<>:"/\\|?*\u0000-\u001f]/g, "-").replace(/[. ]+$/g, "").trim();
  return sanitized || fallback;
}

export function defaultUserOutputDirectory(): string {
  return path.join(os.homedir(), "Suwol Tools", "Output");
}

export function platformPathInfo(): { platform: DesktopPlatform; separator: string; supportsDriveLetters: boolean } {
  return { platform: currentPlatform(), separator: path.sep, supportsDriveLetters: currentPlatform() === "win32" };
}
