export type ParsedQueryParam = {
  key: string;
  value: string;
};

export type ParsedUrl = {
  href: string;
  protocol: string;
  username: string;
  password: string;
  hostname: string;
  port: string;
  pathname: string;
  search: string;
  hash: string;
  origin: string;
  queryParams: ParsedQueryParam[];
};

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function getUrlCandidate(input: string): string {
  const trimmed = input.trim();

  if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed) || trimmed.startsWith("//")) {
    return trimmed;
  }

  if (/^[\w.-]+\.[a-z]{2,}([/:?#]|$)/i.test(trimmed)) {
    return `https://${trimmed}`;
  }

  return trimmed;
}

export function parseUrlInput(input: string, decodeValues: boolean): ParsedUrl {
  const candidate = getUrlCandidate(input);
  const parsed = new URL(candidate, "https://example.com");
  const decode = decodeValues ? safeDecode : (value: string) => value;

  return {
    href: decode(parsed.href),
    protocol: parsed.protocol,
    username: decode(parsed.username),
    password: decode(parsed.password),
    hostname: parsed.hostname,
    port: parsed.port,
    pathname: decode(parsed.pathname),
    search: decode(parsed.search),
    hash: decode(parsed.hash),
    origin: parsed.origin,
    queryParams: Array.from(parsed.searchParams.entries()).map(([key, value]) => ({
      key: decode(key),
      value: decode(value),
    })),
  };
}
