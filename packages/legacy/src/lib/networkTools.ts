export type IpScope = "private" | "public" | "loopback" | "linkLocal" | "multicast" | "reserved";

export type IpCalculationResult = {
  inputAddress: string;
  prefix: number;
  subnetMask: string;
  wildcardMask: string;
  networkAddress: string;
  broadcastAddress: string;
  firstUsableAddress: string;
  lastUsableAddress: string;
  totalAddresses: number;
  usableHosts: number;
  ipClass: string;
  scope: IpScope;
  specialRange: "pointToPoint" | "singleHost" | null;
};

export type PortProtocol = "TCP" | "UDP";
export type PortRisk = "low" | "medium" | "high";

export type PortEntry = {
  ports: number[];
  service: string;
  protocols: PortProtocol[];
  descriptionKey: string;
  risk: PortRisk;
};

export type ParsedTraceHop = {
  hop: number;
  host: string;
  times: number[];
  timedOut: boolean;
};

export type PingTraceAnalysis = {
  kind: "ping" | "trace" | "unknown";
  minMs: number | null;
  avgMs: number | null;
  maxMs: number | null;
  packetLossPercent: number | null;
  ttl: number | null;
  hops: ParsedTraceHop[];
  timeoutCount: number;
  status: "ok" | "highLatency" | "loss" | "timeouts" | "dnsIssue" | "unknown";
};

export type CertificateName = {
  commonName: string;
  organization: string;
  organizationalUnit: string;
  country: string;
};

export type CertificateParseResult = {
  subject: CertificateName;
  issuer: CertificateName;
  validFrom: string;
  validTo: string;
  daysRemaining: number | null;
  fingerprintSha256: string;
  subjectAltNames: string[];
};

type Asn1Node = {
  tag: number;
  tagClass: number;
  tagNumber: number;
  constructed: boolean;
  valueStart: number;
  valueEnd: number;
  children: Asn1Node[];
};

const maxUint32 = 0xffffffff;

export const dnsRecordTypes = ["A", "AAAA", "CNAME", "MX", "TXT", "NS", "SOA", "CAA"] as const;

export const securityHeaderNames = [
  "strict-transport-security",
  "content-security-policy",
  "x-frame-options",
  "x-content-type-options",
  "referrer-policy",
  "permissions-policy",
] as const;

export const commonPorts: PortEntry[] = [
  { ports: [20, 21], service: "FTP", protocols: ["TCP"], descriptionKey: "tools.networkTools.port.desc.ftp", risk: "high" },
  { ports: [22], service: "SSH", protocols: ["TCP"], descriptionKey: "tools.networkTools.port.desc.ssh", risk: "medium" },
  { ports: [23], service: "Telnet", protocols: ["TCP"], descriptionKey: "tools.networkTools.port.desc.telnet", risk: "high" },
  { ports: [25], service: "SMTP", protocols: ["TCP"], descriptionKey: "tools.networkTools.port.desc.smtp", risk: "medium" },
  { ports: [53], service: "DNS", protocols: ["TCP", "UDP"], descriptionKey: "tools.networkTools.port.desc.dns", risk: "low" },
  { ports: [67, 68], service: "DHCP", protocols: ["UDP"], descriptionKey: "tools.networkTools.port.desc.dhcp", risk: "medium" },
  { ports: [80], service: "HTTP", protocols: ["TCP"], descriptionKey: "tools.networkTools.port.desc.http", risk: "medium" },
  { ports: [110], service: "POP3", protocols: ["TCP"], descriptionKey: "tools.networkTools.port.desc.pop3", risk: "medium" },
  { ports: [123], service: "NTP", protocols: ["UDP"], descriptionKey: "tools.networkTools.port.desc.ntp", risk: "low" },
  { ports: [143], service: "IMAP", protocols: ["TCP"], descriptionKey: "tools.networkTools.port.desc.imap", risk: "medium" },
  { ports: [161, 162], service: "SNMP", protocols: ["UDP"], descriptionKey: "tools.networkTools.port.desc.snmp", risk: "high" },
  { ports: [389], service: "LDAP", protocols: ["TCP", "UDP"], descriptionKey: "tools.networkTools.port.desc.ldap", risk: "medium" },
  { ports: [443], service: "HTTPS", protocols: ["TCP"], descriptionKey: "tools.networkTools.port.desc.https", risk: "low" },
  { ports: [445], service: "SMB", protocols: ["TCP"], descriptionKey: "tools.networkTools.port.desc.smb", risk: "high" },
  { ports: [465], service: "SMTPS", protocols: ["TCP"], descriptionKey: "tools.networkTools.port.desc.smtps", risk: "low" },
  { ports: [587], service: "SMTP Submission", protocols: ["TCP"], descriptionKey: "tools.networkTools.port.desc.submission", risk: "low" },
  { ports: [993], service: "IMAPS", protocols: ["TCP"], descriptionKey: "tools.networkTools.port.desc.imaps", risk: "low" },
  { ports: [995], service: "POP3S", protocols: ["TCP"], descriptionKey: "tools.networkTools.port.desc.pop3s", risk: "low" },
  { ports: [1433], service: "MSSQL", protocols: ["TCP"], descriptionKey: "tools.networkTools.port.desc.mssql", risk: "high" },
  { ports: [1521], service: "Oracle", protocols: ["TCP"], descriptionKey: "tools.networkTools.port.desc.oracle", risk: "high" },
  { ports: [3306], service: "MySQL/MariaDB", protocols: ["TCP"], descriptionKey: "tools.networkTools.port.desc.mysql", risk: "high" },
  { ports: [3389], service: "RDP", protocols: ["TCP", "UDP"], descriptionKey: "tools.networkTools.port.desc.rdp", risk: "high" },
  { ports: [5432], service: "PostgreSQL", protocols: ["TCP"], descriptionKey: "tools.networkTools.port.desc.postgresql", risk: "high" },
  { ports: [5900], service: "VNC", protocols: ["TCP"], descriptionKey: "tools.networkTools.port.desc.vnc", risk: "high" },
  { ports: [6379], service: "Redis", protocols: ["TCP"], descriptionKey: "tools.networkTools.port.desc.redis", risk: "high" },
  { ports: [8080], service: "HTTP Alt", protocols: ["TCP"], descriptionKey: "tools.networkTools.port.desc.httpAlt", risk: "medium" },
  { ports: [9200], service: "Elasticsearch", protocols: ["TCP"], descriptionKey: "tools.networkTools.port.desc.elasticsearch", risk: "high" },
  { ports: [27017], service: "MongoDB", protocols: ["TCP"], descriptionKey: "tools.networkTools.port.desc.mongodb", risk: "high" },
];

export function parseIPv4(value: string): number[] | null {
  const parts = value.trim().split(".");

  if (parts.length !== 4) {
    return null;
  }

  const octets = parts.map((part) => {
    if (!/^\d+$/.test(part)) {
      return Number.NaN;
    }

    const value = Number(part);
    return value >= 0 && value <= 255 ? value : Number.NaN;
  });

  return octets.some((octet) => Number.isNaN(octet)) ? null : octets;
}

export function ipv4ToNumber(value: string): number | null {
  const octets = parseIPv4(value);

  if (!octets) {
    return null;
  }

  return (((octets[0] << 24) >>> 0) + (octets[1] << 16) + (octets[2] << 8) + octets[3]) >>> 0;
}

export function numberToIPv4(value: number): string {
  return [
    (value >>> 24) & 255,
    (value >>> 16) & 255,
    (value >>> 8) & 255,
    value & 255,
  ].join(".");
}

export function prefixToMask(prefix: number): number {
  if (prefix <= 0) {
    return 0;
  }

  return (maxUint32 - 2 ** (32 - prefix) + 1) >>> 0;
}

export function maskToPrefix(mask: string): number | null {
  const maskNumber = ipv4ToNumber(mask);

  if (maskNumber === null) {
    return null;
  }

  const bits = maskNumber.toString(2).padStart(32, "0");

  if (!/^1*0*$/.test(bits)) {
    return null;
  }

  return bits.indexOf("0") === -1 ? 32 : bits.indexOf("0");
}

function parsePrefixOrMask(value: string): number | null {
  const trimmed = value.trim();

  if (/^\d+$/.test(trimmed)) {
    const prefix = Number(trimmed);
    return prefix >= 0 && prefix <= 32 ? prefix : null;
  }

  return maskToPrefix(trimmed);
}

export function calculateIpv4Subnet(addressInput: string, prefixInput: string): IpCalculationResult {
  const addressParts = addressInput.trim().split("/");
  const address = addressParts[0]?.trim() ?? "";
  const inlinePrefix = addressParts[1]?.trim();
  const prefixValue = inlinePrefix || prefixInput;
  const ipNumber = ipv4ToNumber(address);
  const prefix = parsePrefixOrMask(prefixValue);

  if (ipNumber === null || prefix === null) {
    throw new Error("invalid-ip-or-prefix");
  }

  const mask = prefixToMask(prefix);
  const wildcard = (maxUint32 ^ mask) >>> 0;
  const network = (ipNumber & mask) >>> 0;
  const broadcast = (network | wildcard) >>> 0;
  const totalAddresses = 2 ** (32 - prefix);
  const specialRange = prefix === 31 ? "pointToPoint" : prefix === 32 ? "singleHost" : null;
  const usableHosts = prefix === 32 ? 1 : prefix === 31 ? 2 : Math.max(0, totalAddresses - 2);
  const firstUsable = prefix >= 31 ? network : network + 1;
  const lastUsable = prefix >= 31 ? broadcast : broadcast - 1;

  return {
    inputAddress: numberToIPv4(ipNumber),
    prefix,
    subnetMask: numberToIPv4(mask),
    wildcardMask: numberToIPv4(wildcard),
    networkAddress: numberToIPv4(network),
    broadcastAddress: numberToIPv4(broadcast),
    firstUsableAddress: numberToIPv4(firstUsable),
    lastUsableAddress: numberToIPv4(lastUsable),
    totalAddresses,
    usableHosts,
    ipClass: getIPv4Class(ipNumber),
    scope: getIPv4Scope(ipNumber),
    specialRange,
  };
}

export function getIPv4Class(ipNumber: number): string {
  const firstOctet = (ipNumber >>> 24) & 255;

  if (firstOctet >= 1 && firstOctet <= 126) {
    return "A";
  }

  if (firstOctet >= 128 && firstOctet <= 191) {
    return "B";
  }

  if (firstOctet >= 192 && firstOctet <= 223) {
    return "C";
  }

  if (firstOctet >= 224 && firstOctet <= 239) {
    return "D";
  }

  if (firstOctet >= 240) {
    return "E";
  }

  return "special";
}

export function getIPv4Scope(ipNumber: number): IpScope {
  const first = (ipNumber >>> 24) & 255;
  const second = (ipNumber >>> 16) & 255;

  if (first === 10 || (first === 172 && second >= 16 && second <= 31) || (first === 192 && second === 168)) {
    return "private";
  }

  if (first === 127) {
    return "loopback";
  }

  if (first === 169 && second === 254) {
    return "linkLocal";
  }

  if (first >= 224 && first <= 239) {
    return "multicast";
  }

  if (first === 0 || first >= 240) {
    return "reserved";
  }

  return "public";
}

export function searchPorts(query: string, protocol: "all" | PortProtocol): PortEntry[] {
  const normalizedQuery = query.trim().toLowerCase();

  return commonPorts.filter((entry) => {
    const protocolMatches = protocol === "all" || entry.protocols.includes(protocol);
    const queryMatches =
      !normalizedQuery ||
      entry.service.toLowerCase().includes(normalizedQuery) ||
      entry.ports.some((port) => String(port).includes(normalizedQuery));

    return protocolMatches && queryMatches;
  });
}

export function normalizeDomainInput(input: string): string {
  const trimmed = input.trim();

  if (!trimmed) {
    throw new Error("empty-domain");
  }

  let hostname = trimmed;

  try {
    const url = new URL(trimmed.includes("://") ? trimmed : `https://${trimmed}`);
    hostname = url.hostname;
  } catch {
    hostname = trimmed;
  }

  hostname = hostname.replace(/\.$/, "").toLowerCase();

  if (!isLikelyDomain(hostname)) {
    throw new Error("invalid-domain");
  }

  return hostname;
}

export function isLikelyDomain(hostname: string): boolean {
  if (hostname.length > 253 || hostname.includes("..")) {
    return false;
  }

  return hostname
    .split(".")
    .every((label) => label.length > 0 && label.length <= 63 && /^[a-z0-9-]+$/i.test(label) && !label.startsWith("-") && !label.endsWith("-"));
}

export function normalizeHttpUrl(input: string): URL {
  const trimmed = input.trim();

  if (!trimmed) {
    throw new Error("empty-url");
  }

  const url = new URL(trimmed.includes("://") ? trimmed : `https://${trimmed}`);

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("unsupported-protocol");
  }

  if (isBlockedNetworkTarget(url.hostname)) {
    throw new Error("blocked-target");
  }

  return url;
}

export function isBlockedNetworkTarget(hostname: string): boolean {
  const normalized = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  const ipv4 = ipv4ToNumber(normalized);

  if (
    normalized === "localhost" ||
    normalized.endsWith(".localhost") ||
    normalized.endsWith(".local") ||
    normalized.endsWith(".lan")
  ) {
    return true;
  }

  if (ipv4 !== null) {
    const scope = getIPv4Scope(ipv4);
    return scope !== "public";
  }

  if (
    normalized === "::1" ||
    normalized.startsWith("fc") ||
    normalized.startsWith("fd") ||
    normalized.startsWith("fe80:")
  ) {
    return true;
  }

  return false;
}

export function analyzePingTrace(input: string): PingTraceAnalysis {
  const lines = input.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const text = lines.join("\n");
  const hops = parseTraceHops(lines);
  const packetLossPercent = extractPacketLoss(text);
  const minAvgMax = extractMinAvgMax(text);
  const ttlMatch = text.match(/ttl[=\s](\d+)/i);
  const ttl = ttlMatch ? Number(ttlMatch[1]) : null;
  const timeoutCount =
    (text.match(/\brequest timed out\b/gi)?.length ?? 0) +
    (text.match(/\*/g)?.length ?? 0) +
    (text.match(/\btimeout\b/gi)?.length ?? 0);
  const kind = hops.length > 0 ? "trace" : packetLossPercent !== null || minAvgMax.avgMs !== null ? "ping" : "unknown";
  const status = getPingTraceStatus(kind, packetLossPercent, minAvgMax.avgMs, timeoutCount, text);

  return {
    kind,
    ...minAvgMax,
    packetLossPercent,
    ttl,
    hops,
    timeoutCount,
    status,
  };
}

function extractPacketLoss(text: string): number | null {
  const percentMatch = text.match(/(\d+(?:\.\d+)?)%\s*(?:packet\s*)?loss/i);

  if (percentMatch) {
    return Number(percentMatch[1]);
  }

  const windowsMatch = text.match(/Lost\s*=\s*(\d+)\s*\((\d+(?:\.\d+)?)%\s*loss\)/i);

  if (windowsMatch) {
    return Number(windowsMatch[2]);
  }

  return null;
}

function extractMinAvgMax(text: string): Pick<PingTraceAnalysis, "minMs" | "avgMs" | "maxMs"> {
  const unixMatch = text.match(/(?:rtt|round-trip)[^=]*=\s*([\d.]+)\/([\d.]+)\/([\d.]+)/i);

  if (unixMatch) {
    return {
      minMs: Number(unixMatch[1]),
      avgMs: Number(unixMatch[2]),
      maxMs: Number(unixMatch[3]),
    };
  }

  const windowsMatch = text.match(/Minimum\s*=\s*(\d+)ms,\s*Maximum\s*=\s*(\d+)ms,\s*Average\s*=\s*(\d+)ms/i);

  if (windowsMatch) {
    return {
      minMs: Number(windowsMatch[1]),
      maxMs: Number(windowsMatch[2]),
      avgMs: Number(windowsMatch[3]),
    };
  }

  const times = Array.from(text.matchAll(/(?:time[=<]\s*|[< ]\s*)(\d+(?:\.\d+)?)\s*ms/gi)).map((match) => Number(match[1]));

  if (times.length === 0) {
    return { minMs: null, avgMs: null, maxMs: null };
  }

  return {
    minMs: Math.min(...times),
    avgMs: times.reduce((sum, value) => sum + value, 0) / times.length,
    maxMs: Math.max(...times),
  };
}

function parseTraceHops(lines: string[]): ParsedTraceHop[] {
  return lines
    .map((line) => {
      const hopMatch = line.match(/^\s*(\d+)\s+(.+)$/);

      if (!hopMatch) {
        return null;
      }

      const hop = Number(hopMatch[1]);
      const body = hopMatch[2];
      const times = Array.from(body.matchAll(/<?\s*(\d+(?:\.\d+)?)\s*ms/gi)).map((match) => Number(match[1]));
      const timedOut = body.includes("*") || /request timed out|timeout/i.test(body);
      const host = body
        .replace(/<?\s*\d+(?:\.\d+)?\s*ms/gi, "")
        .replace(/\*/g, "")
        .replace(/request timed out\.?/gi, "")
        .trim();

      return {
        hop,
        host: host || "*",
        times,
        timedOut,
      };
    })
    .filter((hop): hop is ParsedTraceHop => Boolean(hop));
}

function getPingTraceStatus(
  kind: PingTraceAnalysis["kind"],
  packetLossPercent: number | null,
  avgMs: number | null,
  timeoutCount: number,
  text: string,
): PingTraceAnalysis["status"] {
  if (kind === "unknown" && /could not find host|unknown host|temporary failure|name or service not known/i.test(text)) {
    return "dnsIssue";
  }

  if (packetLossPercent !== null && packetLossPercent > 0) {
    return "loss";
  }

  if (avgMs !== null && avgMs >= 100) {
    return "highLatency";
  }

  if (timeoutCount > 0) {
    return "timeouts";
  }

  return kind === "unknown" ? "unknown" : "ok";
}

export async function parsePemCertificate(pem: string): Promise<CertificateParseResult> {
  const base64 = pem
    .replace(/-----BEGIN CERTIFICATE-----/g, "")
    .replace(/-----END CERTIFICATE-----/g, "")
    .replace(/\s+/g, "");

  if (!base64) {
    throw new Error("invalid-certificate");
  }

  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  const root = parseAsn1(bytes);
  const tbs = root.children[0];

  if (!tbs) {
    throw new Error("invalid-certificate");
  }

  let cursor = tbs.children[0]?.tagClass === 2 && tbs.children[0]?.tagNumber === 0 ? 1 : 0;
  cursor += 2;
  const issuer = parseName(tbs.children[cursor], bytes);
  cursor += 1;
  const validity = tbs.children[cursor];
  cursor += 1;
  const subject = parseName(tbs.children[cursor], bytes);
  const validFrom = parseAsn1Time(validity?.children[0], bytes);
  const validTo = parseAsn1Time(validity?.children[1], bytes);
  const subjectAltNames = parseSubjectAltNames(tbs, bytes);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const fingerprintSha256 = Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0").toUpperCase())
    .join(":");
  const validToTime = validTo ? new Date(validTo).getTime() : Number.NaN;
  const daysRemaining = Number.isNaN(validToTime)
    ? null
    : Math.ceil((validToTime - Date.now()) / 86_400_000);

  return {
    subject,
    issuer,
    validFrom,
    validTo,
    daysRemaining,
    fingerprintSha256,
    subjectAltNames,
  };
}

function parseAsn1(bytes: Uint8Array, offset = 0, end = bytes.length): Asn1Node {
  const tag = bytes[offset];
  const lengthByte = bytes[offset + 1];
  let length = lengthByte;
  let headerLength = 2;

  if (lengthByte & 0x80) {
    const lengthBytes = lengthByte & 0x7f;
    length = 0;
    headerLength += lengthBytes;

    for (let index = 0; index < lengthBytes; index += 1) {
      length = (length << 8) + bytes[offset + 2 + index];
    }
  }

  const valueStart = offset + headerLength;
  const valueEnd = valueStart + length;

  if (valueEnd > end) {
    throw new Error("invalid-certificate");
  }

  const constructed = Boolean(tag & 0x20);
  const node: Asn1Node = {
    tag,
    tagClass: tag >> 6,
    tagNumber: tag & 0x1f,
    constructed,
    valueStart,
    valueEnd,
    children: [],
  };

  if (constructed) {
    let childOffset = valueStart;

    while (childOffset < valueEnd) {
      const child = parseAsn1(bytes, childOffset, valueEnd);
      node.children.push(child);
      childOffset = child.valueEnd;
    }
  }

  return node;
}

function parseChildren(bytes: Uint8Array, start: number, end: number): Asn1Node[] {
  const children: Asn1Node[] = [];
  let offset = start;

  while (offset < end) {
    const child = parseAsn1(bytes, offset, end);
    children.push(child);
    offset = child.valueEnd;
  }

  return children;
}

function parseName(node: Asn1Node | undefined, bytes: Uint8Array): CertificateName {
  const fields: CertificateName = {
    commonName: "",
    organization: "",
    organizationalUnit: "",
    country: "",
  };

  if (!node) {
    return fields;
  }

  for (const setNode of node.children) {
    for (const sequence of setNode.children) {
      const oid = decodeOid(sequence.children[0], bytes);
      const valueNode = sequence.children[1];
      const value = valueNode ? decodeString(valueNode, bytes) : "";

      if (oid === "2.5.4.3") fields.commonName = value;
      if (oid === "2.5.4.10") fields.organization = value;
      if (oid === "2.5.4.11") fields.organizationalUnit = value;
      if (oid === "2.5.4.6") fields.country = value;
    }
  }

  return fields;
}

function parseAsn1Time(node: Asn1Node | undefined, bytes: Uint8Array): string {
  if (!node) {
    return "";
  }

  const value = byteString(bytes, node.valueStart, node.valueEnd);

  if (node.tag === 0x17) {
    const match = value.match(/^(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})Z$/);

    if (!match) {
      return value;
    }

    const year = Number(match[1]) >= 50 ? `19${match[1]}` : `20${match[1]}`;
    return new Date(`${year}-${match[2]}-${match[3]}T${match[4]}:${match[5]}:${match[6]}Z`).toISOString();
  }

  if (node.tag === 0x18) {
    const match = value.match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})Z$/);

    if (!match) {
      return value;
    }

    return new Date(`${match[1]}-${match[2]}-${match[3]}T${match[4]}:${match[5]}:${match[6]}Z`).toISOString();
  }

  return value;
}

function parseSubjectAltNames(tbs: Asn1Node, bytes: Uint8Array): string[] {
  const extensionsWrapper = tbs.children.find((child) => child.tagClass === 2 && child.tagNumber === 3);
  const extensions = extensionsWrapper?.children[0];

  if (!extensions) {
    return [];
  }

  for (const extensionNode of extensions.children) {
    const oid = decodeOid(extensionNode.children[0], bytes);

    if (oid !== "2.5.29.17") {
      continue;
    }

    const valueNode = extensionNode.children.find((child) => child.tag === 0x04);

    if (!valueNode) {
      return [];
    }

    const names = parseChildren(bytes, valueNode.valueStart, valueNode.valueEnd)[0];

    return names.children
      .filter((child) => child.tagClass === 2 && child.tagNumber === 2)
      .map((child) => byteString(bytes, child.valueStart, child.valueEnd));
  }

  return [];
}

function decodeOid(node: Asn1Node | undefined, bytes: Uint8Array): string {
  if (!node) {
    return "";
  }

  const values = Array.from(bytes.slice(node.valueStart, node.valueEnd));
  const first = values.shift();

  if (first === undefined) {
    return "";
  }

  const oid = [Math.floor(first / 40), first % 40];
  let current = 0;

  for (const value of values) {
    current = (current << 7) | (value & 0x7f);

    if ((value & 0x80) === 0) {
      oid.push(current);
      current = 0;
    }
  }

  return oid.join(".");
}

function decodeString(node: Asn1Node, bytes: Uint8Array): string {
  if (node.tag === 0x0c) {
    return new TextDecoder().decode(bytes.slice(node.valueStart, node.valueEnd));
  }

  if (node.tag === 0x1e) {
    const chars: string[] = [];

    for (let index = node.valueStart; index < node.valueEnd; index += 2) {
      chars.push(String.fromCharCode((bytes[index] << 8) + bytes[index + 1]));
    }

    return chars.join("");
  }

  return byteString(bytes, node.valueStart, node.valueEnd);
}

function byteString(bytes: Uint8Array, start: number, end: number): string {
  return Array.from(bytes.slice(start, end))
    .map((byte) => String.fromCharCode(byte))
    .join("");
}
