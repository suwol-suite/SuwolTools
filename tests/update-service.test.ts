import { EventEmitter } from "node:events";
import { describe, expect, it } from "vitest";
import { isNewerVersion, resolveUpdateSupport, UpdateService } from "../apps/desktop/src/main/update-service";
import type { AppUpdater } from "electron-updater";

describe("update policy", () => {
  it("disables development and Windows updater initialization", () => {
    expect(resolveUpdateSupport({ isPackaged: false, platform: "darwin", version: "1.0.0" }).status).toBe("disabled");
    const support = resolveUpdateSupport({ isPackaged: true, platform: "win32", version: "1.0.0" });
    expect(support).toMatchObject({ supported: false, platform: "windows", status: "unsupported" });
    expect(support.reason).toContain("서명");
  });

  it("supports signed macOS and AppImage Linux only", () => {
    expect(resolveUpdateSupport({ isPackaged: true, platform: "darwin", version: "1.0.0" }).supported).toBe(true);
    expect(resolveUpdateSupport({ isPackaged: true, platform: "linux", appImagePath: "/tmp/Suwol.AppImage", version: "1.0.0" }).supported).toBe(true);
    expect(resolveUpdateSupport({ isPackaged: true, platform: "linux", version: "1.0.0" }).supported).toBe(false);
  });

  it("compares release versions without accepting downgrades", () => {
    expect(isNewerVersion("1.2.0", "1.3.0")).toBe(true);
    expect(isNewerVersion("1.2.0", "1.2.0")).toBe(false);
    expect(isNewerVersion("1.2.0", "1.1.9")).toBe(false);
  });

  it("publishes available and downloaded state from updater events", () => {
    const updater = new EventEmitter() as AppUpdater;
    const service = new UpdateService({ isPackaged: true, platform: "darwin", version: "1.0.0", updater });
    updater.emit("update-available", { version: "1.1.0" });
    expect(service.getState()).toMatchObject({ status: "available", latestVersion: "1.1.0" });
    updater.emit("download-progress", { percent: 42 });
    expect(service.getState()).toMatchObject({ status: "downloading", progressPercent: 42 });
    updater.emit("update-downloaded", { version: "1.1.0" });
    expect(service.getState()).toMatchObject({ status: "downloaded", progressPercent: 100 });
  });
});
