import type { CategoryDefinition, InputFormat, OutputFormat, ToolCapability, ToolCategory, ToolDefinition } from "./contracts";

export const categories: CategoryDefinition[] = [
  { id: "encoding-decoding", name: "Encoding & Decoding", description: "Encode, decode, and transform representations." },
  { id: "hash-security", name: "Hash & Security", description: "Hashing, signatures, and security helpers." },
  { id: "json-data", name: "JSON & Data", description: "JSON, CSV, YAML, XML, and data tools." },
  { id: "text", name: "Text", description: "Text transformation, comparison, and formatting." },
  { id: "generator", name: "Generators", description: "Create names, passwords, content, and assets." },
  { id: "media", name: "Media", description: "Audio, video, PDF, and media workflows." },
  { id: "graphics", name: "Graphics", description: "Images, icons, QR codes, and visual tools." },
  { id: "dev-utils", name: "Developer Utilities", description: "Everyday developer and web utilities." },
];

const definitions: Array<[string, ToolCategory, string[]?]> = [
  ["base64", "encoding-decoding", ["encode", "decode", "text"]], ["url-encode", "encoding-decoding", ["url", "uri"]],
  ["html-escape", "encoding-decoding", ["html", "escape"]], ["json-escape", "json-data", ["json", "escape"]],
  ["unicode-escape", "text", ["unicode", "utf16"]], ["hex-converter", "encoding-decoding", ["hex", "bytes"]],
  ["binary-converter", "encoding-decoding", ["binary", "bytes"]], ["jwt-decoder", "hash-security", ["jwt", "token"]],
  ["hash-generator", "hash-security", ["hash", "sha", "crypto"]], ["hmac-generator", "hash-security", ["hmac", "signature"]],
  ["uuid-generator", "dev-utils", ["uuid", "guid"]], ["timestamp-converter", "dev-utils", ["timestamp", "unix"]],
  ["date-time-tools", "dev-utils", ["date", "time", "timezone"]], ["json-formatter", "json-data", ["json", "pretty"]],
  ["json-schema-generator", "json-data", ["schema", "json"]], ["json-to-typescript", "dev-utils", ["typescript", "interface"]],
  ["csv-markdown-table-converter", "text", ["csv", "markdown"]], ["name-generator", "generator", ["name", "random"]],
  ["qr-code-generator", "graphics", ["qr", "qrcode"]], ["barcode-generator", "graphics", ["barcode"]],
  ["app-icon-generator", "graphics", ["app", "icon"]], ["android-asset-generator", "graphics", ["android", "asset"]],
  ["ios-asset-generator", "graphics", ["ios", "asset"]], ["image-resizer", "graphics", ["image", "resize"]],
  ["image-editor", "graphics", ["image", "edit"]], ["screenshot-stitch-redact", "graphics", ["screenshot", "redact"]],
  ["regex-tester", "dev-utils", ["regex", "regexp"]], ["text-diff", "text", ["diff", "compare"]],
  ["cron-generator", "dev-utils", ["cron", "schedule"]], ["color-converter", "graphics", ["color", "hex"]],
  ["password-generator", "generator", ["password", "random"]], ["pdf-tools", "media", ["pdf", "merge"]],
  ["yaml-json-converter", "json-data", ["yaml", "json"]], ["csv-json-converter", "json-data", ["csv", "json"]],
  ["xml-formatter", "json-data", ["xml", "format"]], ["sql-formatter", "dev-utils", ["sql", "format"]],
  ["markdown-tools", "text", ["markdown", "html"]], ["community-post-helper", "text", ["community", "privacy"]],
  ["markdown-html-converter", "text", ["markdown", "html"]], ["seo-meta-generator", "dev-utils", ["seo", "meta"]],
  ["open-graph-preview", "dev-utils", ["open graph", "preview"]], ["image-compressor", "graphics", ["image", "compress"]],
  ["webp-converter", "graphics", ["webp", "image"]], ["gif-frame-editor", "media", ["gif", "frame"]],
  ["audio-toolkit", "media", ["audio", "waveform"]], ["retro-sfx-generator", "media", ["sfx", "audio"]],
  ["video-to-gif-webp", "media", ["video", "gif", "webp"]], ["css-generator", "graphics", ["css", "gradient"]],
  ["easing-preview", "dev-utils", ["easing", "animation"]], ["lorem-ipsum-generator", "text", ["lorem", "placeholder"]],
  ["number-base-converter", "dev-utils", ["binary", "hex", "decimal"]], ["unit-converter", "dev-utils", ["unit", "measure"]],
  ["url-parser", "dev-utils", ["url", "query"]], ["user-agent-parser", "dev-utils", ["user agent", "browser"]],
  ["base64-image-converter", "graphics", ["base64", "image"]], ["html-entity-reference", "text", ["html", "entity"]],
  ["markdown-table-generator", "text", ["markdown", "table"]], ["http-status-codes", "dev-utils", ["http", "status"]],
  ["jsonpath-tester", "json-data", ["jsonpath", "query"]], ["file-hash-generator", "hash-security", ["file", "checksum"]],
  ["text-case-converter", "text", ["case", "camel", "snake"]], ["text-sort-deduplicate", "text", ["sort", "deduplicate"]],
  ["robots-txt-generator", "dev-utils", ["robots", "seo"]], ["sitemap-generator", "dev-utils", ["sitemap", "seo"]],
  ["utm-url-builder", "dev-utils", ["utm", "tracking"]], ["mime-type-reference", "dev-utils", ["mime", "content type"]],
  ["network-tools", "dev-utils", ["network", "dns", "ssl"]], ["code-minifier", "dev-utils", ["minify", "code"]],
  ["code-beautifier", "dev-utils", ["format", "code"]],
];

const mediaIds = new Set(["audio-toolkit", "gif-frame-editor", "pdf-tools", "retro-sfx-generator", "video-to-gif-webp"]);
const imageIds = new Set(["image-resizer", "image-editor", "image-compressor", "webp-converter", "base64-image-converter", "app-icon-generator", "android-asset-generator", "ios-asset-generator", "screenshot-stitch-redact", "gif-frame-editor"]);
const fileIds = new Set(["file-hash-generator", "image-resizer", "image-compressor", "webp-converter", "app-icon-generator", "android-asset-generator", "ios-asset-generator", "image-editor", "screenshot-stitch-redact", "pdf-tools", "gif-frame-editor", "audio-toolkit", "video-to-gif-webp", "base64-image-converter"]);
const migratedIds = new Set([
  "file-hash-generator", "webp-converter", "image-resizer",
  "base64", "url-encode", "html-escape", "json-escape", "unicode-escape", "hex-converter", "binary-converter",
  "json-formatter", "csv-json-converter", "yaml-json-converter",
  "json-schema-generator", "json-to-typescript", "jsonpath-tester", "text-case-converter", "text-sort-deduplicate",
  "regex-tester", "text-diff", "number-base-converter", "url-parser", "utm-url-builder",
  "password-generator", "lorem-ipsum-generator", "cron-generator", "color-converter", "html-entity-reference",
  "user-agent-parser", "robots-txt-generator", "sitemap-generator", "sql-formatter", "code-minifier",
  "jwt-decoder", "hash-generator", "hmac-generator", "uuid-generator", "xml-formatter", "code-beautifier", "http-status-codes", "mime-type-reference",
  "name-generator", "unit-converter", "easing-preview", "css-generator", "qr-code-generator", "barcode-generator", "seo-meta-generator",
  "image-compressor", "base64-image-converter",
  "timestamp-converter", "date-time-tools", "markdown-tools", "markdown-html-converter", "csv-markdown-table-converter", "markdown-table-generator", "community-post-helper", "open-graph-preview",
  "app-icon-generator", "android-asset-generator", "ios-asset-generator", "retro-sfx-generator",
  "image-editor", "screenshot-stitch-redact", "pdf-tools", "gif-frame-editor", "audio-toolkit", "video-to-gif-webp", "network-tools",
]);
const externalApiIds = new Set(["network-tools"]);
const browserOnlyIds = new Set<string>();
const inputFormatOverrides: Partial<Record<string, InputFormat[]>> = {
  "app-icon-generator": ["image", "clipboard"], "android-asset-generator": ["image", "clipboard"], "ios-asset-generator": ["image", "clipboard"], "image-editor": ["image", "clipboard"], "screenshot-stitch-redact": ["image", "clipboard"],
  "pdf-tools": ["pdf", "image", "binary"], "gif-frame-editor": ["image", "binary", "clipboard"], "audio-toolkit": ["audio", "binary"], "retro-sfx-generator": ["text", "clipboard"], "video-to-gif-webp": ["video", "binary"], "network-tools": ["text", "clipboard"],
};
const outputFormatOverrides: Partial<Record<string, OutputFormat[]>> = {
  "app-icon-generator": ["image", "json", "text", "zip", "download"], "android-asset-generator": ["image", "text", "zip", "download"], "ios-asset-generator": ["image", "json", "text", "zip", "download"], "image-editor": ["image", "json", "download"], "screenshot-stitch-redact": ["image", "download"],
  "pdf-tools": ["pdf", "image", "json", "zip", "download"], "gif-frame-editor": ["image", "zip", "download"], "audio-toolkit": ["audio", "json", "download"], "retro-sfx-generator": ["audio", "json", "zip", "download"], "video-to-gif-webp": ["image", "download"], "network-tools": ["text", "json", "clipboard"],
};
const electronSupportOverrides: Partial<Record<string, ToolDefinition["electronSupport"]>> = { "network-tools": "full" };
function unsupportedReasonFor(id: string, category: ToolCategory): string | undefined {
  if (migratedIds.has(id)) return undefined;
  if (externalApiIds.has(id)) return "외부 네트워크/API 의존 기능으로 Electron 로컬 Worker에서 직접 실행하지 않습니다. 원본 웹 버전을 엽니다.";
  if (["pdf-tools", "audio-toolkit", "video-to-gif-webp", "gif-frame-editor"].includes(id)) return "기본 Worker/프로세스 prototype은 있으나 원본의 전체 PDF·미디어 옵션과 결과 형식 parity 검증이 끝나지 않았습니다. 원본 웹 버전을 엽니다.";
  if (["image-editor", "screenshot-stitch-redact"].includes(id)) return "기본 sharp/ZIP prototype은 있으나 원본 Canvas 편집 상태와 고급 redact 규칙 parity가 끝나지 않았습니다. 원본 웹 버전을 엽니다.";
  if (["markdown-tools", "markdown-html-converter", "csv-markdown-table-converter", "markdown-table-generator", "community-post-helper"].includes(id)) return "원본 웹 UI와 DOM/개인정보 처리 옵션을 공통 파일 계약으로 옮기는 작업이 남아 있습니다.";
  if (category === "graphics" || category === "media") return "브라우저 Canvas/미디어 런타임과 동일한 로컬 어댑터 검증이 남아 있습니다.";
  return "원본 웹 UI 옵션을 공통 파일 작업 계약으로 분리하는 작업이 남아 있습니다.";
}
const legacyDefaults: Record<string, Record<string, unknown>> = {
  base64: { operation: "encode" },
  "url-encode": { operation: "encode" },
  "html-escape": { operation: "escape" },
  "json-escape": { operation: "escape" },
  "unicode-escape": { operation: "escape" },
  "hex-converter": { operation: "text-to-hex" },
  "binary-converter": { operation: "text-to-binary" },
  "json-formatter": { operation: "pretty" },
  "csv-json-converter": { mode: "csvToJson", delimiter: ",", useHeader: true },
  "yaml-json-converter": { mode: "yamlToJson" },
  "json-schema-generator": { title: "Root", includeRequired: true, allowNull: true },
  "json-to-typescript": { rootName: "Root", outputKind: "interface", optionalProperties: false, separateNestedTypes: true, nullAsOptional: true },
  "jsonpath-tester": { expression: "$" },
  "text-sort-deduplicate": { direction: "asc", deduplicate: true, removeEmpty: true, trimWhitespace: true, caseInsensitive: false },
  "regex-tester": { pattern: "", flags: "g" },
  "text-diff": { rightText: "", ignoreWhitespace: false, ignoreCase: false },
  "number-base-converter": { base: 10 },
  "url-parser": { decodeValues: true },
  "utm-url-builder": { baseUrl: "", source: "", medium: "", campaign: "", term: "", content: "" },
  "password-generator": { length: 16, count: 10, includeUppercase: true, includeLowercase: true, includeNumbers: true, includeSymbols: true, excludeAmbiguous: true },
  "lorem-ipsum-generator": { type: "words", count: 3, startWithLorem: true, includeLineBreaks: true },
  "cron-generator": { minute: "*", hour: "*", dayOfMonth: "*", month: "*", dayOfWeek: "*" },
  "color-converter": { mode: "hex" },
  "html-entity-reference": { mode: "encode" },
  "user-agent-parser": { userAgent: "" },
  "robots-txt-generator": { mode: "allowAll", userAgent: "*", allowPaths: "/", disallowPaths: "", sitemapUrl: "", crawlDelay: "" },
  "sitemap-generator": { changefreq: "monthly", priority: "0.7", includeLastmod: false },
  "sql-formatter": { mode: "format", dialect: "standard" },
  "code-minifier": { language: "javascript", removeComments: true, collapseWhitespace: true },
  "jwt-decoder": {},
  "hash-generator": { algorithms: ["md5", "sha1", "sha256", "sha512"], format: "hex-lower" },
  "hmac-generator": { algorithm: "HMAC-SHA256", secret: "" },
  "uuid-generator": { version: "v4", namespace: "", name: "", count: 10, outputFormat: "lowercase", batchFormat: "plain" },
  "xml-formatter": { mode: "format" },
  "code-beautifier": { language: "javascript", indent: "  " },
  "http-status-codes": { query: "", statusClass: "all" },
  "mime-type-reference": { query: "", category: "all" },
  "name-generator": { countryId: "ko-KR", gender: "random", fixedSurname: "", count: 10, unique: true, showRomanized: false, outputFormat: "text", displayMode: "full" },
  "unit-converter": { category: "length", fromUnit: "m", toUnit: "km", precision: 4, cssBaseFontSize: 16 },
  "easing-preview": { easingId: "ease-in-out" },
  "css-generator": { type: "linear", angle: 135, startColor: "#7c5cff", endColor: "#14b8a6", className: "generated-style", repeating: false },
  "qr-code-generator": { size: 512, margin: 4, foregroundColor: "#000000", backgroundColor: "#ffffff", errorCorrectionLevel: "M", transparentBackground: false },
  "barcode-generator": { format: "CODE128", width: 2, height: 100, margin: 10, displayValue: true, fontSize: 16, lineColor: "#000000", background: "#ffffff" },
  "seo-meta-generator": { mode: "seo", title: "", description: "", keywords: "", canonicalUrl: "", robots: "index,follow", author: "" },
  "image-compressor": { outputFormat: "original", quality: 80, maxWidth: 0, maxHeight: 0, keepAspectRatio: true, backgroundColor: "#ffffff" },
  "base64-image-converter": { fallbackMimeType: "image/png" },
  "timestamp-converter": { unit: "auto" },
  "date-time-tools": { tab: "timestamp", timestampUnit: "auto", zoneMode: "local", selectedZone: "Asia/Seoul", dateInput: "", comparisonDate: "", targetDate: "", includeTarget: false },
  "markdown-tools": { tab: "preview", direction: "markdown-to-html", pretty: true, sanitize: true, preserveLineBreaks: false, openLinksNewTab: true, delimiter: "comma", customDelimiter: "", firstRowHeader: true, trimCells: true, escapePipe: true, quoteCsvValues: false, alignment: "default", minLevel: 1, maxLevel: 3, numbered: false, bullet: "-", includeTitle: true, removeTrailingSpaces: true, normalizeBlankLines: true, normalizeHeadings: true, normalizeListMarkers: true, tabsToSpaces: true, trimDocument: true, lineEndings: "lf", checklistMode: "unchecked", emptyLineMode: "keep", preserveBullet: false, checklistBullet: "-", includeUrls: false, keepCodeBlocks: true, removeImages: false, preserveListMarkers: false, tableMode: "plain" },
  "markdown-html-converter": { direction: "markdown-to-html", pretty: true, sanitize: true, preserveLineBreaks: false, openLinksNewTab: true },
  "csv-markdown-table-converter": { direction: "csv-to-markdown", delimiter: "comma", firstRowHeader: true, trimCells: true, escapePipe: true, quoteCsvValues: false, alignment: "default" },
  "markdown-table-generator": { tableDelimiter: "comma", trimCells: true, escapePipe: true, alignment: "default" },
  "community-post-helper": { platform: "forum", postType: "question", tone: "plain", structureMode: "summaryBodyConclusion", draftTitle: "", includeTagsInTitle: true, includeWarningsInBody: true, customTags: "", redactPrivacy: false, redactionMask: "stars", urlMode: "full", redactHashtags: false },
  "open-graph-preview": { title: "", description: "", url: "", image: "", siteName: "", type: "website", twitterCard: "summary_large_image" },
  "app-icon-generator": { selectedPresets: ["favicon", "ios", "androidPwa", "maskable"], fitMode: "cover", backgroundMode: "transparent", backgroundColor: "#ffffff", paddingPercent: 10, applyMaskableSafeArea: true, cornerRadiusMode: "none", appName: "", shortName: "", themeColor: "#111827", manifestBackgroundColor: "#ffffff", startUrl: "/", display: "standalone" },
  "android-asset-generator": { selectedGroups: ["legacy", "round", "adaptive", "notification", "splash", "playStore"], fitMode: "cover", maskMode: "none", backgroundMode: "transparent", backgroundColor: "#ffffff", paddingPercent: 8, adaptiveSafeArea: true, notificationMode: "monochrome", storeBackgroundMode: "average", storeFitMode: "contain", prefix: "" },
  "ios-asset-generator": { selectedGroups: ["appIcon", "launchLogo", "appStore", "brandLogo", "splashColor"], fitMode: "cover", backgroundMode: "color", backgroundColor: "#ffffff", paddingPercent: 0, launchLogoBaseSize: 200, launchBackgroundMode: "transparent", launchBackgroundColor: "#ffffff" },
  "image-editor": { operation: "resize", outputFormat: "png", width: 0, height: 0, rotate: 0, flip: "none", cropX: 0, cropY: 0, cropWidth: 0, cropHeight: 0, brightness: 0, contrast: 0, saturation: 0, quality: 92 },
  "screenshot-stitch-redact": { direction: "vertical", sizeMode: "first", customSize: 1080, gap: 12, outerPadding: 24, backgroundColor: "#ffffff", transparentBackground: false, outputFormat: "png", quality: 92, fileName: "stitched-redacted.png", redactions: [] },
  "pdf-tools": { mode: "merge", outputName: "", ranges: "1-3,4-6", interval: 1, outputNamePattern: "" },
  "gif-frame-editor": { outputFormat: "png", frameRange: "", fps: 12, loop: true },
  "audio-toolkit": { operation: "export", outputFormat: "wav", start: 0, duration: 1, volumeDb: 0, fadeDirection: "in", fadeSeconds: 1, speed: 1, channelMode: "stereo", loopCount: 2, silenceThresholdDb: -45, silenceMinDuration: 0.2 },
  "retro-sfx-generator": { waveform: "square", duration: 0.16, volume: 0.55, attack: 0.004, release: 0.055, startFrequency: 880, endFrequency: 520, noiseAmount: 0, bitDepth: 8, sampleRate: 44100, channels: "mono", pan: 0, seed: "retro" },
  "video-to-gif-webp": { outputFormat: "gif", width: 640, fps: 12, start: 0, duration: 10, preset: "default", quality: 75 },
};

export const tools: ToolDefinition[] = definitions.map(([id, category, keywords = []]) => {
  const inputFormats: InputFormat[] = inputFormatOverrides[id] ?? (fileIds.has(id) ? (imageIds.has(id) ? ["image", "binary"] : mediaIds.has(id) ? ["audio", "video", "binary"] : ["binary", "text"]) : ["text"]);
  const outputFormats: OutputFormat[] = outputFormatOverrides[id] ?? (imageIds.has(id) ? ["image", "download"] : ["text", "download"]);
  const capabilities: ToolCapability[] = fileIds.has(id) ? ["single", "multiple", "folder", "batch", ...(imageIds.has(id) ? ["clipboard" as const] : [])] : ["clipboard"];
  return {
    id,
    name: id.replaceAll("-", " ").replace(/\b\w/g, (value) => value.toUpperCase()),
    description: `Suwol Web Tools ${id.replaceAll("-", " ")} workflow.`,
    category,
    icon: imageIds.has(id) ? "image" : category === "hash-security" ? "shield" : category === "generator" ? "sparkles" : "wrench",
    keywords: [id, ...keywords],
    inputFormats,
    outputFormats,
    capabilities,
    defaultOptions: legacyDefaults[id] ?? {},
    webSupported: true,
    electronOnly: false,
    migrated: migratedIds.has(id),
    electronSupport: electronSupportOverrides[id] ?? (migratedIds.has(id) ? "full" : browserOnlyIds.has(id) ? "web-only" : "partial"),
    worker: migratedIds.has(id) && !externalApiIds.has(id),
    externalApi: externalApiIds.has(id),
    ...(unsupportedReasonFor(id, category) ? { unsupportedReason: unsupportedReasonFor(id, category) } : {}),
    popular: ["base64", "hash-generator", "json-formatter", "image-resizer", "webp-converter"].includes(id),
    hidden: ["csv-markdown-table-converter", "markdown-html-converter", "markdown-table-generator"].includes(id),
  } satisfies ToolDefinition;
});

const aliases: Record<string, string> = {
  "css-gradient-generator": "css-generator", "box-shadow-generator": "css-generator", "sitemap-xml-generator": "sitemap-generator",
  "url-parameter-parser": "url-parser", "unix-timestamp-converter": "date-time-tools", "utc-local-time-converter": "date-time-tools",
  "world-clock": "date-time-tools", "timezone-converter": "date-time-tools", "date-difference-calculator": "date-time-tools",
  "d-day-calculator": "date-time-tools", "dday-calculator": "date-time-tools", "markdown-html-converter": "markdown-tools",
  "csv-markdown-table-converter": "markdown-tools", "markdown-table-generator": "markdown-tools",
};

export function getToolById(id: string): ToolDefinition | undefined {
  return tools.find((tool) => tool.id === (aliases[id] ?? id));
}

export function getToolsByCategory(category: ToolCategory): ToolDefinition[] {
  return tools.filter((tool) => tool.category === category && !tool.hidden);
}

export function getStaticToolIds(): string[] {
  return [...tools.filter((tool) => !tool.hidden).map((tool) => tool.id), ...Object.keys(aliases)];
}

export function assertRegisteredTool(id: string): ToolDefinition {
  const tool = getToolById(id);
  if (!tool) throw new Error(`Unknown tool: ${id}`);
  return tool;
}
