import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { defaultSettings, type AppSettings } from "@suwol/shared";

export class SettingsStore {
  private readonly filePath: string;
  private value: AppSettings = structuredClone(defaultSettings);

  constructor(userDataPath: string) {
    this.filePath = path.join(userDataPath, "settings.json");
  }

  async load(): Promise<AppSettings> {
    try {
      const parsed = JSON.parse(await readFile(this.filePath, "utf8")) as Partial<AppSettings>;
      this.value = { ...structuredClone(defaultSettings), ...parsed, recentItems: parsed.recentItems ?? [], recentFiles: parsed.recentFiles ?? [], recentFolders: parsed.recentFolders ?? [], favorites: parsed.favorites ?? [], recentTools: parsed.recentTools ?? [], frequentTools: parsed.frequentTools ?? {}, toolOptions: parsed.toolOptions ?? {} };
    } catch {
      this.value = structuredClone(defaultSettings);
    }
    return structuredClone(this.value);
  }

  get(): AppSettings { return structuredClone(this.value); }

  async update(patch: Partial<AppSettings>): Promise<AppSettings> {
    this.value = { ...this.value, ...patch };
    await mkdir(path.dirname(this.filePath), { recursive: true });
    await writeFile(this.filePath, JSON.stringify(this.value, null, 2), "utf8");
    return this.get();
  }
}
