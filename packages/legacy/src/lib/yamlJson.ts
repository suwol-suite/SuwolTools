type YamlLine = {
  indent: number;
  text: string;
};

export function jsonToYaml(value: unknown, indent = 0): string {
  const space = " ".repeat(indent);

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return "[]";
    }

    return value
      .map((item) => {
        if (isPlainObject(item) || Array.isArray(item)) {
          return `${space}-\n${jsonToYaml(item, indent + 2)}`;
        }

        return `${space}- ${formatYamlScalar(item)}`;
      })
      .join("\n");
  }

  if (isPlainObject(value)) {
    const entries = Object.entries(value);

    if (entries.length === 0) {
      return "{}";
    }

    return entries
      .map(([key, item]) => {
        if (isPlainObject(item) || Array.isArray(item)) {
          return `${space}${key}:\n${jsonToYaml(item, indent + 2)}`;
        }

        return `${space}${key}: ${formatYamlScalar(item)}`;
      })
      .join("\n");
  }

  return `${space}${formatYamlScalar(value)}`;
}

export function yamlToJsonValue(input: string): unknown {
  const lines = input
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map(parseLine)
    .filter((line): line is YamlLine => Boolean(line));
  let index = 0;

  if (lines.length === 0) {
    return null;
  }

  function parseBlock(indent: number): unknown {
    const current = lines[index];

    if (!current || current.indent < indent) {
      return null;
    }

    return current.text.startsWith("- ") || current.text === "-" ? parseArray(indent) : parseObject(indent);
  }

  function parseArray(indent: number): unknown[] {
    const array: unknown[] = [];

    while (index < lines.length && lines[index].indent === indent) {
      const line = lines[index];

      if (!line.text.startsWith("-")) {
        break;
      }

      const rest = line.text.slice(1).trim();
      index += 1;

      if (!rest) {
        array.push(parseBlock(indent + 2));
      } else if (looksLikeKeyValue(rest)) {
        const [key, valueText] = splitKeyValue(rest);
        const item: Record<string, unknown> = {};
        item[key] = valueText ? parseScalar(valueText) : parseBlock(indent + 2);

        while (index < lines.length && lines[index].indent === indent + 2 && !lines[index].text.startsWith("-")) {
          const nested = lines[index];
          const [nestedKey, nestedValue] = splitKeyValue(nested.text);
          index += 1;
          item[nestedKey] = nestedValue ? parseScalar(nestedValue) : parseBlock(indent + 4);
        }

        array.push(item);
      } else {
        array.push(parseScalar(rest));
      }
    }

    return array;
  }

  function parseObject(indent: number): Record<string, unknown> {
    const object: Record<string, unknown> = {};

    while (index < lines.length && lines[index].indent === indent && !lines[index].text.startsWith("-")) {
      const line = lines[index];
      const [key, valueText] = splitKeyValue(line.text);
      index += 1;
      object[key] = valueText ? parseScalar(valueText) : parseBlock(indent + 2);
    }

    return object;
  }

  const result = parseBlock(lines[0].indent);

  if (index < lines.length) {
    throw new Error("Unsupported YAML structure.");
  }

  return result;
}

function parseLine(rawLine: string): YamlLine | null {
  const trimmedRight = rawLine.replace(/\s+$/, "");

  if (!trimmedRight.trim() || trimmedRight.trim().startsWith("#")) {
    return null;
  }

  const indent = trimmedRight.length - trimmedRight.trimStart().length;
  const text = stripInlineComment(trimmedRight.trimStart());

  return text ? { indent, text } : null;
}

function stripInlineComment(value: string): string {
  let quote = "";

  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];

    if (quote) {
      if (character === quote && value[index - 1] !== "\\") {
        quote = "";
      }
      continue;
    }

    if ((character === "\"" || character === "'") && value[index - 1] !== "\\") {
      quote = character;
      continue;
    }

    if (character === "#" && /\s/.test(value[index - 1] ?? "")) {
      return value.slice(0, index).trimEnd();
    }
  }

  return value;
}

function looksLikeKeyValue(value: string): boolean {
  return /^[^:[\]{}]+:\s*/.test(value);
}

function splitKeyValue(value: string): [string, string] {
  const separator = value.indexOf(":");

  if (separator < 0) {
    throw new Error("Invalid YAML mapping.");
  }

  return [value.slice(0, separator).trim(), value.slice(separator + 1).trim()];
}

function parseScalar(value: string): unknown {
  if (value === "null" || value === "~") {
    return null;
  }

  if (value === "true") {
    return true;
  }

  if (value === "false") {
    return false;
  }

  if ((value.startsWith("\"") && value.endsWith("\"")) || (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1);
  }

  if (/^-?\d+(\.\d+)?$/.test(value)) {
    return Number(value);
  }

  return value;
}

function formatYamlScalar(value: unknown): string {
  if (value === null) {
    return "null";
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  return JSON.stringify(String(value));
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
