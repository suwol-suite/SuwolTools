export type JsonPathMatch = {
  path: string;
  value: unknown;
};

type JsonPathToken =
  | { type: "property"; key: string }
  | { type: "index"; index: number }
  | { type: "wildcard" };

function formatPropertyPath(parentPath: string, key: string): string {
  return /^[A-Za-z_$][\w$]*$/.test(key)
    ? `${parentPath}.${key}`
    : `${parentPath}[${JSON.stringify(key)}]`;
}

function parseJsonPath(expression: string): JsonPathToken[] {
  const input = expression.trim();

  if (!input.startsWith("$")) {
    throw new Error("invalid-jsonpath");
  }

  const tokens: JsonPathToken[] = [];
  let index = 1;

  while (index < input.length) {
    const character = input[index];

    if (character === ".") {
      index += 1;

      if (input[index] === "*") {
        tokens.push({ type: "wildcard" });
        index += 1;
        continue;
      }

      const match = input.slice(index).match(/^[A-Za-z_$][\w$]*/);

      if (!match) {
        throw new Error("invalid-jsonpath");
      }

      tokens.push({ type: "property", key: match[0] });
      index += match[0].length;
      continue;
    }

    if (character === "[") {
      const closeIndex = input.indexOf("]", index);

      if (closeIndex === -1) {
        throw new Error("invalid-jsonpath");
      }

      const body = input.slice(index + 1, closeIndex).trim();

      if (body === "*") {
        tokens.push({ type: "wildcard" });
      } else if (/^\d+$/.test(body)) {
        tokens.push({ type: "index", index: Number(body) });
      } else {
        const propertyMatch = body.match(/^["'](.+)["']$/);

        if (!propertyMatch) {
          throw new Error("invalid-jsonpath");
        }

        tokens.push({ type: "property", key: propertyMatch[1] });
      }

      index = closeIndex + 1;
      continue;
    }

    throw new Error("invalid-jsonpath");
  }

  return tokens;
}

function applyToken(matches: JsonPathMatch[], token: JsonPathToken): JsonPathMatch[] {
  const nextMatches: JsonPathMatch[] = [];

  for (const match of matches) {
    if (token.type === "property") {
      if (
        match.value &&
        typeof match.value === "object" &&
        !Array.isArray(match.value) &&
        Object.prototype.hasOwnProperty.call(match.value, token.key)
      ) {
        nextMatches.push({
          path: formatPropertyPath(match.path, token.key),
          value: (match.value as Record<string, unknown>)[token.key],
        });
      }
      continue;
    }

    if (token.type === "index") {
      if (Array.isArray(match.value) && token.index < match.value.length) {
        nextMatches.push({
          path: `${match.path}[${token.index}]`,
          value: match.value[token.index],
        });
      }
      continue;
    }

    if (Array.isArray(match.value)) {
      match.value.forEach((item, itemIndex) => {
        nextMatches.push({
          path: `${match.path}[${itemIndex}]`,
          value: item,
        });
      });
    } else if (match.value && typeof match.value === "object") {
      Object.entries(match.value as Record<string, unknown>).forEach(([key, value]) => {
        nextMatches.push({
          path: formatPropertyPath(match.path, key),
          value,
        });
      });
    }
  }

  return nextMatches;
}

export function runJsonPath(jsonText: string, expression: string): JsonPathMatch[] {
  const data = JSON.parse(jsonText);
  const tokens = parseJsonPath(expression);

  return tokens.reduce(applyToken, [{ path: "$", value: data }]);
}

export function stringifyJsonPathResult(matches: JsonPathMatch[]): string {
  return JSON.stringify(
    matches.map((match) => ({
      path: match.path,
      value: match.value,
    })),
    null,
    2,
  );
}
