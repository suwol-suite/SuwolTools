import { hashBytes } from "./hash";

export type UuidVersion =
  | "v1"
  | "v3"
  | "v4"
  | "v5"
  | "v6"
  | "v7"
  | "nil"
  | "max";

export type UuidOutputFormat =
  | "lowercase"
  | "uppercase"
  | "no-hyphen"
  | "braces"
  | "urn";

export type UuidNamespaceId = "dns" | "url" | "oid" | "x500" | "custom";
export type UuidBatchFormat = "plain" | "json" | "csv";
export type UuidVariant = "ncs" | "rfc4122" | "microsoft" | "future";

export type GenerateUuidOptions = {
  version: UuidVersion;
  namespace?: string;
  name?: string;
  outputFormat?: UuidOutputFormat;
};

export type UuidInspectResult = {
  input: string;
  valid: boolean;
  normalized: string | null;
  compact: string | null;
  version: number | null;
  variant: UuidVariant | null;
  isNil: boolean;
  isMax: boolean;
  errorCode: "empty" | "invalid" | null;
};

export type UuidV7TimestampInfo = {
  uuid: string;
  date: Date;
  unixMilliseconds: number;
  iso: string;
  utc: string;
  local: string;
};

export const NIL_UUID = "00000000-0000-0000-0000-000000000000";
export const MAX_UUID = "ffffffff-ffff-ffff-ffff-ffffffffffff";

export const uuidVersions: Array<{ id: UuidVersion; label: string }> = [
  { id: "v1", label: "UUID v1" },
  { id: "v3", label: "UUID v3" },
  { id: "v4", label: "UUID v4" },
  { id: "v5", label: "UUID v5" },
  { id: "v6", label: "UUID v6" },
  { id: "v7", label: "UUID v7" },
  { id: "nil", label: "Nil UUID" },
  { id: "max", label: "Max UUID" },
];

export const uuidOutputFormats: Array<{ id: UuidOutputFormat; labelKey: string }> = [
  { id: "lowercase", labelKey: "tools.uuidGenerator.output.lowercase" },
  { id: "uppercase", labelKey: "tools.uuidGenerator.output.uppercase" },
  { id: "no-hyphen", labelKey: "tools.uuidGenerator.output.noHyphen" },
  { id: "braces", labelKey: "tools.uuidGenerator.output.braces" },
  { id: "urn", labelKey: "tools.uuidGenerator.output.urn" },
];

export const uuidBatchFormats: Array<{ id: UuidBatchFormat; labelKey: string }> = [
  { id: "plain", labelKey: "tools.uuidGenerator.batch.plain" },
  { id: "json", labelKey: "tools.uuidGenerator.batch.json" },
  { id: "csv", labelKey: "tools.uuidGenerator.batch.csv" },
];

export const uuidNamespaces: Record<Exclude<UuidNamespaceId, "custom">, string> = {
  dns: "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
  url: "6ba7b811-9dad-11d1-80b4-00c04fd430c8",
  oid: "6ba7b812-9dad-11d1-80b4-00c04fd430c8",
  x500: "6ba7b814-9dad-11d1-80b4-00c04fd430c8",
};

const UUID_EPOCH_OFFSET_MS = 12219292800000n;
const textEncoder = new TextEncoder();
let v1Node: Uint8Array | null = null;
let v1ClockSequence: number | null = null;
let lastTimestampMs = 0;
let lastNanosecond = 0;

function fillRandomBytes(bytes: Uint8Array) {
  globalThis.crypto.getRandomValues(bytes);
}

function bytesToUuid(bytes: Uint8Array): string {
  const hex = Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");

  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20),
  ].join("-");
}

function compactToUuid(compact: string) {
  return [
    compact.slice(0, 8),
    compact.slice(8, 12),
    compact.slice(12, 16),
    compact.slice(16, 20),
    compact.slice(20),
  ].join("-");
}

function compactUuid(uuid: string) {
  return uuid.replace(/-/g, "");
}

function writeUint32(bytes: Uint8Array, offset: number, value: number) {
  bytes[offset] = (value >>> 24) & 0xff;
  bytes[offset + 1] = (value >>> 16) & 0xff;
  bytes[offset + 2] = (value >>> 8) & 0xff;
  bytes[offset + 3] = value & 0xff;
}

function writeUint16(bytes: Uint8Array, offset: number, value: number) {
  bytes[offset] = (value >>> 8) & 0xff;
  bytes[offset + 1] = value & 0xff;
}

function getNodeBytes() {
  if (!v1Node) {
    v1Node = new Uint8Array(6);
    fillRandomBytes(v1Node);
    v1Node[0] |= 0x01;
  }

  return v1Node;
}

function getClockSequence() {
  if (v1ClockSequence === null) {
    const bytes = new Uint8Array(2);
    fillRandomBytes(bytes);
    v1ClockSequence = ((bytes[0] << 8) | bytes[1]) & 0x3fff;
  }

  return v1ClockSequence;
}

function nextUuidTimestamp() {
  let timestampMs = Date.now();

  if (timestampMs < lastTimestampMs) {
    v1ClockSequence = (getClockSequence() + 1) & 0x3fff;
    lastNanosecond = 0;
  } else if (timestampMs === lastTimestampMs) {
    lastNanosecond += 1;

    if (lastNanosecond >= 10000) {
      timestampMs += 1;
      lastNanosecond = 0;
    }
  } else {
    lastNanosecond = 0;
  }

  lastTimestampMs = timestampMs;

  return (BigInt(timestampMs) + UUID_EPOCH_OFFSET_MS) * 10000n + BigInt(lastNanosecond);
}

function writeClockSequenceAndNode(bytes: Uint8Array) {
  const clockSequence = getClockSequence();
  const node = getNodeBytes();

  bytes[8] = ((clockSequence >>> 8) & 0x3f) | 0x80;
  bytes[9] = clockSequence & 0xff;
  bytes.set(node, 10);
}

function parseUuidBytes(uuid: string) {
  const normalized = normalizeUuid(uuid);

  if (!normalized) {
    return null;
  }

  const compact = compactUuid(normalized);
  const bytes = new Uint8Array(16);

  for (let index = 0; index < 16; index += 1) {
    bytes[index] = Number.parseInt(compact.slice(index * 2, index * 2 + 2), 16);
  }

  return bytes;
}

function getVariant(byte: number): UuidVariant {
  if ((byte & 0x80) === 0x00) {
    return "ncs";
  }

  if ((byte & 0xc0) === 0x80) {
    return "rfc4122";
  }

  if ((byte & 0xe0) === 0xc0) {
    return "microsoft";
  }

  return "future";
}

function setVersionAndVariant(bytes: Uint8Array, version: number) {
  bytes[6] = (bytes[6] & 0x0f) | (version << 4);
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
}

export function normalizeUuid(input: string): string | null {
  const trimmed = input.trim().toLowerCase();

  if (!trimmed) {
    return null;
  }

  const withoutUrn = trimmed.startsWith("urn:uuid:") ? trimmed.slice(9) : trimmed;
  const withoutBraces =
    withoutUrn.startsWith("{") && withoutUrn.endsWith("}")
      ? withoutUrn.slice(1, -1)
      : withoutUrn;
  const compact = withoutBraces.replace(/-/g, "");

  if (!/^[0-9a-f]{32}$/.test(compact)) {
    return null;
  }

  return compactToUuid(compact);
}

export function validateUuid(input: string): boolean {
  return inspectUuid(input).valid;
}

export function inspectUuid(input: string): UuidInspectResult {
  if (!input.trim()) {
    return {
      input,
      valid: false,
      normalized: null,
      compact: null,
      version: null,
      variant: null,
      isNil: false,
      isMax: false,
      errorCode: "empty",
    };
  }

  const normalized = normalizeUuid(input);

  if (!normalized) {
    return {
      input,
      valid: false,
      normalized: null,
      compact: null,
      version: null,
      variant: null,
      isNil: false,
      isMax: false,
      errorCode: "invalid",
    };
  }

  const bytes = parseUuidBytes(normalized);
  const compact = compactUuid(normalized);
  const isNil = normalized === NIL_UUID;
  const isMax = normalized === MAX_UUID;

  return {
    input,
    valid: true,
    normalized,
    compact,
    version: isNil || isMax ? null : Number.parseInt(compact[12], 16),
    variant: bytes ? getVariant(bytes[8]) : null,
    isNil,
    isMax,
    errorCode: null,
  };
}

export function formatUuid(uuid: string, format: UuidOutputFormat = "lowercase"): string {
  const normalized = normalizeUuid(uuid);

  if (!normalized) {
    throw new Error("Invalid UUID.");
  }

  switch (format) {
    case "uppercase":
      return normalized.toUpperCase();
    case "no-hyphen":
      return compactUuid(normalized);
    case "braces":
      return `{${normalized}}`;
    case "urn":
      return `urn:uuid:${normalized}`;
    case "lowercase":
    default:
      return normalized;
  }
}

export function generateUuidV1(): string {
  const timestamp = nextUuidTimestamp();
  const bytes = new Uint8Array(16);

  writeUint32(bytes, 0, Number(timestamp & 0xffffffffn));
  writeUint16(bytes, 4, Number((timestamp >> 32n) & 0xffffn));
  writeUint16(bytes, 6, Number((timestamp >> 48n) & 0x0fffn));
  bytes[6] = (bytes[6] & 0x0f) | 0x10;
  writeClockSequenceAndNode(bytes);

  return bytesToUuid(bytes);
}

export function generateUuidV4(): string {
  try {
    return globalThis.crypto.randomUUID();
  } catch {
    const bytes = new Uint8Array(16);
    fillRandomBytes(bytes);
    setVersionAndVariant(bytes, 4);

    return bytesToUuid(bytes);
  }
}

export function generateUuidV6(): string {
  const timestamp = nextUuidTimestamp();
  const bytes = new Uint8Array(16);

  writeUint32(bytes, 0, Number((timestamp >> 28n) & 0xffffffffn));
  writeUint16(bytes, 4, Number((timestamp >> 12n) & 0xffffn));
  writeUint16(bytes, 6, Number(timestamp & 0x0fffn));
  bytes[6] = (bytes[6] & 0x0f) | 0x60;
  writeClockSequenceAndNode(bytes);

  return bytesToUuid(bytes);
}

export function generateUuidV7(): string {
  const bytes = new Uint8Array(16);
  const randomBytes = new Uint8Array(10);
  let timestamp = BigInt(Date.now());

  fillRandomBytes(randomBytes);

  for (let index = 5; index >= 0; index -= 1) {
    bytes[index] = Number(timestamp & 0xffn);
    timestamp >>= 8n;
  }

  bytes[6] = 0x70 | (randomBytes[0] & 0x0f);
  bytes[7] = randomBytes[1];
  bytes[8] = 0x80 | (randomBytes[2] & 0x3f);
  bytes.set(randomBytes.slice(3), 9);

  return bytesToUuid(bytes);
}

export async function generateUuidV3(namespace: string, name: string): Promise<string> {
  return generateNameBasedUuid(namespace, name, 3, "md5");
}

export async function generateUuidV5(namespace: string, name: string): Promise<string> {
  return generateNameBasedUuid(namespace, name, 5, "sha1");
}

async function generateNameBasedUuid(
  namespace: string,
  name: string,
  version: 3 | 5,
  algorithm: "md5" | "sha1",
) {
  const namespaceBytes = parseUuidBytes(namespace);

  if (!namespaceBytes) {
    throw new Error("Invalid UUID namespace.");
  }

  if (!name) {
    throw new Error("UUID name is required.");
  }

  const nameBytes = textEncoder.encode(name);
  const data = new Uint8Array(namespaceBytes.length + nameBytes.length);
  data.set(namespaceBytes, 0);
  data.set(nameBytes, namespaceBytes.length);

  const digest = await hashBytes(data, algorithm);
  const bytes = digest.slice(0, 16);
  setVersionAndVariant(bytes, version);

  return bytesToUuid(bytes);
}

export async function generateUuid(options: GenerateUuidOptions): Promise<string> {
  const outputFormat = options.outputFormat ?? "lowercase";
  let uuid: string;

  switch (options.version) {
    case "v1":
      uuid = generateUuidV1();
      break;
    case "v3":
      uuid = await generateUuidV3(options.namespace ?? "", options.name ?? "");
      break;
    case "v4":
      uuid = generateUuidV4();
      break;
    case "v5":
      uuid = await generateUuidV5(options.namespace ?? "", options.name ?? "");
      break;
    case "v6":
      uuid = generateUuidV6();
      break;
    case "v7":
      uuid = generateUuidV7();
      break;
    case "nil":
      uuid = NIL_UUID;
      break;
    case "max":
      uuid = MAX_UUID;
      break;
    default:
      uuid = generateUuidV4();
      break;
  }

  return formatUuid(uuid, outputFormat);
}

export async function generateManyUuids(
  options: GenerateUuidOptions,
  count: number,
): Promise<string[]> {
  if (!Number.isFinite(count) || count < 1 || count > 1000) {
    throw new Error("UUID count must be between 1 and 1000.");
  }

  const safeCount = Math.floor(count);
  const uuids: string[] = [];

  for (let index = 0; index < safeCount; index += 1) {
    uuids.push(await generateUuid(options));
  }

  return uuids;
}

export function extractUuidV7Timestamp(input: string): Date | null {
  const inspected = inspectUuid(input);

  if (!inspected.valid || inspected.version !== 7 || !inspected.compact) {
    return null;
  }

  const unixMilliseconds = Number.parseInt(inspected.compact.slice(0, 12), 16);
  const date = new Date(unixMilliseconds);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
}

export function inspectUuidV7Timestamp(input: string): UuidV7TimestampInfo | null {
  const normalized = normalizeUuid(input);
  const date = extractUuidV7Timestamp(input);

  if (!normalized || !date) {
    return null;
  }

  return {
    uuid: normalized,
    date,
    unixMilliseconds: date.getTime(),
    iso: date.toISOString(),
    utc: date.toUTCString(),
    local: date.toLocaleString(),
  };
}
