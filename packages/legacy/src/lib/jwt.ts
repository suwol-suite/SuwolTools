import { decodeBase64 } from "./encoding";

export type DecodedJwt = {
  header: unknown;
  payload: unknown;
  headerJson: string;
  payloadJson: string;
  signature: string;
};

function decodeBase64UrlSegment(segment: string): string {
  const normalized = segment.replace(/-/g, "+").replace(/_/g, "/");
  const remainder = normalized.length % 4;

  if (remainder === 1) {
    throw new Error("Invalid Base64URL segment.");
  }

  const padded =
    remainder === 0 ? normalized : normalized.padEnd(normalized.length + 4 - remainder, "=");

  return decodeBase64(padded);
}

function parseJwtJson(segment: string, label: string): unknown {
  try {
    return JSON.parse(decodeBase64UrlSegment(segment));
  } catch {
    throw new Error(`Invalid JWT ${label} JSON.`);
  }
}

export function decodeJwt(value: string): DecodedJwt {
  const parts = value.trim().split(".");

  if (parts.length < 2 || parts.length > 3 || !parts[0] || !parts[1]) {
    throw new Error("JWT must contain header, payload, and optional signature segments.");
  }

  const header = parseJwtJson(parts[0], "header");
  const payload = parseJwtJson(parts[1], "payload");

  return {
    header,
    payload,
    headerJson: JSON.stringify(header, null, 2),
    payloadJson: JSON.stringify(payload, null, 2),
    signature: parts[2] ?? "",
  };
}
