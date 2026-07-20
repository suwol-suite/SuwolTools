import { getProcessor } from "@suwol/core";

const encoder = new TextEncoder();
const decoder = new TextDecoder();
const makeInput = (name: string, value: string) => { const data = encoder.encode(value); return { handleId: "00000000-0000-4000-8000-000000000001", name, relativePath: name, size: data.byteLength, mimeType: "text/plain", read: async () => data }; };
const cases: Array<[string, string, Record<string, unknown>]> = [
  ["date-time-tools", "0", { tab: "timestamp", timestampUnit: "seconds" }],
  ["markdown-tools", "# Hello\n\nWorld", { tab: "html", sanitize: true }],
  ["markdown-html-converter", "# Hello", { direction: "markdown-to-html" }],
  ["markdown-table-generator", "a,b\n1,2", { tab: "table-generator", tableDelimiter: "comma" }],
  ["csv-markdown-table-converter", "a,b\n1,2", { tab: "csv-table", direction: "csv-to-markdown" }],
  ["community-post-helper", "문의 이메일 test@example.com", { redactPrivacy: true, draftTitle: "질문" }],
  ["open-graph-preview", "", { title: "Suwol", description: "Tools", url: "https://example.com", type: "website" }],
  ["retro-sfx-generator", "", { waveform: "square", duration: 0.02, seed: "qa" }],
  ["audio-toolkit", "", { operation: "sfx", duration: 0.02, waveform: "sine" }],
];
for (const [toolId, value, options] of cases) {
  const result = await getProcessor(toolId)(makeInput(`${toolId}.txt`, value), options, { isCancelled: () => false });
  const first = result[0];
  console.log(`${toolId}: ${first?.name} (${first?.size ?? first?.data?.byteLength ?? 0} bytes) ${first?.data ? decoder.decode(first.data.slice(0, 4)) : "file"}`);
}
