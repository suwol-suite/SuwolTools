export type CodeLanguage = "html" | "css" | "javascript";

export type MinifyOptions = {
  removeComments: boolean;
  collapseWhitespace: boolean;
};

function removeCodeComments(input: string, language: CodeLanguage): string {
  if (language === "html") {
    return input.replace(/<!--[\s\S]*?-->/g, "");
  }

  if (language === "css") {
    return input.replace(/\/\*[\s\S]*?\*\//g, "");
  }

  return input
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}

export function minifyCode(
  input: string,
  language: CodeLanguage,
  options: MinifyOptions,
): string {
  let output = options.removeComments ? removeCodeComments(input, language) : input;

  if (!options.collapseWhitespace) {
    return output.trim();
  }

  if (language === "html") {
    return output
      .replace(/>\s+</g, "><")
      .replace(/\s{2,}/g, " ")
      .trim();
  }

  if (language === "css") {
    return output
      .replace(/\s+/g, " ")
      .replace(/\s*([{}:;,>+~])\s*/g, "$1")
      .replace(/;}/g, "}")
      .trim();
  }

  return output
    .replace(/\s+/g, " ")
    .replace(/\s*([{}()[\]=+\-*/%,;:<>&|?])\s*/g, "$1")
    .replace(/;}/g, "}")
    .trim();
}

function indentation(level: number, indent: string): string {
  return indent.repeat(Math.max(0, level));
}

export function beautifyHtml(input: string, indent: string): string {
  const tokens = input
    .replace(/>\s+</g, "><")
    .replace(/</g, "\n<")
    .replace(/>/g, ">\n")
    .split(/\n+/)
    .map((token) => token.trim())
    .filter(Boolean);
  let level = 0;

  return tokens
    .map((token) => {
      if (/^<\//.test(token)) {
        level -= 1;
      }

      const line = `${indentation(level, indent)}${token}`;

      if (/^<[^!?/][^>]*[^/]?>$/.test(token) && !/^<(area|base|br|col|embed|hr|img|input|link|meta|param|source|track|wbr)\b/i.test(token)) {
        level += 1;
      }

      return line;
    })
    .join("\n");
}

export function beautifyCss(input: string, indent: string): string {
  const minified = minifyCode(input, "css", {
    removeComments: false,
    collapseWhitespace: true,
  });
  let level = 0;

  return minified
    .replace(/\{/g, " {\n")
    .replace(/;/g, ";\n")
    .replace(/\}/g, "\n}\n")
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      if (line === "}") {
        level -= 1;
      }

      const formatted = `${indentation(level, indent)}${line}`;

      if (line.endsWith("{")) {
        level += 1;
      }

      return formatted;
    })
    .join("\n");
}

export function beautifyJavaScript(input: string, indent: string): string {
  const minified = minifyCode(input, "javascript", {
    removeComments: false,
    collapseWhitespace: true,
  });
  let level = 0;

  return minified
    .replace(/\{/g, "{\n")
    .replace(/\}/g, "\n}\n")
    .replace(/;/g, ";\n")
    .replace(/,/g, ", ")
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      if (line.startsWith("}")) {
        level -= 1;
      }

      const formatted = `${indentation(level, indent)}${line}`;

      if (line.endsWith("{")) {
        level += 1;
      }

      return formatted;
    })
    .join("\n");
}

export function beautifyCode(input: string, language: CodeLanguage, indent: string): string {
  if (language === "html") return beautifyHtml(input, indent);
  if (language === "css") return beautifyCss(input, indent);
  return beautifyJavaScript(input, indent);
}
