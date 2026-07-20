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
import { csvToJson, jsonToCsv, type CsvDelimiter } from "@legacy/lib/csvJson";
import { yamlToJsonValue, jsonToYaml } from "@legacy/lib/yamlJson";
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
import { defaultPasswordOptions, generatePasswords } from "@legacy/lib/passwordGenerator";
import { generateLoremIpsum } from "@legacy/lib/loremIpsum";
import { buildCronExpression, describeCronExpression } from "@legacy/lib/cronGenerator";
import { formatHsl, formatRgb, getContrastTextColor, parseHexColor, parseHslColor, parseRgbColor, rgbToHex, rgbToHsl } from "@legacy/lib/colorConverter";
import { decodeHtmlEntities, encodeHtmlEntities } from "@legacy/lib/htmlEntities";
import { parseUserAgent } from "@legacy/lib/userAgentParser";
import { generateRobotsTxt } from "@legacy/lib/robotsTxtGenerator";
import { generateSitemapXml } from "@legacy/lib/sitemapGenerator";
import { formatSql, minifySql } from "@legacy/lib/sqlFormatter";
import { minifyCode } from "@legacy/lib/codeFormatter";
import { decodeJwt } from "@legacy/lib/jwt";
import { defaultSelectedHashAlgorithms, formatHashOutput, hashBytes, hmacText } from "@legacy/lib/hash";
import { generateManyUuids } from "@legacy/lib/uuid";
import { formatXml, minifyXml, validateXml } from "@legacy/lib/xmlFormatter";
import { beautifyCode } from "@legacy/lib/codeFormatter";
import { filterHttpStatusCodes } from "@legacy/lib/httpStatusCodes";
import { filterMimeTypes } from "@legacy/lib/mimeTypes";
import { generateNames, formatGeneratedNames } from "@legacy/lib/nameGenerator";
import { convertUnitValue } from "@legacy/lib/unitConverter";
import { getCssTimingFunction } from "@legacy/lib/easingPreview";
import { buildCssOutput, buildGradientValue } from "@legacy/lib/cssGenerator";
import { createQrMatrix, qrMatrixToSvg } from "@legacy/lib/qrCode";
import { generateBarcodeSvg } from "@legacy/lib/barcode";
import { buildSeoMetaTags, buildOpenGraphTags } from "@legacy/lib/metaTags";
import { parseBase64ImageInput } from "@legacy/lib/base64ImageConverter";
import type { ResolvedInput, ProcessedOutput, ToolProcessor } from "./types";

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function text(data: Uint8Array): string {
  return decoder.decode(data);
}

function output(input: ResolvedInput, value: string, extension = "txt", mimeType = "text/plain;charset=utf-8"): ProcessedOutput {
  const stem = input.name.replace(/\.[^/.]+$/, "");
  return { name: `${stem}.${extension}`, data: encoder.encode(value), mimeType };
}

function optionString(options: Record<string, unknown>, key: string, fallback: string): string {
  return typeof options[key] === "string" ? options[key] as string : fallback;
}

function transformProcessor(transform: (value: string, options: Record<string, unknown>) => string): ToolProcessor {
  return async (input, options) => [output(input, transform(text(await input.read()), options))];
}

const textTransformProcessors: Record<string, ToolProcessor> = {
  base64: transformProcessor((value, options) => optionString(options, "operation", "encode") === "decode" ? decodeBase64(value) : encodeBase64(value)),
  "url-encode": transformProcessor((value, options) => optionString(options, "operation", "encode") === "decode" ? decodeUrlComponent(value) : encodeUrlComponent(value)),
  "html-escape": transformProcessor((value, options) => optionString(options, "operation", "escape") === "unescape" ? unescapeHtml(value) : escapeHtml(value)),
  "json-escape": transformProcessor((value, options) => optionString(options, "operation", "escape") === "unescape" ? unescapeJsonString(value) : escapeJsonString(value)),
  "unicode-escape": transformProcessor((value, options) => optionString(options, "operation", "escape") === "unescape" ? unescapeUnicode(value) : escapeUnicode(value)),
  "hex-converter": transformProcessor((value, options) => optionString(options, "operation", "text-to-hex") === "hex-to-text" ? hexToText(value) : textToHex(value)),
  "binary-converter": transformProcessor((value, options) => optionString(options, "operation", "text-to-binary") === "binary-to-text" ? binaryToText(value) : textToBinary(value)),
};

const jsonFormatterProcessor: ToolProcessor = async (input, options) => {
  const value = text(await input.read());
  const parsed = (() => {
    try { return JSON.parse(value) as unknown; } catch { throw new Error("Invalid JSON."); }
  })();
  const operation = optionString(options, "operation", "pretty");
  if (operation === "validate") return [output(input, "Valid JSON.")];
  return [output(input, JSON.stringify(parsed, null, operation === "minify" ? 0 : 2))];
};

const csvJsonProcessor: ToolProcessor = async (input, options) => {
  const value = text(await input.read());
  const delimiter = (optionString(options, "delimiter", ",") === ";" || optionString(options, "delimiter", ",") === "\t" ? optionString(options, "delimiter", ",") : ",") as CsvDelimiter;
  const useHeader = options.useHeader !== false;
  const mode = optionString(options, "mode", "csvToJson");
  const result = mode === "jsonToCsv" ? jsonToCsv(value, delimiter, useHeader) : csvToJson(value, delimiter, useHeader);
  return [output(input, result, mode === "jsonToCsv" ? "csv" : "json", mode === "jsonToCsv" ? "text/csv;charset=utf-8" : "application/json;charset=utf-8")];
};

const yamlJsonProcessor: ToolProcessor = async (input, options) => {
  const value = text(await input.read());
  const mode = optionString(options, "mode", "yamlToJson");
  const result = mode === "jsonToYaml" ? jsonToYaml(JSON.parse(value)) : JSON.stringify(yamlToJsonValue(value), null, 2);
  return [output(input, result, mode === "jsonToYaml" ? "yaml" : "json", mode === "jsonToYaml" ? "text/yaml;charset=utf-8" : "application/json;charset=utf-8")];
};

const jsonSchemaProcessor: ToolProcessor = async (input, options) => {
  const value = text(await input.read());
  return [output(input, generateJsonSchema(value, { title: optionString(options, "title", "Root"), includeRequired: options.includeRequired !== false, allowNull: options.allowNull !== false }), "schema.json", "application/schema+json;charset=utf-8")];
};

const jsonToTypeScriptProcessor: ToolProcessor = async (input, options) => {
  const value = text(await input.read());
  return [output(input, generateTypeScriptFromJson(value, { rootName: optionString(options, "rootName", "Root"), outputKind: optionString(options, "outputKind", "interface") === "type" ? "type" : "interface", optionalProperties: options.optionalProperties === true, separateNestedTypes: options.separateNestedTypes !== false, nullAsOptional: options.nullAsOptional !== false }), "ts")];
};

const jsonPathProcessor: ToolProcessor = async (input, options) => {
  const value = text(await input.read());
  const expression = optionString(options, "expression", "$");
  return [output(input, stringifyJsonPathResult(runJsonPath(value, expression)), "json", "application/json;charset=utf-8")];
};

const textCaseProcessor: ToolProcessor = async (input) => {
  const results = convertTextCases(text(await input.read()));
  return [output(input, results.map((result) => `${result.label}: ${result.value}`).join("\n"))];
};

const textSortProcessor: ToolProcessor = async (input, options) => {
  const result = sortAndDeduplicateLines(text(await input.read()), {
    direction: optionString(options, "direction", "asc") === "desc" ? "desc" : optionString(options, "direction", "asc") === "none" ? "none" : "asc",
    deduplicate: options.deduplicate !== false,
    removeEmpty: options.removeEmpty !== false,
    trimWhitespace: options.trimWhitespace !== false,
    caseInsensitive: options.caseInsensitive === true,
  });
  return [output(input, result.text)];
};

const regexProcessor: ToolProcessor = async (input, options) => {
  const value = text(await input.read());
  return [output(input, formatRegexResults(runRegexTest(optionString(options, "pattern", ""), optionString(options, "flags", "g"), value)))];
};

const textDiffProcessor: ToolProcessor = async (input, options) => {
  const left = text(await input.read());
  const right = optionString(options, "rightText", "");
  return [output(input, formatTextDiff(compareTexts(left, right, { ignoreWhitespace: options.ignoreWhitespace === true, ignoreCase: options.ignoreCase === true })))];
};

const numberBaseProcessor: ToolProcessor = async (input, options) => {
  const selectedBase = Number(options.base);
  const base = (selectedBase === 2 || selectedBase === 8 || selectedBase === 16 ? selectedBase : 10) as 2 | 8 | 10 | 16;
  const value = convertNumberBase(text(await input.read()), base);
  return [output(input, JSON.stringify({ binary: value.binary, octal: value.octal, decimal: value.decimal, hexadecimal: value.hexadecimal }, null, 2), "json", "application/json;charset=utf-8")];
};

const urlParserProcessor: ToolProcessor = async (input, options) => {
  const value = parseUrlInput(text(await input.read()), options.decodeValues !== false);
  return [output(input, JSON.stringify(value, null, 2), "json", "application/json;charset=utf-8")];
};

const utmProcessor: ToolProcessor = async (input, options) => {
  const baseUrl = optionString(options, "baseUrl", text(await input.read()));
  const value = buildUtmUrl({ baseUrl, source: optionString(options, "source", ""), medium: optionString(options, "medium", ""), campaign: optionString(options, "campaign", ""), term: optionString(options, "term", ""), content: optionString(options, "content", "") });
  return [output(input, value, "url.txt")];
};

const passwordProcessor: ToolProcessor = async (input, options) => {
  const values = generatePasswords({ ...defaultPasswordOptions, ...options, length: Number(options.length ?? defaultPasswordOptions.length), count: Number(options.count ?? defaultPasswordOptions.count) });
  return [output(input, values.join("\n"), "txt")];
};

const loremProcessor: ToolProcessor = async (input, options) => {
  const type = optionString(options, "type", "words");
  const value = generateLoremIpsum({ type: type === "sentences" || type === "paragraphs" ? type : "words", count: Number(options.count ?? 3), startWithLorem: options.startWithLorem !== false, includeLineBreaks: options.includeLineBreaks !== false });
  return [output(input, value)];
};

const cronProcessor: ToolProcessor = async (input, options) => {
  const fields = { minute: optionString(options, "minute", "*"), hour: optionString(options, "hour", "*"), dayOfMonth: optionString(options, "dayOfMonth", "*"), month: optionString(options, "month", "*"), dayOfWeek: optionString(options, "dayOfWeek", "*") };
  return [output(input, `${buildCronExpression(fields)}\n${describeCronExpression(fields)}`)];
};

const colorProcessor: ToolProcessor = async (input, options) => {
  const value = text(await input.read());
  const mode = optionString(options, "mode", "hex");
  const color = mode === "rgb" ? parseRgbColor(value) : mode === "hsl" ? parseHslColor(value) : parseHexColor(value);
  if (!color) throw new Error("Invalid color input.");
  const hsl = rgbToHsl(color);
  return [output(input, `${rgbToHex(color)}\n${formatRgb(color)}\n${formatHsl(hsl)}\ncontrast: ${getContrastTextColor(color)}`)];
};

const htmlEntityProcessor: ToolProcessor = async (input, options) => {
  const value = text(await input.read());
  return [output(input, optionString(options, "mode", "encode") === "decode" ? decodeHtmlEntities(value) : encodeHtmlEntities(value))];
};

const userAgentProcessor: ToolProcessor = async (input, options) => {
  const value = optionString(options, "userAgent", text(await input.read()));
  return [output(input, JSON.stringify(parseUserAgent(value), null, 2), "json", "application/json;charset=utf-8")];
};

const robotsProcessor: ToolProcessor = async (input, options) => {
  const selectedMode = optionString(options, "mode", "allowAll");
  const mode = (selectedMode === "blockAll" || selectedMode === "custom" ? selectedMode : "allowAll") as "allowAll" | "blockAll" | "custom";
  return [output(input, generateRobotsTxt({ mode, userAgent: optionString(options, "userAgent", "*"), allowPaths: optionString(options, "allowPaths", "/"), disallowPaths: optionString(options, "disallowPaths", ""), sitemapUrl: optionString(options, "sitemapUrl", ""), crawlDelay: optionString(options, "crawlDelay", "") }), "robots.txt")];
};

const sitemapProcessor: ToolProcessor = async (input, options) => {
  const result = generateSitemapXml({ urlsText: text(await input.read()), changefreq: optionString(options, "changefreq", "monthly") as "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never", priority: optionString(options, "priority", "0.7"), includeLastmod: options.includeLastmod === true });
  return [output(input, result.xml, "xml", "application/xml;charset=utf-8")];
};

const sqlProcessor: ToolProcessor = async (input, options) => {
  const value = text(await input.read());
  const mode = optionString(options, "mode", "format");
  const dialect = optionString(options, "dialect", "standard") as "standard" | "mysql" | "postgresql" | "sqlite" | "mariadb";
  return [output(input, mode === "minify" ? minifySql(value) : formatSql(value, dialect))];
};

const codeMinifierProcessor: ToolProcessor = async (input, options) => {
  const value = text(await input.read());
  const language = optionString(options, "language", "javascript") as "html" | "css" | "javascript";
  return [output(input, minifyCode(value, language, { removeComments: options.removeComments !== false, collapseWhitespace: options.collapseWhitespace !== false }))];
};

const jwtProcessor: ToolProcessor = async (input) => {
  const decoded = decodeJwt(text(await input.read()));
  return [output(input, `Header\n${decoded.headerJson}\n\nPayload\n${decoded.payloadJson}\n\nSignature\n${decoded.signature}`)];
};

const hashProcessor: ToolProcessor = async (input, options) => {
  const selected = Array.isArray(options.algorithms) ? options.algorithms.filter((value): value is string => typeof value === "string") : defaultSelectedHashAlgorithms;
  const format = optionString(options, "format", "hex-lower") as "hex-lower" | "hex-upper" | "base64";
  const data = await input.read();
  const rows: string[] = [];
  for (const algorithm of selected) rows.push(`${algorithm}: ${formatHashOutput(await hashBytes(data, algorithm as Parameters<typeof hashBytes>[1]), format)}`);
  return [output(input, rows.join("\n"))];
};

const hmacProcessor: ToolProcessor = async (input, options) => {
  const algorithm = optionString(options, "algorithm", "HMAC-SHA256") as "HMAC-SHA1" | "HMAC-SHA256" | "HMAC-SHA384" | "HMAC-SHA512";
  return [output(input, await hmacText(text(await input.read()), optionString(options, "secret", ""), algorithm))];
};

const uuidProcessor: ToolProcessor = async (input, options) => {
  const count = Math.max(1, Math.min(1000, Math.round(Number(options.count ?? 10))));
  const values = await generateManyUuids({ version: optionString(options, "version", "v4") as "v1" | "v3" | "v4" | "v5" | "v6" | "v7", namespace: optionString(options, "namespace", ""), name: optionString(options, "name", ""), outputFormat: optionString(options, "outputFormat", "lowercase") as "lowercase" | "uppercase" | "braces" | "urn" | "compact" }, count);
  const format = optionString(options, "batchFormat", "plain");
  const value = format === "json" ? JSON.stringify(values, null, 2) : format === "csv" ? ["uuid", ...values].join("\n") : values.join("\n");
  return [output(input, value, format === "json" ? "json" : format === "csv" ? "csv" : "txt", format === "json" ? "application/json;charset=utf-8" : format === "csv" ? "text/csv;charset=utf-8" : "text/plain;charset=utf-8")];
};

const xmlProcessor: ToolProcessor = async (input, options) => {
  const value = text(await input.read());
  const mode = optionString(options, "mode", "format");
  if (mode === "validate") { validateXml(value); return [output(input, "Valid XML.")]; }
  return [output(input, mode === "minify" ? minifyXml(value) : formatXml(value), "xml", "application/xml;charset=utf-8")];
};

const codeBeautifierProcessor: ToolProcessor = async (input, options) => {
  const language = optionString(options, "language", "javascript") as "html" | "css" | "javascript";
  return [output(input, beautifyCode(text(await input.read()), language, optionString(options, "indent", "  ")))];
};

const httpStatusProcessor: ToolProcessor = async (input, options) => {
  const query = optionString(options, "query", text(await input.read()));
  return [output(input, JSON.stringify(filterHttpStatusCodes(query, optionString(options, "statusClass", "all")), null, 2), "json", "application/json;charset=utf-8")];
};

const mimeReferenceProcessor: ToolProcessor = async (input, options) => {
  const query = optionString(options, "query", text(await input.read()));
  return [output(input, JSON.stringify(filterMimeTypes(query, optionString(options, "category", "all")), null, 2), "json", "application/json;charset=utf-8")];
};

const nameProcessor: ToolProcessor = async (input, options) => {
  const results = generateNames({ countryId: optionString(options, "countryId", "ko-KR"), gender: optionString(options, "gender", "random") as "male" | "female" | "neutral" | "random", fixedSurname: optionString(options, "fixedSurname", ""), count: Math.max(1, Math.min(100, Number(options.count ?? 10))), unique: options.unique !== false, showRomanized: options.showRomanized === true });
  const format = optionString(options, "outputFormat", "text") as "text" | "csv" | "json";
  return [output(input, formatGeneratedNames(results, format, optionString(options, "displayMode", "full") as "full" | "surname" | "given" | "full-with-romanized"), format === "json" ? "json" : format === "csv" ? "csv" : "txt", format === "json" ? "application/json;charset=utf-8" : format === "csv" ? "text/csv;charset=utf-8" : "text/plain;charset=utf-8")];
};

const unitProcessor: ToolProcessor = async (input, options) => {
  const category = optionString(options, "category", "length") as Parameters<typeof convertUnitValue>[0];
  const value = Number(text(await input.read()));
  const result = convertUnitValue(category, value, optionString(options, "fromUnit", "m"), optionString(options, "toUnit", "km"), Number(options.precision ?? 4), { cssBaseFontSize: Number(options.cssBaseFontSize ?? 16) });
  return [output(input, result)];
};

const easingProcessor: ToolProcessor = async (input, options) => {
  return [output(input, getCssTimingFunction(optionString(options, "easingId", "ease-in-out"), { x1: 0.42, y1: 0, x2: 0.58, y2: 1 }))];
};

const cssProcessor: ToolProcessor = async (input, options) => {
  const type = optionString(options, "type", "linear") as "linear" | "radial" | "conic";
  const value = buildGradientValue({ type, angle: Number(options.angle ?? 135), radialShape: "circle", position: "center", repeating: options.repeating === true, stops: [{ color: optionString(options, "startColor", "#7c5cff"), position: 0 }, { color: optionString(options, "endColor", "#14b8a6"), position: 100 }] });
  return [output(input, buildCssOutput({ className: optionString(options, "className", "generated-style"), declarations: [{ property: "background", value }], outputMode: "class" }), "css")];
};

const qrProcessor: ToolProcessor = async (input, options) => {
  const value = text(await input.read()).trim();
  const matrix = createQrMatrix(value, optionString(options, "errorCorrectionLevel", "M") as "L" | "M" | "Q" | "H");
  return [output(input, qrMatrixToSvg(matrix, { size: Number(options.size ?? 512), margin: Number(options.margin ?? 4), foregroundColor: optionString(options, "foregroundColor", "#000000"), backgroundColor: optionString(options, "backgroundColor", "#ffffff"), errorCorrectionLevel: optionString(options, "errorCorrectionLevel", "M") as "L" | "M" | "Q" | "H", transparentBackground: options.transparentBackground === true }), "svg", "image/svg+xml")];
};

const barcodeProcessor: ToolProcessor = async (input, options) => {
  const result = generateBarcodeSvg(text(await input.read()).trim(), { format: optionString(options, "format", "CODE128") as "CODE128" | "CODE39" | "EAN13" | "EAN8" | "UPC" | "ITF14" | "MSI" | "pharmacode", width: Number(options.width ?? 2), height: Number(options.height ?? 100), margin: Number(options.margin ?? 10), displayValue: options.displayValue !== false, fontSize: Number(options.fontSize ?? 16), lineColor: optionString(options, "lineColor", "#000000"), background: optionString(options, "background", "#ffffff") });
  return [output(input, result.svg, "svg", "image/svg+xml")];
};

const seoMetaProcessor: ToolProcessor = async (input, options) => {
  const mode = optionString(options, "mode", "seo");
  const result = mode === "og" ? buildOpenGraphTags({ title: optionString(options, "title", ""), description: optionString(options, "description", ""), url: optionString(options, "url", ""), image: optionString(options, "image", ""), siteName: optionString(options, "siteName", ""), type: optionString(options, "type", "website"), twitterCard: optionString(options, "twitterCard", "summary_large_image") }) : buildSeoMetaTags({ title: optionString(options, "title", ""), description: optionString(options, "description", ""), keywords: optionString(options, "keywords", ""), canonicalUrl: optionString(options, "canonicalUrl", ""), robots: optionString(options, "robots", "index,follow"), author: optionString(options, "author", "") });
  return [output(input, result, "html", "text/html;charset=utf-8")];
};

const openGraphProcessor: ToolProcessor = async (input, options) => {
  const value = text(await input.read());
  const result = buildOpenGraphTags({
    title: optionString(options, "title", value),
    description: optionString(options, "description", ""),
    url: optionString(options, "url", ""),
    image: optionString(options, "image", ""),
    siteName: optionString(options, "siteName", ""),
    type: optionString(options, "type", "website"),
    twitterCard: optionString(options, "twitterCard", "summary_large_image"),
  });
  return [output(input, result, "html", "text/html;charset=utf-8")];
};

const base64ImageProcessor: ToolProcessor = async (input, options) => {
  const data = await input.read();
  const mimeType = input.mimeType?.startsWith("image/") ? input.mimeType : optionString(options, "fallbackMimeType", "image/png");
  let binary = "";
  if (input.mimeType?.startsWith("image/")) for (const byte of data) binary += String.fromCharCode(byte);
  const value = input.mimeType?.startsWith("image/") ? `data:${mimeType};base64,${btoa(binary)}` : text(data);
  const parsed = parseBase64ImageInput(value, mimeType);
  return [output(input, parsed.dataUrl, "txt")];
};

const timestampProcessor: ToolProcessor = async (input, options) => {
  const raw = text(await input.read()).trim();
  const value = Number(raw);
  if (!Number.isFinite(value)) throw new Error("Timestamp must be a number.");
  const unit = optionString(options, "unit", "auto");
  const milliseconds = (unit === "milliseconds" || (unit === "auto" && raw.replace(/^-/, "").length >= 13)) ? value : value * 1000;
  const date = new Date(milliseconds);
  if (Number.isNaN(date.getTime())) throw new Error("Timestamp is outside the supported date range.");
  return [output(input, `Local time: ${date.toLocaleString()}\nUTC time: ${date.toISOString()}\nISO: ${date.toISOString()}\nRFC2822: ${date.toUTCString()}\nUnix seconds: ${Math.floor(date.getTime() / 1000)}\nUnix milliseconds: ${date.getTime()}`)];
};

const additionalLegacyProcessors: Record<string, ToolProcessor> = {
  "json-schema-generator": jsonSchemaProcessor,
  "json-to-typescript": jsonToTypeScriptProcessor,
  "jsonpath-tester": jsonPathProcessor,
  "text-case-converter": textCaseProcessor,
  "text-sort-deduplicate": textSortProcessor,
  "regex-tester": regexProcessor,
  "text-diff": textDiffProcessor,
  "number-base-converter": numberBaseProcessor,
  "url-parser": urlParserProcessor,
  "utm-url-builder": utmProcessor,
  "password-generator": passwordProcessor,
  "lorem-ipsum-generator": loremProcessor,
  "cron-generator": cronProcessor,
  "color-converter": colorProcessor,
  "html-entity-reference": htmlEntityProcessor,
  "user-agent-parser": userAgentProcessor,
  "robots-txt-generator": robotsProcessor,
  "sitemap-generator": sitemapProcessor,
  "sql-formatter": sqlProcessor,
  "code-minifier": codeMinifierProcessor,
  "jwt-decoder": jwtProcessor,
  "hash-generator": hashProcessor,
  "hmac-generator": hmacProcessor,
  "uuid-generator": uuidProcessor,
  "xml-formatter": xmlProcessor,
  "code-beautifier": codeBeautifierProcessor,
  "http-status-codes": httpStatusProcessor,
  "mime-type-reference": mimeReferenceProcessor,
  "name-generator": nameProcessor,
  "unit-converter": unitProcessor,
  "easing-preview": easingProcessor,
  "css-generator": cssProcessor,
  "qr-code-generator": qrProcessor,
  "barcode-generator": barcodeProcessor,
  "seo-meta-generator": seoMetaProcessor,
  "open-graph-preview": openGraphProcessor,
  "base64-image-converter": base64ImageProcessor,
  "timestamp-converter": timestampProcessor,
};

export function getLegacyProcessor(toolId: string): ToolProcessor | undefined {
  return textTransformProcessors[toolId] ?? additionalLegacyProcessors[toolId] ?? ({
    "json-formatter": jsonFormatterProcessor,
    "csv-json-converter": csvJsonProcessor,
    "yaml-json-converter": yamlJsonProcessor,
  } satisfies Record<string, ToolProcessor>)[toolId];
}
