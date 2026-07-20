export type ToolCategory =
  | "encoding-decoding"
  | "hash-security"
  | "json-data"
  | "text"
  | "generator"
  | "media"
  | "graphics"
  | "dev-utils";

export type InputFormat = "text" | "image" | "audio" | "video" | "pdf" | "binary" | "folder" | "clipboard";
export type OutputFormat = InputFormat | "json" | "csv" | "zip" | "download";
export type ToolCapability = "single" | "multiple" | "folder" | "clipboard" | "batch";
export type ElectronSupport = "full" | "partial" | "web-only";

export type ToolDefinition = {
  id: string;
  name: string;
  description: string;
  category: ToolCategory;
  icon: string;
  keywords: string[];
  inputFormats: InputFormat[];
  outputFormats: OutputFormat[];
  capabilities: ToolCapability[];
  defaultOptions: Record<string, unknown>;
  webSupported: boolean;
  electronOnly: boolean;
  migrated: boolean;
  electronSupport: ElectronSupport;
  worker: boolean;
  externalApi: boolean;
  unsupportedReason?: string;
  popular?: boolean;
  hidden?: boolean;
  aliases?: string[];
};

export type CategoryDefinition = {
  id: ToolCategory;
  name: string;
  description: string;
};

export type InputItem = {
  handleId: string;
  name: string;
  relativePath: string;
  /** Main-process-only persisted path used to restore unfinished jobs. */
  sourcePath?: string;
  size?: number;
  mimeType?: string;
  isDirectory?: boolean;
};

export type InputSource = {
  kind: "files" | "folder" | "clipboard";
  items: InputItem[];
  includeSubdirectories: boolean;
  origin: "dialog" | "drop" | "recent" | "clipboard";
  label?: string;
};

export type OutputTarget = {
  kind: "sibling" | "directory" | "clipboard";
  directory?: string;
  preserveStructure: boolean;
  prefix: string;
  suffix: string;
  numbering: "none" | "sequential";
  numberingStart: number;
  collision: "overwrite" | "skip" | "rename";
};

export type JobStatus = "queued" | "running" | "paused" | "completed" | "failed" | "cancelled";

export type Job = {
  id: string;
  toolId: string;
  input: InputSource;
  output: OutputTarget;
  options: Record<string, unknown>;
  status: JobStatus;
  progress: number;
  processedItems: number;
  totalItems: number;
  speed?: number;
  etaSeconds?: number;
  /** True while a running Worker is waiting to reach its next cooperative pause point. */
  pauseRequested?: boolean;
  error?: string;
  createdAt: string;
  updatedAt: string;
};

export type OutputRecord = {
  inputName: string;
  outputName: string;
  path?: string;
  mimeType: string;
  size: number;
  skipped?: boolean;
};

export type JobResult = {
  jobId: string;
  status: Exclude<JobStatus, "queued" | "running" | "paused">;
  outputs: OutputRecord[];
  error?: string;
  completedAt: string;
};

export type AppSettings = {
  theme: "system" | "light" | "dark";
  language: "system" | "ko" | "en";
  defaultOutputDirectory?: string;
  lastInputDirectory?: string;
  collisionPolicy: OutputTarget["collision"];
  recentItems: InputItem[];
  recentFiles: string[];
  recentFolders: string[];
  favorites: string[];
  recentTools: string[];
  frequentTools: Record<string, number>;
  toolOptions: Record<string, Record<string, unknown>>;
  windowBounds?: { x?: number; y?: number; width: number; height: number };
  sidebarCollapsed: boolean;
  completionNotifications: boolean;
  autoUpdate: boolean;
  onboardingComplete: boolean;
};

export type UpdatePlatform = "macos" | "linux" | "windows" | "unsupported";
export type UpdateStatus = "idle" | "disabled" | "unsupported" | "checking" | "available" | "not-available" | "downloading" | "downloaded" | "error";
export type UpdateState = {
  status: UpdateStatus;
  supported: boolean;
  platform: UpdatePlatform;
  version: string;
  latestVersion?: string;
  progressPercent?: number;
  lastCheckedAt?: string;
  error?: string;
};

export const defaultOutputTarget: OutputTarget = {
  kind: "sibling",
  preserveStructure: true,
  prefix: "",
  suffix: "",
  numbering: "none",
  numberingStart: 1,
  collision: "rename",
};

export const defaultSettings: AppSettings = {
  theme: "system",
  language: "system",
  collisionPolicy: "rename",
  lastInputDirectory: undefined,
  recentItems: [],
  recentFiles: [],
  recentFolders: [],
  favorites: [],
  recentTools: [],
  frequentTools: {},
  toolOptions: {},
  sidebarCollapsed: false,
  completionNotifications: true,
  autoUpdate: true,
  onboardingComplete: false,
};

export function isInputSource(value: unknown): value is InputSource {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<InputSource>;
  return (candidate.kind === "files" || candidate.kind === "folder" || candidate.kind === "clipboard") &&
    Array.isArray(candidate.items) && typeof candidate.includeSubdirectories === "boolean";
}

export function isOutputTarget(value: unknown): value is OutputTarget {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<OutputTarget>;
  return (candidate.kind === "sibling" || candidate.kind === "directory" || candidate.kind === "clipboard") &&
    typeof candidate.preserveStructure === "boolean" &&
    (candidate.collision === "overwrite" || candidate.collision === "skip" || candidate.collision === "rename");
}

export function isSafeToolId(value: unknown): value is string {
  return typeof value === "string" && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value) && value.length <= 80;
}
