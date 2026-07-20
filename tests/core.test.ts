import { describe, expect, it } from "vitest";
import { executeJob, getProcessor, type ResolvedInput } from "@suwol/core";
import { tools, type OutputTarget } from "@suwol/shared";

const target: OutputTarget = { kind: "directory", directory: "/tmp/suwol-test", preserveStructure: true, prefix: "out-", suffix: "", numbering: "none", numberingStart: 1, collision: "rename" };

function input(name: string, value: string): ResolvedInput {
  const item = { handleId: "test-handle", name, relativePath: `nested/${name}`, size: value.length, mimeType: "text/plain" };
  return { ...item, read: async () => new TextEncoder().encode(value) };
}

describe("shared file executor", () => {
  it("keeps the complete 69-tool registry metadata explicit", () => {
    expect(tools).toHaveLength(69);
    for (const tool of tools) {
      expect(typeof tool.migrated).toBe("boolean");
      expect(["full", "partial", "web-only"]).toContain(tool.electronSupport);
      expect(typeof tool.worker).toBe("boolean");
      expect(typeof tool.externalApi).toBe("boolean");
      if (!tool.migrated) expect(tool.unsupportedReason).toBeTruthy();
    }
  });

  it("has a registered processor for every migrated file-processing tool", () => {
    for (const tool of tools.filter((candidate) => candidate.migrated && !candidate.externalApi)) {
      expect(() => getProcessor(tool.id), tool.id).not.toThrow();
    }
  });

  it("uses the same file hash processor for a memory adapter", async () => {
    const outputs: Array<{ name: string; data: Uint8Array }> = [];
    const source = input("hello.txt", "hello");
    const result = await executeJob({ job: { id: "job-1", toolId: "file-hash-generator", options: {}, output: target }, inputs: [source] }, {
      writeOutput: async ({ output }) => { outputs.push({ name: output.name, data: output.data }); return { inputName: source.name, outputName: output.name, mimeType: output.mimeType, size: output.data.byteLength, data: output.data }; },
    });
    expect(result.status).toBe("completed");
    expect(outputs[0]?.name).toBe("hello.sha256.txt");
    expect(new TextDecoder().decode(outputs[0]?.data)).toContain("2cf24dba5fb0a30e");
  });

  it("does not expose the restricted network adapter through the generic file processor", async () => {
    const source = input("hello.txt", "hello");
    await expect(executeJob({ job: { id: "job-2", toolId: "network-tools", options: {}, output: target }, inputs: [source] }, { writeOutput: async () => { throw new Error("not expected"); } })).rejects.toThrow("has not been migrated");
  });
});
