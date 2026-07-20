import { execFileSync } from "node:child_process";
import path from "node:path";
const appPath = process.argv[2];
if (process.platform !== "darwin" || !appPath) process.exit(0);
const required = process.env.REQUIRE_MAC_SIGNING === "1";
const identity = process.env.MAC_DEVELOPER_IDENTITY ?? "Developer ID Application";
let found = "";
try { found = execFileSync("security", ["find-identity", "-v", "-p", "codesigning"], { encoding: "utf8" }); } catch { /* handled below */ }
if (!found.includes(identity)) {
  if (required) throw new Error(`Required macOS signing identity was not found: ${identity}`);
  console.warn(`Skipping optional macOS re-sign; identity not found: ${identity}`);
  process.exit(0);
}
const entitlements = path.resolve("build/entitlements.mac.plist");
execFileSync("codesign", ["--force", "--deep", "--options", "runtime", "--entitlements", entitlements, "--sign", identity, appPath], { stdio: "inherit" });
execFileSync("codesign", ["--verify", "--deep", "--strict", appPath], { stdio: "inherit" });
