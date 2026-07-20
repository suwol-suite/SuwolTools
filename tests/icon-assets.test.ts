import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";

describe("official application icon assets", () => {
  it("passes the deterministic generated asset check", () => {
    expect(() => execFileSync(process.execPath, ["scripts/check-icons.mjs"], { cwd: process.cwd(), stdio: "pipe" })).not.toThrow();
  });
});
