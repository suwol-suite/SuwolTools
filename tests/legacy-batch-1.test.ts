import { describe, expect, it } from "vitest";
import {
  binaryToText,
  decodeBase64,
  decodeUrlComponent,
  encodeBase64,
  encodeUrlComponent,
  escapeHtml,
  escapeJsonString,
  escapeUnicode,
  hexToText,
  textToBinary,
  textToHex,
  unescapeHtml,
  unescapeJsonString,
  unescapeUnicode,
} from "@legacy/lib/encoding";
import { csvToJson, jsonToCsv } from "@legacy/lib/csvJson";
import { jsonToYaml, yamlToJsonValue } from "@legacy/lib/yamlJson";
import { generateJsonSchema } from "@legacy/lib/jsonSchemaGenerator";
import { generateTypeScriptFromJson } from "@legacy/lib/jsonToTypeScript";
import { runJsonPath, stringifyJsonPathResult } from "@legacy/lib/jsonPathTester";
import { convertTextCases } from "@legacy/lib/textCase";
import { sortAndDeduplicateLines } from "@legacy/lib/textSortDeduplicate";
import { formatRegexResults, runRegexTest } from "@legacy/lib/regexTester";
import { compareTexts, formatTextDiff } from "@legacy/lib/textDiff";
import { convertNumberBase } from "@legacy/lib/numberBaseConverter";
import { parseUrlInput } from "@legacy/lib/urlParser";
import { buildUtmUrl } from "@legacy/lib/utmUrlBuilder";
import { defaultPasswordOptions } from "@legacy/lib/passwordGenerator";
import { generateLoremIpsum } from "@legacy/lib/loremIpsum";
import { buildCronExpression, describeCronExpression } from "@legacy/lib/cronGenerator";
import { formatHsl, formatRgb, getContrastTextColor, parseHexColor, rgbToHex, rgbToHsl } from "@legacy/lib/colorConverter";
import { encodeHtmlEntities } from "@legacy/lib/htmlEntities";
import { parseUserAgent } from "@legacy/lib/userAgentParser";
import { generateRobotsTxt } from "@legacy/lib/robotsTxtGenerator";
import { generateSitemapXml } from "@legacy/lib/sitemapGenerator";
import { formatSql, minifySql } from "@legacy/lib/sqlFormatter";
import { minifyCode } from "@legacy/lib/codeFormatter";
import { decodeJwt } from "@legacy/lib/jwt";
import { formatHashOutput, hashBytes, hmacText } from "@legacy/lib/hash";
import { formatXml, minifyXml, validateXml } from "@legacy/lib/xmlFormatter";
import { beautifyCode } from "@legacy/lib/codeFormatter";
import { filterHttpStatusCodes } from "@legacy/lib/httpStatusCodes";
import { filterMimeTypes } from "@legacy/lib/mimeTypes";
import { convertUnitValue } from "@legacy/lib/unitConverter";
import { getCssTimingFunction } from "@legacy/lib/easingPreview";
import { buildCssOutput, buildGradientValue } from "@legacy/lib/cssGenerator";
import { createQrMatrix, qrMatrixToSvg } from "@legacy/lib/qrCode";
import { generateBarcodeSvg } from "@legacy/lib/barcode";
import { buildSeoMetaTags } from "@legacy/lib/metaTags";
import { DOMParser, XMLSerializer } from "@xmldom/xmldom";
import { getProcessor } from "@suwol/core";
import { getToolById } from "@suwol/shared";

const testGlobals = globalThis as typeof globalThis & { DOMParser?: typeof DOMParser; XMLSerializer?: typeof XMLSerializer };
testGlobals.DOMParser = class extends DOMParser {
  override parseFromString(source: string, mimeType: string) {
    const document = super.parseFromString(source, mimeType);
    const compatible = document as typeof document & { querySelector?: (selector: string) => Node | null };
    compatible.querySelector = (selector) => selector === "parsererror" ? document.getElementsByTagName("parsererror")[0] ?? null : null;
    return document;
  }
};
testGlobals.XMLSerializer = XMLSerializer;

async function run(toolId: string, input: string, options: Record<string, unknown> = {}): Promise<string> {
  const processor = getProcessor(toolId);
  const result = await processor({ handleId: "test", name: "input.txt", relativePath: "input.txt", size: input.length, read: async () => new TextEncoder().encode(input) }, options, { isCancelled: () => false });
  return new TextDecoder().decode(result[0]!.data);
}

describe("legacy batch 1 processors", () => {
  it("marks all first-batch tools as migrated", () => {
    for (const id of ["base64", "url-encode", "html-escape", "json-escape", "unicode-escape", "hex-converter", "binary-converter", "json-formatter", "csv-json-converter", "yaml-json-converter"]) {
      expect(getToolById(id)?.migrated).toBe(true);
    }
  });

  it("keeps encoding output identical to the original web functions", async () => {
    expect(await run("base64", "안녕", { operation: "encode" })).toBe(encodeBase64("안녕"));
    expect(await run("base64", "7JWI64WV", { operation: "decode" })).toBe(decodeBase64("7JWI64WV"));
    expect(await run("url-encode", "a b&c", { operation: "encode" })).toBe(encodeUrlComponent("a b&c"));
    expect(await run("url-encode", "a%20b%26c", { operation: "decode" })).toBe(decodeUrlComponent("a%20b%26c"));
    expect(await run("html-escape", "<a & \"x\">", { operation: "escape" })).toBe(escapeHtml("<a & \"x\">"));
    expect(await run("html-escape", "&lt;a&gt;", { operation: "unescape" })).toBe(unescapeHtml("&lt;a&gt;"));
    expect(await run("json-escape", "line\n\"quote\"", { operation: "escape" })).toBe(escapeJsonString("line\n\"quote\""));
    expect(await run("json-escape", "line\\n\\\"quote\\\"", { operation: "unescape" })).toBe(unescapeJsonString("line\\n\\\"quote\\\""));
    expect(await run("unicode-escape", "가A", { operation: "escape" })).toBe(escapeUnicode("가A"));
    expect(await run("unicode-escape", "\\uac00\\u0041", { operation: "unescape" })).toBe(unescapeUnicode("\\uac00\\u0041"));
    expect(await run("hex-converter", "가A", { operation: "text-to-hex" })).toBe(textToHex("가A"));
    expect(await run("hex-converter", "ea b0 80 41", { operation: "hex-to-text" })).toBe(hexToText("ea b0 80 41"));
    expect(await run("binary-converter", "가A", { operation: "text-to-binary" })).toBe(textToBinary("가A"));
    expect(await run("binary-converter", "11101010 10110000 10000000 01000001", { operation: "binary-to-text" })).toBe(binaryToText("11101010 10110000 10000000 01000001"));
  });

  it("keeps JSON, CSV, and YAML conversion output identical", async () => {
    const json = '{"name":"Suwol","count":2}';
    expect(await run("json-formatter", json, { operation: "pretty" })).toBe(JSON.stringify(JSON.parse(json), null, 2));
    expect(await run("json-formatter", json, { operation: "minify" })).toBe(JSON.stringify(JSON.parse(json), null, 0));
    expect(await run("json-formatter", json, { operation: "validate" })).toBe("Valid JSON.");
    const csv = "name,count\nSuwol,2";
    expect(await run("csv-json-converter", csv, { mode: "csvToJson", delimiter: ",", useHeader: true })).toBe(csvToJson(csv, ",", true));
    expect(await run("csv-json-converter", '[{"name":"Suwol","count":2}]', { mode: "jsonToCsv", delimiter: ",", useHeader: true })).toBe(jsonToCsv('[{"name":"Suwol","count":2}]', ",", true));
    const yaml = "name: Suwol\ncount: 2";
    expect(await run("yaml-json-converter", yaml, { mode: "yamlToJson" })).toBe(JSON.stringify(yamlToJsonValue(yaml), null, 2));
    expect(await run("yaml-json-converter", '{"name":"Suwol","count":2}', { mode: "jsonToYaml" })).toBe(jsonToYaml({ name: "Suwol", count: 2 }));
  });

  it("keeps the second pure-function batch identical", async () => {
    const json = '{"id":1,"name":"Suwol","tags":["web"]}';
    expect(await run("json-schema-generator", json)).toBe(generateJsonSchema(json, { title: "Root", includeRequired: true, allowNull: true }));
    expect(await run("json-to-typescript", json)).toBe(generateTypeScriptFromJson(json, { rootName: "Root", outputKind: "interface", optionalProperties: false, separateNestedTypes: true, nullAsOptional: true }));
    const pathExpression = "$.items[*].name";
    const pathJson = '{"items":[{"name":"one"},{"name":"two"}]}';
    expect(await run("jsonpath-tester", pathJson, { expression: pathExpression })).toBe(stringifyJsonPathResult(runJsonPath(pathJson, pathExpression)));
    const caseResults = convertTextCases("helloWorld").map((result) => `${result.label}: ${result.value}`).join("\n");
    expect(await run("text-case-converter", "helloWorld")).toBe(caseResults);
    const sortOptions = { direction: "asc" as const, deduplicate: true, removeEmpty: true, trimWhitespace: true, caseInsensitive: false };
    expect(await run("text-sort-deduplicate", " b\na\na\n", sortOptions)).toBe(sortAndDeduplicateLines(" b\na\na\n", sortOptions).text);
    const regexResult = runRegexTest("(Suwol)", "g", "Suwol Tools Suwol");
    expect(await run("regex-tester", "Suwol Tools Suwol", { pattern: "(Suwol)", flags: "g" })).toBe(formatRegexResults(regexResult));
    const diffResult = compareTexts("one\ntwo", "one\nthree", { ignoreWhitespace: false, ignoreCase: false });
    expect(await run("text-diff", "one\ntwo", { rightText: "one\nthree" })).toBe(formatTextDiff(diffResult));
    const baseResult = convertNumberBase("42", 10);
    expect(await run("number-base-converter", "42", { base: 10 })).toBe(JSON.stringify({ binary: baseResult.binary, octal: baseResult.octal, decimal: baseResult.decimal, hexadecimal: baseResult.hexadecimal }, null, 2));
    const parsedUrl = parseUrlInput("https://example.com/a?q=hello%20world", true);
    expect(await run("url-parser", "https://example.com/a?q=hello%20world")).toBe(JSON.stringify(parsedUrl, null, 2));
    const utm = { baseUrl: "https://example.com/page", source: "newsletter", medium: "email", campaign: "launch", term: "", content: "" };
    expect(await run("utm-url-builder", utm.baseUrl, utm)).toBe(buildUtmUrl(utm));
  });

  it("keeps the third local generator and formatter batch compatible", async () => {
    const passwordOptions = { ...defaultPasswordOptions, length: 18, count: 2 };
    const passwords = await run("password-generator", "", passwordOptions);
    expect(passwords.split("\n")).toHaveLength(2);
    expect(passwords.split("\n").every((value) => value.length === 18)).toBe(true);
    expect(await run("lorem-ipsum-generator", "", { type: "words", count: 6, startWithLorem: true, includeLineBreaks: false })).toBe(generateLoremIpsum({ type: "words", count: 6, startWithLorem: true, includeLineBreaks: false }));
    const cron = { minute: "0", hour: "9", dayOfMonth: "*", month: "*", dayOfWeek: "1-5" };
    expect(await run("cron-generator", "", cron)).toBe(`${buildCronExpression(cron)}\n${describeCronExpression(cron)}`);
    const color = parseHexColor("#3b82f6")!;
    expect(await run("color-converter", "#3b82f6", { mode: "hex" })).toBe(`${rgbToHex(color)}\n${formatRgb(color)}\n${formatHsl(rgbToHsl(color))}\ncontrast: ${getContrastTextColor(color)}`);
    expect(await run("html-entity-reference", "<Suwol & Tools>", { mode: "encode" })).toBe(encodeHtmlEntities("<Suwol & Tools>"));
    const ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36";
    expect(await run("user-agent-parser", ua)).toBe(JSON.stringify(parseUserAgent(ua), null, 2));
    const robots = { mode: "allowAll" as const, userAgent: "*", allowPaths: "/", disallowPaths: "", sitemapUrl: "", crawlDelay: "" };
    expect(await run("robots-txt-generator", "", robots)).toBe(generateRobotsTxt(robots));
    const sitemap = generateSitemapXml({ urlsText: "https://example.com", changefreq: "monthly", priority: "0.7", includeLastmod: false });
    expect(await run("sitemap-generator", "https://example.com", { changefreq: "monthly", priority: "0.7", includeLastmod: false })).toBe(sitemap.xml);
    const sql = "select * from users where id = 1";
    expect(await run("sql-formatter", sql, { mode: "format", dialect: "standard" })).toBe(formatSql(sql, "standard"));
    expect(await run("sql-formatter", sql, { mode: "minify", dialect: "standard" })).toBe(minifySql(sql));
    const code = "function hello() { // comment\n  return 1;\n}";
    expect(await run("code-minifier", code, { language: "javascript", removeComments: true, collapseWhitespace: true })).toBe(minifyCode(code, "javascript", { removeComments: true, collapseWhitespace: true }));
  });

  it("keeps the fourth security and format batch compatible", async () => {
    const jwt = "eyJhbGciOiJub25lIn0.eyJzdWIiOiJzdXcifQ.";
    const decodedJwt = decodeJwt(jwt);
    expect(await run("jwt-decoder", jwt)).toBe(`Header\n${decodedJwt.headerJson}\n\nPayload\n${decodedJwt.payloadJson}\n\nSignature\n${decodedJwt.signature}`);
    const hashInput = new TextEncoder().encode("hello");
    const sha = formatHashOutput(await hashBytes(hashInput, "sha256"), "hex-lower");
    expect(await run("hash-generator", "hello", { algorithms: ["sha256"], format: "hex-lower" })).toBe(`sha256: ${sha}`);
    expect(await run("hmac-generator", "hello", { algorithm: "HMAC-SHA256", secret: "secret" })).toBe(await hmacText("hello", "secret", "HMAC-SHA256"));
    const uuid = await run("uuid-generator", "", { version: "v4", count: 3, outputFormat: "lowercase", batchFormat: "plain" });
    expect(uuid.split("\n")).toHaveLength(3);
    expect(uuid.split("\n").every((value) => /^[0-9a-f-]{36}$/.test(value))).toBe(true);
    const xml = "<root><item>one</item></root>";
    expect(await run("xml-formatter", xml, { mode: "format" })).toBe(formatXml(xml));
    expect(await run("xml-formatter", xml, { mode: "minify" })).toBe(minifyXml(xml));
    validateXml(xml);
    expect(await run("code-beautifier", "function hello(){return 1;}", { language: "javascript", indent: "  " })).toBe(beautifyCode("function hello(){return 1;}", "javascript", "  "));
    expect(await run("http-status-codes", "not found", { query: "not found", statusClass: "all" })).toBe(JSON.stringify(filterHttpStatusCodes("not found", "all"), null, 2));
    expect(await run("mime-type-reference", "json", { query: "json", category: "all" })).toBe(JSON.stringify(filterMimeTypes("json", "all"), null, 2));
  });

  it("keeps the fifth local generator and reference batch compatible", async () => {
    const nameOptions = { countryId: "ko-KR", gender: "random" as const, fixedSurname: "", count: 3, unique: true, showRomanized: false };
    const generatedNames = await run("name-generator", "", nameOptions);
    expect(generatedNames.split("\n")).toHaveLength(3);
    expect(generatedNames.split("\n").every((value) => value.trim().length > 0)).toBe(true);
    expect(await run("unit-converter", "1000", { category: "length", fromUnit: "m", toUnit: "km", precision: 4 })).toBe(convertUnitValue("length", 1000, "m", "km", 4));
    expect(await run("easing-preview", "", { easingId: "ease-in-out" })).toBe(getCssTimingFunction("ease-in-out", { x1: 0.42, y1: 0, x2: 0.58, y2: 1 }));
    const gradientOptions = { type: "linear" as const, angle: 135, radialShape: "circle" as const, position: "center", repeating: false, stops: [{ color: "#7c5cff", position: 0 }, { color: "#14b8a6", position: 100 }] };
    const gradient = buildGradientValue(gradientOptions);
    expect(await run("css-generator", "", { type: "linear", angle: 135, startColor: "#7c5cff", endColor: "#14b8a6", className: "generated-style", repeating: false })).toBe(buildCssOutput({ className: "generated-style", declarations: [{ property: "background", value: gradient }], outputMode: "class" }));
    const qrOptions = { size: 512, margin: 4, foregroundColor: "#000000", backgroundColor: "#ffffff", errorCorrectionLevel: "M" as const, transparentBackground: false };
    expect(await run("qr-code-generator", "https://suwolsoft.com", qrOptions)).toBe(qrMatrixToSvg(createQrMatrix("https://suwolsoft.com", "M"), qrOptions));
    const barcodeOptions = { format: "CODE128" as const, width: 2, height: 100, margin: 10, displayValue: true, fontSize: 16, lineColor: "#000000", background: "#ffffff" };
    expect(await run("barcode-generator", "Suwol", barcodeOptions)).toBe(generateBarcodeSvg("Suwol", barcodeOptions).svg);
    const meta = { title: "Suwol", description: "Tools", keywords: "tools", canonicalUrl: "https://suwolsoft.com", robots: "index,follow", author: "Suwol" };
    expect(await run("seo-meta-generator", "", { mode: "seo", ...meta })).toBe(buildSeoMetaTags(meta));
  });

  it("keeps timestamp conversion in the shared queue contract", async () => {
    const result = await run("timestamp-converter", "0", { unit: "seconds" });
    expect(result).toContain("ISO: 1970-01-01T00:00:00.000Z");
    expect(result).toContain("Unix seconds: 0");
    expect(result).toContain("Unix milliseconds: 0");
  });
});
