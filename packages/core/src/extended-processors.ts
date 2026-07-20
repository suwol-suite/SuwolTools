import {
  buildMarkdownTable,
  cleanMarkdown,
  convertChecklist,
  csvToMarkdownTable,
  generateMarkdownToc,
  htmlToMarkdown,
  markdownTableToCsv,
  markdownToHtml,
  markdownToPlainText,
  parseDelimitedRows,
  sanitizeHtml,
  type ChecklistEmptyLineMode,
  type ChecklistMode,
  type MarkdownAlignment,
  type MarkdownDelimiter,
  type PlainTextTableMode,
} from "@legacy/lib/markdownTools";
import type { ProcessedOutput, ResolvedInput, ToolProcessor } from "./types";

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function text(data: Uint8Array): string { return decoder.decode(data); }
function stem(name: string): string { return name.replace(/\.[^/.]+$/, ""); }
function output(input: ResolvedInput, value: string, extension: string, mimeType = "text/plain;charset=utf-8"): ProcessedOutput {
  return { name: `${stem(input.name)}.${extension}`, data: encoder.encode(value), mimeType };
}
function stringOption(options: Record<string, unknown>, key: string, fallback: string): string { return typeof options[key] === "string" ? options[key] as string : fallback; }
function boolOption(options: Record<string, unknown>, key: string, fallback: boolean): boolean { return typeof options[key] === "boolean" ? options[key] as boolean : fallback; }
function numberOption(options: Record<string, unknown>, key: string, fallback: number): number { return typeof options[key] === "number" && Number.isFinite(options[key]) ? options[key] as number : fallback; }

const delimiter = (value: string): MarkdownDelimiter => ["comma", "semicolon", "tab", "pipe", "custom"].includes(value) ? value as MarkdownDelimiter : "comma";
const alignment = (value: string): MarkdownAlignment => ["default", "left", "center", "right"].includes(value) ? value as MarkdownAlignment : "default";

function markdownProcessor(toolId: string): ToolProcessor {
  return async (input, options) => {
    const value = text(await input.read());
    const tab = stringOption(options, "tab", toolId === "markdown-html-converter" ? "html" : toolId === "csv-markdown-table-converter" ? "csv-table" : toolId === "markdown-table-generator" ? "table-generator" : "preview");
    const htmlOptions = { pretty: boolOption(options, "pretty", true), sanitize: boolOption(options, "sanitize", true), preserveLineBreaks: boolOption(options, "preserveLineBreaks", false), openLinksNewTab: boolOption(options, "openLinksNewTab", true) };
    if (toolId === "markdown-html-converter" || tab === "html") {
      const direction = stringOption(options, "direction", "markdown-to-html");
      if (direction === "html-to-markdown") return [output(input, htmlToMarkdown(value), "md", "text/markdown;charset=utf-8")];
      const html = markdownToHtml(value, htmlOptions);
      return [output(input, htmlOptions.sanitize ? sanitizeHtml(html) : html, "html", "text/html;charset=utf-8")];
    }
    if (toolId === "csv-markdown-table-converter" || tab === "csv-table") {
      const direction = stringOption(options, "direction", "csv-to-markdown");
      const csvOptions = { delimiter: delimiter(stringOption(options, "delimiter", "comma")), customDelimiter: stringOption(options, "customDelimiter", ""), firstRowHeader: boolOption(options, "firstRowHeader", true), trimCells: boolOption(options, "trimCells", true), escapePipe: boolOption(options, "escapePipe", true), quoteCsvValues: boolOption(options, "quoteCsvValues", false), alignment: alignment(stringOption(options, "alignment", "default")) };
      return direction === "markdown-to-csv" ? [output(input, markdownTableToCsv(value, csvOptions), "csv", "text/csv;charset=utf-8")] : [output(input, csvToMarkdownTable(value, csvOptions), "md", "text/markdown;charset=utf-8")];
    }
    if (toolId === "markdown-table-generator" || tab === "table-generator") {
      const delimiterValue = stringOption(options, "tableDelimiter", "comma");
      const delimiterChar = delimiterValue === "tab" ? "\t" : delimiterValue === "semicolon" ? ";" : delimiterValue === "pipe" ? "|" : ",";
      const rows = parseDelimitedRows(value, delimiterChar, boolOption(options, "trimCells", true)).filter((row) => row.some(Boolean));
      const headers = rows.shift() ?? [];
      return [output(input, buildMarkdownTable(headers, rows, headers.map(() => alignment(stringOption(options, "alignment", "default"))), boolOption(options, "escapePipe", true)), "md", "text/markdown;charset=utf-8")];
    }
    if (tab === "toc") return [output(input, generateMarkdownToc(value, { minLevel: numberOption(options, "minLevel", 1), maxLevel: numberOption(options, "maxLevel", 3), numbered: boolOption(options, "numbered", false), bullet: stringOption(options, "bullet", "-") === "*" ? "*" : "-", includeTitle: boolOption(options, "includeTitle", true) }), "md", "text/markdown;charset=utf-8")];
    if (tab === "cleaner") return [output(input, cleanMarkdown(value, { removeTrailingSpaces: boolOption(options, "removeTrailingSpaces", true), normalizeBlankLines: boolOption(options, "normalizeBlankLines", true), normalizeHeadings: boolOption(options, "normalizeHeadings", true), normalizeListMarkers: boolOption(options, "normalizeListMarkers", true), tabsToSpaces: boolOption(options, "tabsToSpaces", true), trimDocument: boolOption(options, "trimDocument", true), lineEndings: stringOption(options, "lineEndings", "lf") === "crlf" ? "crlf" : "lf" }).text, "md", "text/markdown;charset=utf-8")];
    if (tab === "checklist") return [output(input, convertChecklist(value, (stringOption(options, "checklistMode", "unchecked") as ChecklistMode), (stringOption(options, "emptyLineMode", "keep") as ChecklistEmptyLineMode), boolOption(options, "preserveBullet", false), stringOption(options, "checklistBullet", "-") === "*" ? "*" : "-"), "md", "text/markdown;charset=utf-8")];
    if (tab === "plain-text") return [output(input, markdownToPlainText(value, { includeUrls: boolOption(options, "includeUrls", false), keepCodeBlocks: boolOption(options, "keepCodeBlocks", true), removeImages: boolOption(options, "removeImages", false), preserveListMarkers: boolOption(options, "preserveListMarkers", false), tableMode: (stringOption(options, "tableMode", "plain") as PlainTextTableMode) }), "txt")];
    return [output(input, markdownToHtml(value, htmlOptions), "html", "text/html;charset=utf-8")];
  };
}

const platformLabels: Record<string, string> = { forum: "포럼", ruliweb: "루리웹", reddit: "Reddit", x: "X", facebook: "Facebook", discord: "Discord", blog: "블로그", todayHumor: "오늘의유머", dcinside: "디시인사이드", other: "커뮤니티" };
const postTypeLabels: Record<string, string> = { question: "질문", review: "후기", info: "정보", tipGuide: "팁", bugReport: "버그 제보", discussion: "토론", free: "자유", help: "도움 요청", releaseNotes: "릴리즈 노트", imageShowcase: "이미지 공유" };
const structureSections: Record<string, string[]> = { summaryBodyConclusion: ["요약", "본문", "결론"], situationProblemQuestion: ["상황", "문제", "질문"], prosConsConclusion: ["장점", "단점", "결론"], timeline: ["타임라인", "현재 상태", "질문/의견"], checklist: ["체크리스트", "메모", "질문/의견"], faq: ["FAQ", "답변", "메모"], releaseNotes: ["변경 사항", "수정", "알려진 문제"], bugReport: ["문제", "재현 절차", "예상 결과", "실제 결과", "환경"], purchaseReview: ["대상", "구매 이유", "장점", "단점", "결론"], imageFocused: ["이미지 설명", "추가 설명", "질문/의견"] };
function normalizeParagraphs(value: string): string { return value.replace(/\r\n/g, "\n").split("\n").map((line) => line.trimEnd()).join("\n").replace(/\n{3,}/g, "\n\n").trim(); }
function redactCommunity(value: string, options: Record<string, unknown>): string {
  const maskKey = stringOption(options, "redactionMask", "stars");
  const mask = maskKey === "redacted" ? "[redacted]" : maskKey === "hidden" ? "[hidden]" : maskKey === "blocks" ? "■■■" : "***";
  let result = value;
  const patterns: Array<[RegExp, string]> = [[/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, mask], [/(?:https?:\/\/|www\.)[^\s<>"']+/gi, stringOption(options, "urlMode", "full") === "domain" ? "$domain" : mask], [/\b(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)\b/g, mask], [/(?:\+\d{1,3}[-.\s]?)?(?:\(?\d{1,4}\)?[-.\s]?)?\d{2,4}[-.\s]?\d{3,4}[-.\s]?\d{4}\b/g, mask], [/\b\d{6}[-\s]?[1-4]\d{6}\b/g, mask]];
  for (const [pattern, replacement] of patterns) result = result.replace(pattern, (match) => replacement === "$domain" ? (() => { try { return new URL(match.startsWith("http") ? match : `https://${match}`).hostname; } catch { return mask; } })() : replacement);
  if (boolOption(options, "redactHashtags", false)) result = result.replace(/#[\p{L}\p{N}_-]{2,40}/gu, mask);
  return result;
}
function communityProcessor(): ToolProcessor {
  return async (input, options) => {
    const source = text(await input.read());
    const title = stringOption(options, "draftTitle", "");
    const body = normalizeParagraphs(boolOption(options, "redactPrivacy", false) ? redactCommunity(source, options) : source);
    const platform = stringOption(options, "platform", "forum");
    const postType = stringOption(options, "postType", "question");
    const tags = stringOption(options, "customTags", "").split(/[,，\n]/).map((item) => item.trim()).filter(Boolean);
    const warningLine = tags.join(" ");
    const sections = structureSections[stringOption(options, "structureMode", "summaryBodyConclusion")] ?? ["요약", "본문", "결론"];
    const structured = stringOption(options, "structureMode", "summaryBodyConclusion") === "keep" ? body : sections.map((section, index) => `## ${section}\n${index === 1 ? body : "- "}`).join("\n\n");
    const finalTitle = title.trim() || `${postTypeLabels[postType] ?? "게시글"} - ${platformLabels[platform] ?? "커뮤니티"}`;
    const outputBody = `${boolOption(options, "includeWarningsInBody", true) && warningLine ? `${warningLine}\n\n` : ""}${structured}`.trim();
    const value = `${boolOption(options, "includeTagsInTitle", true) && warningLine ? `${warningLine} ` : ""}${finalTitle}\n\n${outputBody}`.trim();
    return [output(input, value, "md", "text/markdown;charset=utf-8")];
  };
}

const DAY_MS = 86_400_000;
function dateTimeParts(date: Date, timeZone: string): { year: number; month: number; day: number; hour: number; minute: number; second: number } {
  const formatter = new Intl.DateTimeFormat("en-US", { timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
  const values = Object.fromEntries(formatter.formatToParts(date).map((part) => [part.type, part.value]));
  return { year: Number(values.year), month: Number(values.month), day: Number(values.day), hour: Number(values.hour) === 24 ? 0 : Number(values.hour), minute: Number(values.minute), second: Number(values.second) };
}
function zoneOffset(date: Date, timeZone: string): string {
  const parts = dateTimeParts(date, timeZone);
  const zoneUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
  const minutes = Math.round((zoneUtc - date.getTime()) / 60_000);
  const sign = minutes >= 0 ? "+" : "-";
  const absolute = Math.abs(minutes);
  return `UTC${sign}${String(Math.floor(absolute / 60)).padStart(2, "0")}:${String(absolute % 60).padStart(2, "0")}`;
}
function parseDateInZone(value: string, mode: string, selectedZone: string): Date {
  const trimmed = value.trim();
  if (!trimmed) throw new Error("Date input is invalid.");
  if (/(?:Z|[+-]\d{2}:?\d{2})$/i.test(trimmed)) { const date = new Date(trimmed); if (Number.isNaN(date.getTime())) throw new Error("Date input is invalid."); return date; }
  if (mode === "utc") { const date = new Date(`${trimmed}${/:\d{2}:\d{2}$/.test(trimmed) ? "Z" : ":00Z"}`); if (Number.isNaN(date.getTime())) throw new Error("Date input is invalid."); return date; }
  if (mode === "selected") {
    const match = /^(\d{4})-(\d{2})-(\d{2})(?:T|\s)(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(trimmed);
    if (!match) throw new Error("Date input is invalid.");
    const guess = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), Number(match[4]), Number(match[5]), Number(match[6] ?? 0));
    const first = dateTimeParts(new Date(guess), selectedZone);
    const offsetGuess = Date.UTC(first.year, first.month - 1, first.day, first.hour, first.minute, first.second) - guess;
    const date = new Date(guess - offsetGuess);
    if (Number.isNaN(date.getTime())) throw new Error("Date input is invalid.");
    return date;
  }
  const date = new Date(trimmed); if (Number.isNaN(date.getTime())) throw new Error("Date input is invalid."); return date;
}
function dateRows(date: Date, timeZone: string): string {
  return JSON.stringify({ localTime: date.toLocaleString("en-US"), utcTime: date.toISOString(), iso: date.toISOString(), rfc2822: date.toUTCString(), unixSeconds: Math.floor(date.getTime() / 1000), unixMilliseconds: date.getTime(), timeZone, timeZoneOffset: zoneOffset(date, timeZone) }, null, 2);
}
function dateTimeProcessor(): ToolProcessor {
  return async (input, options) => {
    const value = text(await input.read()).trim();
    const tab = stringOption(options, "tab", "timestamp");
    const zone = stringOption(options, "selectedZone", "Asia/Seoul");
    if (tab === "timestamp") {
      const raw = value || stringOption(options, "timestampValue", "");
      const numeric = Number(raw);
      if (!Number.isFinite(numeric)) throw new Error("Timestamp must be a number.");
      const unit = stringOption(options, "timestampUnit", "auto");
      const milliseconds = (unit === "seconds" || (unit === "auto" && raw.replace(/^-/, "").length < 13)) ? numeric * 1000 : numeric;
      const date = new Date(milliseconds); if (Number.isNaN(date.getTime())) throw new Error("Timestamp is outside the supported date range.");
      return [output(input, dateRows(date, zone), "json", "application/json;charset=utf-8")];
    }
    if (tab === "utc" || tab === "timezone") {
      const date = parseDateInZone(value || stringOption(options, "dateInput", ""), stringOption(options, "zoneMode", "local"), zone);
      return [output(input, dateRows(date, stringOption(options, "outputZone", "UTC")), "json", "application/json;charset=utf-8")];
    }
    if (tab === "world-clock") {
      const date = value ? new Date(value) : new Date(); if (Number.isNaN(date.getTime())) throw new Error("Date input is invalid.");
      const zones = (Array.isArray(options.worldClockZones) ? options.worldClockZones : ["Asia/Seoul", "Asia/Tokyo", "Europe/London", "America/New_York", "UTC"]).filter((item): item is string => typeof item === "string");
      return [output(input, JSON.stringify(zones.map((timeZone) => ({ timeZone, time: new Intl.DateTimeFormat("en-US", { timeZone, dateStyle: "medium", timeStyle: "medium", hour12: options.hour12 === true }).format(date), offset: zoneOffset(date, timeZone) })), null, 2), "json", "application/json;charset=utf-8")];
    }
    if (tab === "date-difference") {
      const start = new Date(stringOption(options, "diffStart", value)); const end = new Date(stringOption(options, "diffEnd", ""));
      if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) throw new Error("Date input is invalid.");
      const absoluteMs = Math.abs(end.getTime() - start.getTime()); const absoluteDays = Math.floor(absoluteMs / DAY_MS); const signedDays = (end.getTime() >= start.getTime() ? 1 : -1) * (boolOption(options, "diffIncludeStart", false) ? absoluteDays + 1 : absoluteDays);
      return [output(input, JSON.stringify({ days: signedDays, weeks: `${Math.floor(Math.abs(signedDays) / 7)} weeks ${Math.abs(signedDays) % 7} days`, monthsApprox: (Math.abs(signedDays) / 30.4375).toFixed(2), yearsApprox: (Math.abs(signedDays) / 365.2425).toFixed(2), totalHours: Math.floor(absoluteMs / 3_600_000), totalMinutes: Math.floor(absoluteMs / 60_000), totalSeconds: Math.floor(absoluteMs / 1000) }, null, 2), "json", "application/json;charset=utf-8")];
    }
    if (tab === "d-day") {
      const target = new Date(stringOption(options, "targetDate", value)); const base = new Date(stringOption(options, "baseDate", ""));
      if (Number.isNaN(target.getTime()) || Number.isNaN(base.getTime())) throw new Error("Date input is invalid.");
      const diff = Math.round((new Date(target.getFullYear(), target.getMonth(), target.getDate()).getTime() - new Date(base.getFullYear(), base.getMonth(), base.getDate()).getTime()) / DAY_MS);
      const dday = diff === 0 ? "D-Day" : diff > 0 ? `D-${boolOption(options, "includeTarget", false) ? diff + 1 : diff}` : `D+${Math.abs(diff)}`;
      return [output(input, JSON.stringify({ name: stringOption(options, "eventName", "D-Day"), dday, targetDate: target.toISOString().slice(0, 10), baseDate: base.toISOString().slice(0, 10) }, null, 2), "json", "application/json;charset=utf-8")];
    }
    throw new Error("Unsupported date-time tab.");
  };
}

const extendedProcessors: Record<string, ToolProcessor> = {
  "date-time-tools": dateTimeProcessor(),
  "markdown-tools": markdownProcessor("markdown-tools"),
  "markdown-html-converter": markdownProcessor("markdown-html-converter"),
  "csv-markdown-table-converter": markdownProcessor("csv-markdown-table-converter"),
  "markdown-table-generator": markdownProcessor("markdown-table-generator"),
  "community-post-helper": communityProcessor(),
};

export function getExtendedProcessor(toolId: string): ToolProcessor | undefined { return extendedProcessors[toolId]; }
