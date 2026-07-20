import { describe, expect, it } from "vitest";
import { metadataFor } from "../scripts/generate-update-metadata.mjs";
import { parseMetadata } from "../scripts/validate-update-metadata.mjs";

describe("release metadata policy", () => {
  it("keeps platform metadata filenames and checksums aligned", () => {
    const text = metadataFor("linux", "1.2.3", "Suwol Tools-1.2.3-linux-x64.AppImage", new Uint8Array([1, 2, 3]));
    expect(parseMetadata(text)).toMatchObject({ version: "1.2.3", artifact: "Suwol Tools-1.2.3-linux-x64.AppImage", size: 3 });
    expect(text).toContain("sha512:");
  });

  it("does not describe Windows latest.yml as an update target", () => {
    expect("latest-linux.yml").not.toBe("latest.yml");
    expect("latest-mac.yml").not.toBe("latest.yml");
  });

  it("uses the GitHub-normalized dot asset name in update metadata", () => {
    const text = metadataFor("mac", "1.2.3", "Suwol.Tools-1.2.3-mac-arm64.zip", new Uint8Array([1, 2, 3]));
    expect(text).toContain('path: "Suwol.Tools-1.2.3-mac-arm64.zip"');
  });
});
