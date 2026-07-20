const textEncoder = new TextEncoder();

function getTextDecoder() {
  return new TextDecoder("utf-8", { fatal: true });
}

export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join(" ");
}

export function bytesToCompactHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export function encodeBase64(text: string): string {
  const bytes = textEncoder.encode(text);
  let binary = "";

  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });

  return btoa(binary);
}

export function decodeBase64(value: string): string {
  const normalized = value.trim();
  let binary = "";

  try {
    binary = atob(normalized);
  } catch {
    throw new Error("Invalid Base64 input.");
  }

  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));

  try {
    return getTextDecoder().decode(bytes);
  } catch {
    throw new Error("Decoded bytes are not valid UTF-8 text.");
  }
}

export function encodeUrlComponent(value: string): string {
  return encodeURIComponent(value);
}

export function decodeUrlComponent(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    throw new Error("Invalid percent-encoded URL component.");
  }
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function unescapeHtml(value: string): string {
  return value.replace(
    /&(#x[0-9a-fA-F]+|#\d+|amp|lt|gt|quot|apos);/g,
    (entity, body: string) => {
      if (body === "amp") return "&";
      if (body === "lt") return "<";
      if (body === "gt") return ">";
      if (body === "quot") return "\"";
      if (body === "apos") return "'";

      const codePoint = body.startsWith("#x")
        ? Number.parseInt(body.slice(2), 16)
        : Number.parseInt(body.slice(1), 10);

      if (!Number.isFinite(codePoint)) {
        return entity;
      }

      try {
        return String.fromCodePoint(codePoint);
      } catch {
        return entity;
      }
    },
  );
}

export function escapeJsonString(value: string): string {
  return JSON.stringify(value).slice(1, -1);
}

export function unescapeJsonString(value: string): string {
  try {
    const parsed = JSON.parse(`"${value}"`);

    if (typeof parsed !== "string") {
      throw new Error("Invalid JSON string content.");
    }

    return parsed;
  } catch {
    throw new Error("Invalid JSON escaped string content.");
  }
}

export function escapeUnicode(value: string): string {
  let output = "";

  for (let index = 0; index < value.length; index += 1) {
    output += `\\u${value.charCodeAt(index).toString(16).padStart(4, "0")}`;
  }

  return output;
}

export function unescapeUnicode(value: string): string {
  if (/\\u(?![0-9a-fA-F]{4})/.test(value)) {
    throw new Error("Invalid Unicode escape sequence.");
  }

  return value.replace(/\\u([0-9a-fA-F]{4})/g, (_, hex: string) =>
    String.fromCharCode(Number.parseInt(hex, 16)),
  );
}

export function textToHex(value: string): string {
  return bytesToHex(textEncoder.encode(value));
}

export function hexToText(value: string): string {
  const compact = value.replace(/0x/gi, "").replace(/[\s,;:_-]+/g, "");

  if (!compact) {
    return "";
  }

  if (compact.length % 2 !== 0 || !/^[0-9a-fA-F]+$/.test(compact)) {
    throw new Error("Hex input must contain complete hexadecimal byte pairs.");
  }

  const bytes = new Uint8Array(compact.length / 2);

  for (let index = 0; index < compact.length; index += 2) {
    bytes[index / 2] = Number.parseInt(compact.slice(index, index + 2), 16);
  }

  try {
    return getTextDecoder().decode(bytes);
  } catch {
    throw new Error("Hex bytes are not valid UTF-8 text.");
  }
}

export function textToBinary(value: string): string {
  return Array.from(textEncoder.encode(value))
    .map((byte) => byte.toString(2).padStart(8, "0"))
    .join(" ");
}

export function binaryToText(value: string): string {
  const trimmed = value.trim();

  if (!trimmed) {
    return "";
  }

  const groups = /\s/.test(trimmed)
    ? trimmed.split(/\s+/)
    : trimmed.match(/.{1,8}/g) ?? [];

  if (
    groups.length === 0 ||
    groups.some((group) => group.length !== 8 || !/^[01]+$/.test(group))
  ) {
    throw new Error("Binary input must contain 8-bit groups.");
  }

  const bytes = Uint8Array.from(groups, (group) => Number.parseInt(group, 2));

  try {
    return getTextDecoder().decode(bytes);
  } catch {
    throw new Error("Binary bytes are not valid UTF-8 text.");
  }
}
