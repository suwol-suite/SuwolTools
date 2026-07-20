export type MarkdownToolsTab =
  | "preview"
  | "html"
  | "csv-table"
  | "table-generator"
  | "toc"
  | "cleaner"
  | "checklist"
  | "plain-text";

export type MarkdownHtmlDirection = "markdown-to-html" | "html-to-markdown";
export type MarkdownDelimiter = "comma" | "semicolon" | "tab" | "pipe" | "custom";
export type MarkdownAlignment = "default" | "left" | "center" | "right";
export type ChecklistMode =
  | "unchecked"
  | "checked"
  | "plain"
  | "toggle";
export type ChecklistEmptyLineMode = "keep" | "remove";
export type PlainTextTableMode = "plain" | "tsv" | "remove";

export type MarkdownHtmlOptions = {
  pretty: boolean;
  sanitize: boolean;
  preserveLineBreaks: boolean;
  openLinksNewTab: boolean;
};

export type CsvTableOptions = {
  delimiter: MarkdownDelimiter;
  customDelimiter: string;
  firstRowHeader: boolean;
  trimCells: boolean;
  escapePipe: boolean;
  quoteCsvValues: boolean;
  alignment: MarkdownAlignment;
};

export type TocOptions = {
  minLevel: number;
  maxLevel: number;
  numbered: boolean;
  bullet: "-" | "*";
  includeTitle: boolean;
};

export type CleanerOptions = {
  removeTrailingSpaces: boolean;
  normalizeBlankLines: boolean;
  normalizeHeadings: boolean;
  normalizeListMarkers: boolean;
  tabsToSpaces: boolean;
  trimDocument: boolean;
  lineEndings: "lf" | "crlf";
};

export type CleanerResult = {
  text: string;
  changedCharacters: number;
  changedLines: number;
};

export type PlainTextOptions = {
  includeUrls: boolean;
  keepCodeBlocks: boolean;
  removeImages: boolean;
  preserveListMarkers: boolean;
  tableMode: PlainTextTableMode;
};

const tabValues: MarkdownToolsTab[] = [
  "preview",
  "html",
  "csv-table",
  "table-generator",
  "toc",
  "cleaner",
  "checklist",
  "plain-text",
];

const delimiterValues: Record<Exclude<MarkdownDelimiter, "custom">, string> = {
  comma: ",",
  semicolon: ";",
  tab: "\t",
  pipe: "|",
};

const htmlBlockTags = new Set([
  "p",
  "div",
  "section",
  "article",
  "header",
  "footer",
  "blockquote",
  "ul",
  "ol",
  "li",
  "table",
  "thead",
  "tbody",
  "tr",
  "th",
  "td",
  "pre",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
]);

export function normalizeMarkdownTab(value: string | null | undefined): MarkdownToolsTab {
  return tabValues.includes(value as MarkdownToolsTab) ? (value as MarkdownToolsTab) : "preview";
}

export function getMarkdownDelimiter(
  delimiter: MarkdownDelimiter,
  customDelimiter: string,
): string {
  if (delimiter === "custom") {
    return customDelimiter || ",";
  }

  return delimiterValues[delimiter];
}

export function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function stripHtml(input: string): string {
  return input.replace(/<[^>]*>/g, "");
}

function escapeAttribute(input: string): string {
  return escapeHtml(input).replace(/'/g, "&#39;");
}

function isSafeUrl(value: string): boolean {
  const trimmed = value.trim().toLowerCase();

  return (
    !trimmed ||
    trimmed.startsWith("#") ||
    trimmed.startsWith("/") ||
    trimmed.startsWith("http://") ||
    trimmed.startsWith("https://") ||
    trimmed.startsWith("mailto:")
  );
}

export function sanitizeHtml(input: string): string {
  const withoutDangerousBlocks = input.replace(
    /<\s*(script|style|iframe|object|embed)[\s\S]*?<\s*\/\s*\1\s*>/gi,
    "",
  );

  if (typeof DOMParser === "undefined") {
    return withoutDangerousBlocks
      .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
      .replace(/\s(href|src)\s*=\s*(['"]?)\s*javascript:[^'"\s>]*/gi, "");
  }

  const document = new DOMParser().parseFromString(withoutDangerousBlocks, "text/html");

  document.querySelectorAll("script, style, iframe, object, embed").forEach((node) => node.remove());
  document.querySelectorAll("*").forEach((element) => {
    Array.from(element.attributes).forEach((attribute) => {
      const name = attribute.name.toLowerCase();
      const value = attribute.value.trim();

      if (name.startsWith("on")) {
        element.removeAttribute(attribute.name);
        return;
      }

      if ((name === "href" || name === "src") && !isSafeUrl(value)) {
        element.removeAttribute(attribute.name);
      }
    });
  });

  return document.body.innerHTML;
}

function inlineMarkdownToHtml(input: string, options: MarkdownHtmlOptions): string {
  let output = escapeHtml(input);

  output = output.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (_match, alt: string, url: string) => {
    if (!isSafeUrl(url)) {
      return escapeHtml(alt);
    }

    return `<img src="${escapeAttribute(url)}" alt="${escapeAttribute(alt)}">`;
  });
  output = output.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_match, text: string, url: string) => {
    if (!isSafeUrl(url)) {
      return text;
    }

    const target = options.openLinksNewTab ? ' target="_blank"' : "";
    return `<a href="${escapeAttribute(url)}" rel="noopener noreferrer"${target}>${text}</a>`;
  });
  output = output.replace(/`([^`]+)`/g, "<code>$1</code>");
  output = output.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  output = output.replace(/__([^_]+)__/g, "<strong>$1</strong>");
  output = output.replace(/\*([^*]+)\*/g, "<em>$1</em>");
  output = output.replace(/_([^_]+)_/g, "<em>$1</em>");

  return output;
}

function parseMarkdownTable(lines: string[], startIndex: number, options: MarkdownHtmlOptions) {
  const header = lines[startIndex];
  const separator = lines[startIndex + 1] ?? "";

  if (!header.includes("|") || !/^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(separator)) {
    return null;
  }

  const rows: string[][] = [];
  let index = startIndex;

  while (index < lines.length && lines[index].includes("|")) {
    rows.push(splitMarkdownTableRow(lines[index]));
    index += 1;
  }

  if (rows.length < 2) {
    return null;
  }

  const headers = rows[0];
  const bodyRows = rows.slice(2);
  const headerHtml = headers
    .map((cell) => `<th>${inlineMarkdownToHtml(cell.trim(), options)}</th>`)
    .join("");
  const bodyHtml = bodyRows
    .map(
      (row) =>
        `<tr>${row
          .map((cell) => `<td>${inlineMarkdownToHtml(cell.trim(), options)}</td>`)
          .join("")}</tr>`,
    )
    .join("");

  return {
    html: `<table><thead><tr>${headerHtml}</tr></thead><tbody>${bodyHtml}</tbody></table>`,
    nextIndex: index,
  };
}

export function markdownToHtml(input: string, options: MarkdownHtmlOptions): string {
  const lines = input.replace(/\r\n/g, "\n").split("\n");
  const html: string[] = [];
  let inCode = false;
  let codeLanguage = "";
  let codeLines: string[] = [];
  let listType: "ul" | "ol" | null = null;
  let blockquoteLines: string[] = [];

  function closeList() {
    if (listType) {
      html.push(`</${listType}>`);
      listType = null;
    }
  }

  function closeBlockquote() {
    if (blockquoteLines.length > 0) {
      closeList();
      html.push(
        `<blockquote>${blockquoteLines
          .map((line) => `<p>${inlineMarkdownToHtml(line, options)}</p>`)
          .join("")}</blockquote>`,
      );
      blockquoteLines = [];
    }
  }

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const trimmed = line.trim();
    const fence = /^```(\w+)?\s*$/.exec(trimmed);

    if (fence) {
      if (inCode) {
        html.push(
          `<pre><code${codeLanguage ? ` class="language-${escapeAttribute(codeLanguage)}"` : ""}>${escapeHtml(
            codeLines.join("\n"),
          )}</code></pre>`,
        );
        codeLines = [];
        codeLanguage = "";
        inCode = false;
      } else {
        closeBlockquote();
        closeList();
        inCode = true;
        codeLanguage = fence[1] ?? "";
      }
      continue;
    }

    if (inCode) {
      codeLines.push(line);
      continue;
    }

    if (!trimmed) {
      closeBlockquote();
      closeList();
      continue;
    }

    const table = parseMarkdownTable(lines, index, options);
    if (table) {
      closeBlockquote();
      closeList();
      html.push(table.html);
      index = table.nextIndex - 1;
      continue;
    }

    const blockquote = /^>\s?(.*)$/.exec(trimmed);
    if (blockquote) {
      blockquoteLines.push(blockquote[1]);
      continue;
    }

    closeBlockquote();

    const heading = /^(#{1,6})\s+(.+)$/.exec(trimmed);
    if (heading) {
      closeList();
      html.push(`<h${heading[1].length}>${inlineMarkdownToHtml(heading[2], options)}</h${heading[1].length}>`);
      continue;
    }

    const unordered = /^[-*+]\s+(.+)$/.exec(trimmed);
    if (unordered) {
      if (listType !== "ul") {
        closeList();
        listType = "ul";
        html.push("<ul>");
      }
      html.push(`<li>${inlineMarkdownToHtml(unordered[1], options)}</li>`);
      continue;
    }

    const ordered = /^\d+\.\s+(.+)$/.exec(trimmed);
    if (ordered) {
      if (listType !== "ol") {
        closeList();
        listType = "ol";
        html.push("<ol>");
      }
      html.push(`<li>${inlineMarkdownToHtml(ordered[1], options)}</li>`);
      continue;
    }

    closeList();
    const content = options.preserveLineBreaks
      ? inlineMarkdownToHtml(trimmed, options).replace(/\s{2,}$/g, "<br>")
      : inlineMarkdownToHtml(trimmed, options);
    html.push(`<p>${content}</p>`);
  }

  closeBlockquote();
  closeList();

  if (inCode) {
    html.push(`<pre><code>${escapeHtml(codeLines.join("\n"))}</code></pre>`);
  }

  const output = html.join(options.pretty ? "\n" : "");
  return options.sanitize ? sanitizeHtml(output) : output;
}

function nodeToMarkdown(node: ChildNode): string {
  if (node.nodeType === Node.TEXT_NODE) {
    return node.textContent ?? "";
  }

  if (!(node instanceof HTMLElement)) {
    return "";
  }

  const tag = node.tagName.toLowerCase();
  const children = Array.from(node.childNodes).map(nodeToMarkdown).join("").trim();

  switch (tag) {
    case "h1":
    case "h2":
    case "h3":
    case "h4":
    case "h5":
    case "h6":
      return `${"#".repeat(Number(tag[1]))} ${children}`;
    case "strong":
    case "b":
      return `**${children}**`;
    case "em":
    case "i":
      return `*${children}*`;
    case "code":
      return node.parentElement?.tagName.toLowerCase() === "pre" ? children : `\`${children}\``;
    case "pre":
      return `\`\`\`\n${node.textContent?.trim() ?? ""}\n\`\`\``;
    case "a":
      return `[${children}](${node.getAttribute("href") ?? ""})`;
    case "img":
      return `![${node.getAttribute("alt") ?? ""}](${node.getAttribute("src") ?? ""})`;
    case "blockquote":
      return children
        .split(/\r?\n/)
        .map((line) => `> ${line}`)
        .join("\n");
    case "li":
      return `- ${children}`;
    case "ul":
    case "ol":
      return Array.from(node.children).map((child) => nodeToMarkdown(child)).join("\n");
    case "br":
      return "\n";
    case "table":
      return htmlTableToMarkdown(node);
    default:
      return htmlBlockTags.has(tag) ? children : children;
  }
}

function htmlTableToMarkdown(table: HTMLElement): string {
  const rows = Array.from(table.querySelectorAll("tr")).map((row) =>
    Array.from(row.children).map((cell) => cell.textContent?.trim() ?? ""),
  );

  if (rows.length === 0) {
    return "";
  }

  const columnCount = Math.max(...rows.map((row) => row.length));
  const normalizedRows = rows.map((row) =>
    Array.from({ length: columnCount }, (_, index) => row[index] ?? ""),
  );
  const [headers, ...body] = normalizedRows;

  return buildMarkdownTable(headers, body, Array.from({ length: columnCount }, () => "default"));
}

export function htmlToMarkdown(input: string): string {
  const sanitized = sanitizeHtml(input);

  if (typeof DOMParser === "undefined") {
    return sanitized
      .replace(/<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/gi, (_m, level, content) => `${"#".repeat(Number(level))} ${stripHtml(content)}\n\n`)
      .replace(/<strong[^>]*>([\s\S]*?)<\/strong>/gi, "**$1**")
      .replace(/<b[^>]*>([\s\S]*?)<\/b>/gi, "**$1**")
      .replace(/<em[^>]*>([\s\S]*?)<\/em>/gi, "*$1*")
      .replace(/<i[^>]*>([\s\S]*?)<\/i>/gi, "*$1*")
      .replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, "- $1\n")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/p>/gi, "\n\n")
      .replace(/<[^>]+>/g, "")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  const document = new DOMParser().parseFromString(sanitized, "text/html");

  return Array.from(document.body.childNodes)
    .map(nodeToMarkdown)
    .filter(Boolean)
    .join("\n\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function parseDelimitedRows(
  input: string,
  delimiter: string,
  trimCells: boolean,
): string[][] {
  const rows: string[][] = [];
  let cell = "";
  let row: string[] = [];
  let inQuotes = false;

  for (let index = 0; index < input.length; index += 1) {
    const character = input[index];
    const next = input[index + 1];

    if (character === "\"" && inQuotes && next === "\"") {
      cell += "\"";
      index += 1;
      continue;
    }

    if (character === "\"") {
      inQuotes = !inQuotes;
      continue;
    }

    if (character === delimiter && !inQuotes) {
      row.push(trimCells ? cell.trim() : cell);
      cell = "";
      continue;
    }

    if ((character === "\n" || character === "\r") && !inQuotes) {
      if (character === "\r" && next === "\n") {
        index += 1;
      }

      row.push(trimCells ? cell.trim() : cell);
      rows.push(row);
      row = [];
      cell = "";
      continue;
    }

    cell += character;
  }

  row.push(trimCells ? cell.trim() : cell);

  if (row.some((value) => value.length > 0) || rows.length === 0) {
    rows.push(row);
  }

  return rows;
}

function escapeMarkdownCell(value: string, escapePipe: boolean): string {
  const nextValue = value.replace(/\r?\n/g, " ");
  return escapePipe ? nextValue.replace(/\|/g, "\\|") : nextValue;
}

function alignmentMarker(alignment: MarkdownAlignment): string {
  switch (alignment) {
    case "left":
      return ":---";
    case "center":
      return ":---:";
    case "right":
      return "---:";
    case "default":
    default:
      return "---";
  }
}

export function buildMarkdownTable(
  headers: string[],
  rows: string[][],
  alignments: MarkdownAlignment[],
  escapePipe = true,
): string {
  const columnCount = Math.max(1, headers.length, ...rows.map((row) => row.length));
  const normalizedHeaders = Array.from(
    { length: columnCount },
    (_, index) => headers[index] ?? `Column ${index + 1}`,
  );
  const normalizedRows = rows.map((row) =>
    Array.from({ length: columnCount }, (_, index) => row[index] ?? ""),
  );

  const headerLine = `| ${normalizedHeaders
    .map((cell) => escapeMarkdownCell(cell, escapePipe))
    .join(" | ")} |`;
  const alignLine = `| ${Array.from({ length: columnCount }, (_, index) =>
    alignmentMarker(alignments[index] ?? "default"),
  ).join(" | ")} |`;
  const bodyLines = normalizedRows.map(
    (row) => `| ${row.map((cell) => escapeMarkdownCell(cell, escapePipe)).join(" | ")} |`,
  );

  return [headerLine, alignLine, ...bodyLines].join("\n");
}

export function csvToMarkdownTable(input: string, options: CsvTableOptions): string {
  const delimiter = getMarkdownDelimiter(options.delimiter, options.customDelimiter);
  const rows = parseDelimitedRows(input, delimiter, options.trimCells).filter((row) =>
    row.some((cell) => cell.length > 0),
  );

  if (rows.length === 0) {
    return "";
  }

  const columnCount = Math.max(...rows.map((row) => row.length));
  const normalizedRows = rows.map((row) =>
    Array.from({ length: columnCount }, (_, index) => row[index] ?? ""),
  );
  const headers = options.firstRowHeader
    ? normalizedRows[0]
    : Array.from({ length: columnCount }, (_, index) => `Column ${index + 1}`);
  const bodyRows = options.firstRowHeader ? normalizedRows.slice(1) : normalizedRows;

  return buildMarkdownTable(
    headers,
    bodyRows,
    Array.from({ length: columnCount }, () => options.alignment),
    options.escapePipe,
  );
}

export function splitMarkdownTableRow(line: string): string[] {
  const trimmed = line.trim().replace(/^\|/, "").replace(/\|$/, "");
  const cells: string[] = [];
  let cell = "";
  let escaping = false;

  for (const character of trimmed) {
    if (escaping) {
      cell += character;
      escaping = false;
      continue;
    }

    if (character === "\\") {
      escaping = true;
      continue;
    }

    if (character === "|") {
      cells.push(cell.trim());
      cell = "";
      continue;
    }

    cell += character;
  }

  cells.push(cell.trim());
  return cells;
}

function escapeCsvCell(value: string, delimiter: string, quoteValues: boolean): string {
  if (
    quoteValues ||
    value.includes("\"") ||
    value.includes("\n") ||
    value.includes("\r") ||
    value.includes(delimiter)
  ) {
    return `"${value.replace(/"/g, "\"\"")}"`;
  }

  return value;
}

export function markdownTableToCsv(input: string, options: CsvTableOptions): string {
  const delimiter = getMarkdownDelimiter(options.delimiter, options.customDelimiter);
  const rows = input
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.includes("|"))
    .filter((line) => !/^\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(line))
    .map(splitMarkdownTableRow);

  return rows
    .map((row) =>
      row
        .map((cell) => (options.trimCells ? cell.trim() : cell))
        .map((cell) => escapeCsvCell(cell, delimiter, options.quoteCsvValues))
        .join(delimiter),
    )
    .join("\n");
}

export function githubSlug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/<[^>]+>/g, "")
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export function generateMarkdownToc(input: string, options: TocOptions): string {
  const usedAnchors = new Map<string, number>();
  const counters: number[] = [];
  const entries = input
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => /^(#{1,6})\s+(.+)$/.exec(line.trim()))
    .filter((match): match is RegExpExecArray => Boolean(match))
    .map((match) => ({
      level: match[1].length,
      title: match[2].replace(/#+\s*$/, "").trim(),
    }))
    .filter((entry, index) =>
      options.includeTitle ? true : !(index === 0 && entry.level === 1),
    )
    .filter((entry) => entry.level >= options.minLevel && entry.level <= options.maxLevel);

  return entries
    .map((entry) => {
      const baseAnchor = githubSlug(entry.title) || "heading";
      const count = usedAnchors.get(baseAnchor) ?? 0;
      usedAnchors.set(baseAnchor, count + 1);
      const anchor = count === 0 ? baseAnchor : `${baseAnchor}-${count}`;
      const indent = "  ".repeat(Math.max(0, entry.level - options.minLevel));

      counters[entry.level] = (counters[entry.level] ?? 0) + 1;
      counters.length = entry.level + 1;
      const number = options.numbered
        ? `${counters.slice(options.minLevel, entry.level + 1).filter(Boolean).join(".")}. `
        : "";

      return `${indent}${options.bullet} [${number}${entry.title}](#${anchor})`;
    })
    .join("\n");
}

function transformOutsideCodeBlocks(input: string, transform: (line: string) => string): string {
  let inCode = false;

  return input
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => {
      if (line.trim().startsWith("```")) {
        inCode = !inCode;
        return line;
      }

      return inCode ? line : transform(line);
    })
    .join("\n");
}

export function cleanMarkdown(input: string, options: CleanerOptions): CleanerResult {
  const original = input;
  let text = input.replace(/\r\n/g, "\n");

  text = transformOutsideCodeBlocks(text, (line) => {
    let nextLine = line;

    if (options.removeTrailingSpaces) {
      nextLine = nextLine.replace(/[ \t]+$/g, "");
    }

    if (options.tabsToSpaces) {
      nextLine = nextLine.replace(/\t/g, "  ");
    }

    if (options.normalizeHeadings) {
      nextLine = nextLine.replace(/^(#{1,6})([^\s#])/g, "$1 $2");
    }

    if (options.normalizeListMarkers) {
      nextLine = nextLine.replace(/^(\s*)[+*]\s+/g, "$1- ");
    }

    return nextLine;
  });

  if (options.normalizeBlankLines) {
    text = text.replace(/\n{3,}/g, "\n\n");
    text = text.replace(/^(#{1,6}\s.+)\n{2,}/gm, "$1\n\n");
  }

  if (options.trimDocument) {
    text = text.trim();
  }

  if (options.lineEndings === "crlf") {
    text = text.replace(/\n/g, "\r\n");
  }

  const originalLines = original.replace(/\r\n/g, "\n").split("\n");
  const nextLines = text.replace(/\r\n/g, "\n").split("\n");
  const changedLineCount = Math.max(originalLines.length, nextLines.length);
  const changedLineFlags: number[] = Array.from({ length: changedLineCount }, (_, index) =>
    originalLines[index] === nextLines[index] ? 0 : 1,
  );

  return {
    text,
    changedCharacters: Math.abs(original.length - text.length),
    changedLines: changedLineFlags.reduce((sum, value) => sum + value, 0),
  };
}

function stripExistingListMarker(value: string) {
  return value
    .replace(/^\s*[-*+]\s+\[[ xX]\]\s+/, "")
    .replace(/^\s*[-*+]\s+/, "")
    .trim();
}

export function convertChecklist(
  input: string,
  mode: ChecklistMode,
  emptyLineMode: ChecklistEmptyLineMode,
  preserveBullet: boolean,
  bullet: "-" | "*",
): string {
  return input
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => {
      if (!line.trim()) {
        return emptyLineMode === "keep" ? "" : null;
      }

      const checklist = /^\s*[-*+]\s+\[([ xX])\]\s+(.*)$/.exec(line);
      const plainText = preserveBullet ? line.replace(/^\s*[-*+]\s+/, "").trim() : stripExistingListMarker(line);
      const marker = preserveBullet && /^\s*[-*+]\s+/.test(line) ? line.trim()[0] : bullet;

      if (mode === "plain") {
        return `${marker} ${checklist ? checklist[2] : plainText}`;
      }

      if (mode === "toggle" && checklist) {
        return `${marker} [${checklist[1].trim().toLowerCase() === "x" ? " " : "x"}] ${checklist[2]}`;
      }

      if (mode === "toggle") {
        return `${marker} [x] ${plainText}`;
      }

      return `${marker} [${mode === "checked" ? "x" : " "}] ${checklist ? checklist[2] : plainText}`;
    })
    .filter((line): line is string => line !== null)
    .join("\n");
}

function markdownTableToPlain(lines: string[], mode: PlainTextTableMode): string[] {
  if (mode === "remove") {
    return [];
  }

  return lines
    .filter((line) => !/^\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(line.trim()))
    .map((line) => splitMarkdownTableRow(line).join(mode === "tsv" ? "\t" : "  "));
}

export function markdownToPlainText(input: string, options: PlainTextOptions): string {
  const lines = input.replace(/\r\n/g, "\n").split("\n");
  const output: string[] = [];
  let inCode = false;
  let codeLines: string[] = [];
  let tableLines: string[] = [];

  function flushTable() {
    if (tableLines.length > 0) {
      output.push(...markdownTableToPlain(tableLines, options.tableMode));
      tableLines = [];
    }
  }

  lines.forEach((line) => {
    if (line.trim().startsWith("```")) {
      if (inCode) {
        if (options.keepCodeBlocks) {
          output.push(codeLines.join("\n"));
        }
        codeLines = [];
        inCode = false;
      } else {
        flushTable();
        inCode = true;
      }
      return;
    }

    if (inCode) {
      codeLines.push(line);
      return;
    }

    if (line.includes("|") && /^\s*\|?.+\|.+/.test(line)) {
      tableLines.push(line);
      return;
    }

    flushTable();

    let nextLine = line;
    nextLine = nextLine.replace(/^#{1,6}\s+/, "");
    nextLine = nextLine.replace(/^>\s?/, "");

    if (!options.preserveListMarkers) {
      nextLine = nextLine.replace(/^\s*([-*+]|\d+\.)\s+/, "");
    }

    nextLine = nextLine.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, options.removeImages ? "" : "$1");
    nextLine = nextLine.replace(/\[([^\]]+)\]\(([^)]+)\)/g, options.includeUrls ? "$1 ($2)" : "$1");
    nextLine = nextLine.replace(/`([^`]+)`/g, "$1");
    nextLine = nextLine.replace(/\*\*([^*]+)\*\*/g, "$1");
    nextLine = nextLine.replace(/__([^_]+)__/g, "$1");
    nextLine = nextLine.replace(/\*([^*]+)\*/g, "$1");
    nextLine = nextLine.replace(/_([^_]+)_/g, "$1");

    output.push(nextLine);
  });

  flushTable();

  if (inCode && options.keepCodeBlocks) {
    output.push(codeLines.join("\n"));
  }

  return output.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}
