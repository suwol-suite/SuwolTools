export type TextDiffOptions = {
  ignoreWhitespace: boolean;
  ignoreCase: boolean;
};

export type TextDiffRowType = "same" | "added" | "removed" | "changed";

export type TextDiffRow = {
  type: TextDiffRowType;
  leftLineNumber?: number;
  rightLineNumber?: number;
  leftText: string;
  rightText: string;
};

export type TextDiffResult = {
  rows: TextDiffRow[];
  summary: Record<TextDiffRowType, number>;
};

type DiffOperation = {
  type: "same" | "added" | "removed";
  leftLineNumber?: number;
  rightLineNumber?: number;
  leftText: string;
  rightText: string;
};

export function compareTexts(
  leftText: string,
  rightText: string,
  options: TextDiffOptions,
): TextDiffResult {
  const leftLines = splitLines(leftText);
  const rightLines = splitLines(rightText);
  const operations = buildLineOperations(leftLines, rightLines, options);
  const rows = combineChangedRows(operations);
  const summary: TextDiffResult["summary"] = {
    same: 0,
    added: 0,
    removed: 0,
    changed: 0,
  };

  rows.forEach((row) => {
    summary[row.type] += 1;
  });

  return {
    rows,
    summary,
  };
}

export function formatTextDiff(result: TextDiffResult): string {
  if (result.rows.length === 0) {
    return "";
  }

  return result.rows
    .map((row) => {
      switch (row.type) {
        case "added":
          return `+ ${row.rightText}`;
        case "removed":
          return `- ${row.leftText}`;
        case "changed":
          return `~ ${row.leftText} -> ${row.rightText}`;
        case "same":
        default:
          return `  ${row.leftText}`;
      }
    })
    .join("\n");
}

function splitLines(text: string): string[] {
  if (!text) {
    return [];
  }

  return text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
}

function normalizeLine(line: string, options: TextDiffOptions): string {
  let normalized = options.ignoreWhitespace ? line.replace(/\s+/g, " ").trim() : line;

  if (options.ignoreCase) {
    normalized = normalized.toLowerCase();
  }

  return normalized;
}

function buildLineOperations(
  leftLines: string[],
  rightLines: string[],
  options: TextDiffOptions,
): DiffOperation[] {
  const leftNormalized = leftLines.map((line) => normalizeLine(line, options));
  const rightNormalized = rightLines.map((line) => normalizeLine(line, options));
  const dp: number[][] = Array.from({ length: leftLines.length + 1 }, () =>
    Array.from({ length: rightLines.length + 1 }, () => 0),
  );

  for (let leftIndex = leftLines.length - 1; leftIndex >= 0; leftIndex -= 1) {
    for (let rightIndex = rightLines.length - 1; rightIndex >= 0; rightIndex -= 1) {
      dp[leftIndex][rightIndex] =
        leftNormalized[leftIndex] === rightNormalized[rightIndex]
          ? dp[leftIndex + 1][rightIndex + 1] + 1
          : Math.max(dp[leftIndex + 1][rightIndex], dp[leftIndex][rightIndex + 1]);
    }
  }

  const operations: DiffOperation[] = [];
  let leftIndex = 0;
  let rightIndex = 0;

  while (leftIndex < leftLines.length || rightIndex < rightLines.length) {
    if (
      leftIndex < leftLines.length &&
      rightIndex < rightLines.length &&
      leftNormalized[leftIndex] === rightNormalized[rightIndex]
    ) {
      operations.push({
        type: "same",
        leftLineNumber: leftIndex + 1,
        rightLineNumber: rightIndex + 1,
        leftText: leftLines[leftIndex],
        rightText: rightLines[rightIndex],
      });
      leftIndex += 1;
      rightIndex += 1;
      continue;
    }

    if (
      rightIndex < rightLines.length &&
      (leftIndex === leftLines.length ||
        dp[leftIndex][rightIndex + 1] > dp[leftIndex + 1][rightIndex])
    ) {
      operations.push({
        type: "added",
        rightLineNumber: rightIndex + 1,
        leftText: "",
        rightText: rightLines[rightIndex],
      });
      rightIndex += 1;
      continue;
    }

    operations.push({
      type: "removed",
      leftLineNumber: leftIndex + 1,
      leftText: leftLines[leftIndex],
      rightText: "",
    });
    leftIndex += 1;
  }

  return operations;
}

function combineChangedRows(operations: DiffOperation[]): TextDiffRow[] {
  const rows: TextDiffRow[] = [];

  for (let index = 0; index < operations.length; index += 1) {
    const current = operations[index];
    const next = operations[index + 1];

    if (current.type === "removed" && next?.type === "added") {
      rows.push({
        type: "changed",
        leftLineNumber: current.leftLineNumber,
        rightLineNumber: next.rightLineNumber,
        leftText: current.leftText,
        rightText: next.rightText,
      });
      index += 1;
      continue;
    }

    rows.push({
      type: current.type,
      leftLineNumber: current.leftLineNumber,
      rightLineNumber: current.rightLineNumber,
      leftText: current.leftText,
      rightText: current.rightText,
    });
  }

  return rows;
}
