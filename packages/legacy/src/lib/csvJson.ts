export type CsvDelimiter = "," | ";" | "\t";

export function csvToJson(input: string, delimiter: CsvDelimiter, useHeader: boolean): string {
  const rows = parseCsv(input, delimiter);

  if (rows.length === 0) {
    return "[]";
  }

  if (!useHeader) {
    return JSON.stringify(rows, null, 2);
  }

  const [headers, ...dataRows] = rows;
  const objects = dataRows.map((row) => {
    const object: Record<string, string> = {};
    headers.forEach((header, index) => {
      object[header || `field${index + 1}`] = row[index] ?? "";
    });
    return object;
  });

  return JSON.stringify(objects, null, 2);
}

export function jsonToCsv(input: string, delimiter: CsvDelimiter, includeHeader: boolean): string {
  const value = JSON.parse(input) as unknown;

  if (!Array.isArray(value)) {
    throw new Error("JSON input must be an array.");
  }

  if (value.length === 0) {
    return "";
  }

  if (value.every((item) => Array.isArray(item))) {
    return (value as unknown[][])
      .map((row) => row.map((field) => escapeCsvField(field, delimiter)).join(delimiter))
      .join("\n");
  }

  if (value.every(isPlainObject)) {
    const rows = value as Record<string, unknown>[];
    const headers = Array.from(new Set(rows.flatMap((row) => Object.keys(row))));
    const csvRows = rows.map((row) =>
      headers.map((header) => escapeCsvField(row[header] ?? "", delimiter)).join(delimiter),
    );

    return includeHeader
      ? [headers.map((header) => escapeCsvField(header, delimiter)).join(delimiter), ...csvRows].join("\n")
      : csvRows.join("\n");
  }

  throw new Error("JSON array must contain objects or arrays.");
}

export function parseCsv(input: string, delimiter: CsvDelimiter): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < input.length; index += 1) {
    const character = input[index];
    const nextCharacter = input[index + 1];

    if (quoted) {
      if (character === "\"" && nextCharacter === "\"") {
        field += "\"";
        index += 1;
      } else if (character === "\"") {
        quoted = false;
      } else {
        field += character;
      }
      continue;
    }

    if (character === "\"") {
      quoted = true;
    } else if (character === delimiter) {
      row.push(field);
      field = "";
    } else if (character === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (character !== "\r") {
      field += character;
    }
  }

  if (quoted) {
    throw new Error("CSV quote is not closed.");
  }

  row.push(field);

  if (row.some((value) => value !== "") || rows.length > 0) {
    rows.push(row);
  }

  return rows;
}

function escapeCsvField(value: unknown, delimiter: CsvDelimiter): string {
  const text = String(value);

  if (text.includes("\"") || text.includes("\n") || text.includes("\r") || text.includes(delimiter)) {
    return `"${text.replace(/"/g, "\"\"")}"`;
  }

  return text;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
