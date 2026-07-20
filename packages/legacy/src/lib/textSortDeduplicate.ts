export type TextSortOptions = {
  direction: "none" | "asc" | "desc";
  deduplicate: boolean;
  removeEmpty: boolean;
  trimWhitespace: boolean;
  caseInsensitive: boolean;
};

export type TextSortResult = {
  text: string;
  inputLineCount: number;
  outputLineCount: number;
  removedLineCount: number;
};

export function sortAndDeduplicateLines(input: string, options: TextSortOptions): TextSortResult {
  const originalLines = input.split(/\r?\n/);
  let lines = options.trimWhitespace
    ? originalLines.map((line) => line.trim())
    : [...originalLines];

  if (options.removeEmpty) {
    lines = lines.filter((line) => line.length > 0);
  }

  if (options.deduplicate) {
    const seen = new Set<string>();
    lines = lines.filter((line) => {
      const key = options.caseInsensitive ? line.toLocaleLowerCase() : line;

      if (seen.has(key)) {
        return false;
      }

      seen.add(key);
      return true;
    });
  }

  if (options.direction !== "none") {
    lines.sort((left, right) => {
      const a = options.caseInsensitive ? left.toLocaleLowerCase() : left;
      const b = options.caseInsensitive ? right.toLocaleLowerCase() : right;
      const comparison = a.localeCompare(b, undefined, { numeric: true });
      return options.direction === "asc" ? comparison : -comparison;
    });
  }

  return {
    text: lines.join("\n"),
    inputLineCount: originalLines.length,
    outputLineCount: lines.length,
    removedLineCount: originalLines.length - lines.length,
  };
}
