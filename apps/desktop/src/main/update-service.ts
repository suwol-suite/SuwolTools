import type { AppUpdater, ProgressInfo, UpdateDownloadedEvent, UpdateInfo } from "electron-updater";
import type { UpdatePlatform, UpdateState } from "@suwol/shared";

export type UpdateListener = (state: UpdateState) => void;

export type UpdateRuntimeOptions = {
  isPackaged: boolean;
  platform: NodeJS.Platform;
  appImagePath?: string;
  version: string;
  updater?: AppUpdater;
};

export function updatePlatform(platform: NodeJS.Platform): UpdatePlatform {
  if (platform === "darwin") return "macos";
  if (platform === "linux") return "linux";
  if (platform === "win32") return "windows";
  return "unsupported";
}

export function resolveUpdateSupport(options: UpdateRuntimeOptions): { supported: boolean; platform: UpdatePlatform; status: UpdateState["status"]; reason?: string } {
  const target = updatePlatform(options.platform);
  if (!options.isPackaged) return { supported: false, platform: target, status: "disabled", reason: "개발 환경에서는 자동 업데이트를 확인하지 않습니다." };
  if (target === "macos") return { supported: true, platform: target, status: "idle" };
  if (target === "linux" && options.appImagePath) return { supported: true, platform: target, status: "idle" };
  if (target === "linux") return { supported: false, platform: target, status: "unsupported", reason: "AppImage 실행 환경에서만 Linux 자동 업데이트를 지원합니다." };
  if (target === "windows") return { supported: false, platform: target, status: "unsupported", reason: "Windows 자동 업데이트는 코드 서명 준비 후 지원합니다." };
  return { supported: false, platform: target, status: "unsupported", reason: "현재 플랫폼은 자동 업데이트 대상이 아닙니다." };
}

function versionParts(value: string): number[] | undefined {
  const match = value.trim().replace(/^v/i, "").match(/^(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/);
  return match ? [Number(match[1]), Number(match[2]), Number(match[3])] : undefined;
}

export function isNewerVersion(current: string, candidate: string): boolean {
  const left = versionParts(current); const right = versionParts(candidate);
  if (!left || !right) return false;
  for (let index = 0; index < 3; index += 1) if (right[index]! !== left[index]!) return right[index]! > left[index]!;
  return false;
}

export class UpdateService {
  private readonly options: UpdateRuntimeOptions;
  private readonly support: ReturnType<typeof resolveUpdateSupport>;
  private updater?: AppUpdater;
  private initialized?: Promise<void>;
  private state: UpdateState;
  private listeners = new Set<UpdateListener>();

  constructor(options: UpdateRuntimeOptions) {
    this.options = options;
    this.support = resolveUpdateSupport(options);
    this.state = {
      status: this.support.status,
      supported: this.support.supported,
      platform: this.support.platform,
      version: options.version,
      error: this.support.reason,
    };
    if (this.support.supported && options.updater) this.attachUpdater(options.updater);
  }

  getState(): UpdateState { return { ...this.state }; }
  subscribe(listener: UpdateListener): () => void { this.listeners.add(listener); listener(this.getState()); return () => this.listeners.delete(listener); }

  async initialize(): Promise<void> {
    if (!this.support.supported || this.updater) return;
    this.initialized ??= import("electron-updater").then(({ autoUpdater }) => this.attachUpdater(autoUpdater));
    await this.initialized;
  }

  async checkForUpdates(): Promise<UpdateState> {
    if (!this.support.supported) return this.getState();
    await this.initialize();
    if (!this.updater) return this.getState();
    this.setState({ status: "checking", error: undefined });
    try { await this.updater.checkForUpdates(); }
    catch { this.setState({ status: "error", error: "업데이트 확인에 실패했습니다." }); }
    return this.getState();
  }

  async checkOnStartup(enabled: boolean): Promise<void> {
    if (!enabled || !this.support.supported) return;
    await new Promise<void>((resolve) => setTimeout(resolve, 12_000));
    await this.checkForUpdates();
  }

  async downloadUpdate(): Promise<UpdateState> {
    if (!this.support.supported || !this.state.latestVersion || !this.updater) return this.getState();
    this.setState({ status: "downloading", error: undefined });
    try { await this.updater.downloadUpdate(); }
    catch { this.setState({ status: "error", error: "업데이트 다운로드에 실패했습니다." }); }
    return this.getState();
  }

  cancelDownload(): boolean {
    const candidate = this.updater as (AppUpdater & { cancelDownload?: () => void }) | undefined;
    if (candidate?.cancelDownload) { candidate.cancelDownload(); this.setState({ status: "available" }); return true; }
    return false;
  }

  installUpdate(): UpdateState {
    if (this.updater && this.state.status === "downloaded") this.updater.quitAndInstall(false, true);
    return this.getState();
  }

  private attachUpdater(updater: AppUpdater): void {
    this.updater = updater;
    updater.autoDownload = false;
    updater.autoInstallOnAppQuit = false;
    updater.allowPrerelease = false;
    updater.on("checking-for-update", () => this.setState({ status: "checking", error: undefined }));
    updater.on("update-available", (info: UpdateInfo) => {
      if (!isNewerVersion(this.options.version, info.version)) { this.setState({ status: "not-available", latestVersion: info.version, error: undefined }); return; }
      this.setState({ status: "available", latestVersion: info.version, error: undefined });
    });
    updater.on("update-not-available", (info: UpdateInfo) => this.setState({ status: "not-available", latestVersion: info.version, error: undefined }));
    updater.on("download-progress", (info: ProgressInfo) => this.setState({ status: "downloading", progressPercent: Math.max(0, Math.min(100, info.percent)), error: undefined }));
    updater.on("update-downloaded", (info: UpdateDownloadedEvent) => this.setState({ status: "downloaded", latestVersion: info.version, progressPercent: 100, error: undefined }));
    updater.on("error", () => this.setState({ status: "error", error: "업데이트 처리 중 오류가 발생했습니다." }));
  }

  private setState(patch: Partial<UpdateState>): void {
    this.state = { ...this.state, ...patch, lastCheckedAt: patch.status === "checking" ? this.state.lastCheckedAt : new Date().toISOString() };
    const snapshot = this.getState();
    for (const listener of this.listeners) listener(snapshot);
  }
}
