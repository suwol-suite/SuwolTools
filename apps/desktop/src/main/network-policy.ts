import dns from "node:dns/promises";
import http from "node:http";
import https from "node:https";
import net from "node:net";
import tls from "node:tls";
import { analyzePingTrace, calculateIpv4Subnet, parsePemCertificate, searchPorts } from "@legacy/lib/networkTools";

const MAX_RESPONSE_BYTES = 2 * 1024 * 1024;
const REQUEST_TIMEOUT_MS = 10_000;
const MAX_REDIRECTS = 5;
const ALLOWED_PORTS = new Set([21, 22, 25, 53, 80, 110, 143, 443, 465, 587, 993, 995, 8080]);

type Address = { address: string; family: number };
type RestrictedResponse = { status: number; statusText: string; headers: Headers; body: Uint8Array };
const activeRequests = new Map<string, Set<() => void>>();

export type LocalNetworkMode = "ip" | "ports" | "trace" | "certificate";

export async function localNetworkDiagnostic(mode: LocalNetworkMode, value: string, options: { prefix?: string; protocol?: "all" | "TCP" | "UDP" } = {}): Promise<unknown> {
  if (value.length > 2 * 1024 * 1024) throw new Error("Local network input is too large.");
  if (mode === "ip") {
    const [address, embeddedPrefix] = value.trim().split("/");
    const prefix = options.prefix?.trim() || embeddedPrefix || "24";
    return calculateIpv4Subnet(address ?? "", prefix);
  }
  if (mode === "ports") return searchPorts(value.trim(), options.protocol ?? "all");
  if (mode === "trace") return analyzePingTrace(value);
  return parsePemCertificate(value);
}

function isPrivateAddress(value: string): boolean {
  const normalized = value.toLowerCase().replace(/^\[|\]$/g, "");
  if (normalized === "localhost" || normalized.endsWith(".localhost") || normalized.endsWith(".local") || normalized.endsWith(".lan")) return true;
  if (net.isIPv4(normalized)) {
    const [a = 0, b = 0] = normalized.split(".").map(Number);
    return a === 10 || a === 127 || a === 0 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 198 && (b === 18 || b === 19)) || a >= 224;
  }
  if (net.isIPv6(normalized)) return normalized === "::1" || normalized.startsWith("fc") || normalized.startsWith("fd") || normalized.startsWith("fe80:") || normalized.startsWith("ff") || normalized === "::";
  return false;
}

async function resolvePublicAddresses(hostname: string): Promise<Address[]> {
  if (isPrivateAddress(hostname)) throw new Error("Local, private, link-local, or metadata targets are blocked.");
  const addresses = await dns.lookup(hostname, { all: true, verbatim: true }).catch(() => [] as Address[]);
  return validateResolvedAddresses(addresses);
}

export function validateResolvedAddresses(addresses: Array<{ address: string; family?: number }>): Address[] {
  if (addresses.length === 0) throw new Error("The hostname could not be resolved.");
  if (addresses.some((address) => isPrivateAddress(address.address))) throw new Error("The hostname resolves to a blocked network target.");
  return addresses.map((address) => ({ address: address.address, family: address.family ?? (net.isIPv6(address.address) ? 6 : 4) }));
}

export async function validateNetworkUrl(value: string): Promise<URL> {
  const trimmed = value.trim();
  if (!trimmed) throw new Error("URL is required.");
  const url = new URL(trimmed.includes("://") ? trimmed : `https://${trimmed}`);
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("Only http and https are allowed.");
  if (url.username || url.password) throw new Error("Credentials in URLs are not allowed.");
  await resolvePublicAddresses(url.hostname);
  return url;
}

function responseHeaders(value: http.IncomingHttpHeaders): Headers {
  const headers = new Headers();
  for (const [name, raw] of Object.entries(value)) if (raw !== undefined) headers.set(name, Array.isArray(raw) ? raw.join(", ") : String(raw));
  return headers;
}

async function requestBound(url: URL, method: "HEAD" | "GET", requestId?: string): Promise<RestrictedResponse> {
  const addresses = await resolvePublicAddresses(url.hostname);
  const selected = addresses[0]!;
  const transport = url.protocol === "https:" ? https : http;
  return new Promise<RestrictedResponse>((resolve, reject) => {
    let settled = false; let total = 0; const chunks: Buffer[] = [];
    const finish = (error?: Error, response?: RestrictedResponse) => { if (settled) return; settled = true; if (error) reject(error); else resolve(response!); };
    const request = transport.request({ hostname: selected.address, port: Number(url.port) || (url.protocol === "https:" ? 443 : 80), path: `${url.pathname}${url.search}`, method, headers: { host: url.host, accept: method === "GET" ? "text/html,application/xhtml+xml" : "*/*", "user-agent": "SuwolTools/0.1" }, lookup: (_hostname, _options, callback) => callback(null, selected.address, selected.family), servername: url.hostname, rejectUnauthorized: true }, (response) => {
      const length = Number(response.headers["content-length"] ?? 0); if (length > MAX_RESPONSE_BYTES) { response.resume(); finish(new Error("The response is larger than the safety limit.")); return; }
      response.on("data", (chunk: Buffer) => { total += chunk.byteLength; if (total > MAX_RESPONSE_BYTES) { request.destroy(new Error("The response is larger than the safety limit.")); return; } if (method === "GET") chunks.push(chunk); });
      response.once("end", () => finish(undefined, { status: response.statusCode ?? 0, statusText: response.statusMessage ?? "", headers: responseHeaders(response.headers), body: Buffer.concat(chunks) }));
      response.once("error", (error) => finish(error));
    });
    const cancel = () => request.destroy(new Error("Network request cancelled."));
    if (requestId) { const set = activeRequests.get(requestId) ?? new Set<() => void>(); set.add(cancel); activeRequests.set(requestId, set); }
    const timer = setTimeout(() => request.destroy(new Error("Network request timed out.")), REQUEST_TIMEOUT_MS);
    const cleanup = () => { clearTimeout(timer); if (requestId) { const set = activeRequests.get(requestId); set?.delete(cancel); if (set?.size === 0) activeRequests.delete(requestId); } };
    request.once("close", cleanup); request.once("error", (error) => finish(error)); request.end();
  });
}

async function request(url: URL, mode: "headers" | "redirect" | "open-graph", requestId?: string): Promise<{ response: RestrictedResponse; finalUrl: URL; redirects: string[] }> {
  let current = url; const redirects: string[] = [];
  for (let index = 0; index <= MAX_REDIRECTS; index += 1) {
    const response = await requestBound(current, mode === "open-graph" ? "GET" : "HEAD", requestId);
    if (![301, 302, 303, 307, 308].includes(response.status)) return { response, finalUrl: current, redirects };
    const location = response.headers.get("location"); if (!location) return { response, finalUrl: current, redirects };
    const next = await validateNetworkUrl(new URL(location, current).toString()); redirects.push(next.toString()); current = next;
  }
  throw new Error("Too many redirects.");
}

function extractMeta(html: string): Record<string, string> {
  const result: Record<string, string> = {}; const title = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1]?.replace(/<[^>]+>/g, "").trim(); if (title) result.title = title;
  for (const match of html.matchAll(/<meta\s+[^>]*(?:property|name)=["']([^"']+)["'][^>]*content=["']([^"']*)["'][^>]*>/gi)) result[match[1]!.toLowerCase()] = match[2]!;
  for (const match of html.matchAll(/<meta\s+[^>]*content=["']([^"']*)["'][^>]*(?:property|name)=["']([^"']+)["'][^>]*>/gi)) result[match[2]!.toLowerCase()] = match[1]!;
  return result;
}

async function dnsLookup(value: string, recordType: string): Promise<Record<string, unknown>> {
  const url = await validateNetworkUrl(value); const hostname = url.hostname; await resolvePublicAddresses(hostname);
  const type = ["A", "AAAA", "CNAME", "MX", "TXT", "NS", "SOA", "CAA"].includes(recordType) ? recordType : "A";
  const resolver = dns as unknown as Record<string, (name: string) => Promise<unknown>>;
  const method = type === "A" ? "resolve4" : type === "AAAA" ? "resolve6" : `resolve${type[0]! + type.slice(1).toLowerCase()}`;
  const records = await resolver[method]?.(hostname).catch(() => []) ?? [];
  return { hostname, recordType: type, records };
}

async function tlsInfo(value: string, requestId?: string): Promise<Record<string, unknown>> {
  const url = await validateNetworkUrl(value); const addresses = await resolvePublicAddresses(url.hostname); const selected = addresses[0]!;
  return new Promise((resolve, reject) => {
    const socket = tls.connect({ host: selected.address, port: Number(url.port) || 443, servername: url.hostname, rejectUnauthorized: false, timeout: REQUEST_TIMEOUT_MS });
    const cancel = () => socket.destroy(new Error("Network request cancelled.")); const set = requestId ? (activeRequests.get(requestId) ?? new Set<() => void>()) : undefined; if (set && requestId) { set.add(cancel); activeRequests.set(requestId, set); }
    const cleanup = () => { if (set && requestId) { set.delete(cancel); if (set.size === 0) activeRequests.delete(requestId); } };
    socket.once("secureConnect", () => { const certificate = socket.getPeerCertificate(true); resolve({ hostname: url.hostname, address: selected.address, authorized: socket.authorized, authorizationError: socket.authorizationError ?? null, protocol: socket.getProtocol(), cipher: socket.getCipher(), certificate: { subject: certificate.subject, issuer: certificate.issuer, validFrom: certificate.valid_from, validTo: certificate.valid_to, fingerprint256: certificate.fingerprint256, subjectaltname: certificate.subjectaltname } }); socket.end(); });
    socket.once("timeout", () => { cleanup(); socket.destroy(); reject(new Error("TLS request timed out.")); }); socket.once("error", (error) => { cleanup(); reject(error); }); socket.once("close", cleanup);
  });
}

async function portCheck(value: string, portValue: number, requestId?: string): Promise<Record<string, unknown>> {
  const url = await validateNetworkUrl(value); const port = Math.round(portValue); if (!ALLOWED_PORTS.has(port)) throw new Error("This port is outside the allowed diagnostic set."); const addresses = await resolvePublicAddresses(url.hostname); const selected = addresses[0]!;
  return new Promise((resolve) => { const socket = net.createConnection({ host: selected.address, port, timeout: REQUEST_TIMEOUT_MS }); const cancel = () => socket.destroy(); const set = requestId ? (activeRequests.get(requestId) ?? new Set<() => void>()) : undefined; if (set && requestId) { set.add(cancel); activeRequests.set(requestId, set); } const cleanup = () => { if (set && requestId) { set.delete(cancel); if (set.size === 0) activeRequests.delete(requestId); } }; socket.once("connect", () => { cleanup(); socket.end(); resolve({ hostname: url.hostname, address: selected.address, port, open: true }); }); socket.once("timeout", () => { cleanup(); socket.destroy(); resolve({ hostname: url.hostname, address: selected.address, port, open: false, error: "timeout" }); }); socket.once("error", (error) => { cleanup(); resolve({ hostname: url.hostname, address: selected.address, port, open: false, error: error.message }); }); });
}

export function cancelNetworkRequest(requestId: string): boolean {
  const requests = activeRequests.get(requestId); if (!requests) return false; for (const cancel of requests) cancel(); activeRequests.delete(requestId); return true;
}

export async function restrictedNetworkRequest(value: string, mode: "headers" | "redirect" | "open-graph" | "dns" | "tls" | "port" | "url-parse", options: { requestId?: string; recordType?: string; port?: number } = {}) {
  if (mode === "url-parse") { const url = new URL(value.trim().includes("://") ? value.trim() : `https://${value.trim()}`); if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("Only http and https are allowed."); if (url.username || url.password || isPrivateAddress(url.hostname)) throw new Error("Local, private, link-local, metadata, or credential targets are blocked."); return { href: url.href, protocol: url.protocol, hostname: url.hostname, port: url.port || (url.protocol === "https:" ? "443" : "80"), pathname: url.pathname, search: url.search, hash: url.hash }; }
  if (mode === "dns") return dnsLookup(value, options.recordType ?? "A");
  if (mode === "tls") return tlsInfo(value, options.requestId);
  if (mode === "port") return portCheck(value, options.port ?? 443, options.requestId);
  const inputUrl = await validateNetworkUrl(value); const result = await request(inputUrl, mode, options.requestId); const headers = [...result.response.headers.entries()].map(([name, headerValue]) => ({ name, value: headerValue }));
  const base = { inputUrl: inputUrl.toString(), finalUrl: result.finalUrl.toString(), status: result.response.status, statusText: result.response.statusText, headers, redirects: result.redirects };
  if (mode !== "open-graph") return base;
  const contentType = result.response.headers.get("content-type") ?? ""; if (!contentType.includes("text/html") && !contentType.includes("application/xhtml+xml")) throw new Error("The response is not HTML.");
  return { ...base, meta: extractMeta(new TextDecoder().decode(result.response.body)) };
}
