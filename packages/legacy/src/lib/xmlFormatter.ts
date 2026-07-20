export function formatXml(input: string): string {
  const serialized = serializeValidXml(input);
  const normalized = serialized.replace(/>\s*</g, "><").replace(/></g, ">\n<");
  const lines = normalized.split("\n");
  let indent = 0;

  return lines
    .map((line) => {
      const trimmed = line.trim();

      if (/^<\//.test(trimmed)) {
        indent = Math.max(0, indent - 1);
      }

      const output = `${"  ".repeat(indent)}${trimmed}`;

      if (/^<[^!?/][^>]*[^/]?>$/.test(trimmed) && !trimmed.includes("</")) {
        indent += 1;
      }

      return output;
    })
    .join("\n");
}

export function minifyXml(input: string): string {
  return serializeValidXml(input).replace(/>\s+</g, "><").trim();
}

export function validateXml(input: string): void {
  serializeValidXml(input);
}

function serializeValidXml(input: string): string {
  const parser = new DOMParser();
  const document = parser.parseFromString(input, "application/xml");
  const parserError = document.querySelector("parsererror");

  if (parserError) {
    throw new Error(parserError.textContent?.trim() || "Invalid XML.");
  }

  return new XMLSerializer().serializeToString(document);
}
