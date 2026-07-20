export type ParsedUserAgent = {
  browser: string;
  version: string;
  os: string;
  device: "desktop" | "mobile" | "tablet" | "bot" | "unknown";
  engine: string;
  isBot: boolean;
};

function firstMatch(input: string, patterns: Array<[RegExp, string]>): { name: string; version: string } {
  for (const [pattern, name] of patterns) {
    const match = input.match(pattern);

    if (match) {
      return {
        name,
        version: (match[1] ?? "").replace(/_/g, "."),
      };
    }
  }

  return {
    name: "Unknown",
    version: "",
  };
}

function parseBrowser(userAgent: string): { name: string; version: string } {
  return firstMatch(userAgent, [
    [/(?:Edg|EdgiOS|EdgA)\/([\d.]+)/, "Microsoft Edge"],
    [/(?:OPR|Opera)\/([\d.]+)/, "Opera"],
    [/SamsungBrowser\/([\d.]+)/, "Samsung Internet"],
    [/Firefox\/([\d.]+)/, "Firefox"],
    [/FxiOS\/([\d.]+)/, "Firefox iOS"],
    [/CriOS\/([\d.]+)/, "Chrome iOS"],
    [/Chrome\/([\d.]+)/, "Chrome"],
    [/Version\/([\d.]+).*Safari\//, "Safari"],
    [/(?:MSIE |rv:)([\d.]+).*Trident/, "Internet Explorer"],
  ]);
}

function parseOs(userAgent: string): string {
  const checks: Array<[RegExp, (match: RegExpMatchArray) => string]> = [
    [/Windows NT ([\d.]+)/, (match) => `Windows ${match[1]}`],
    [/Mac OS X ([\d_]+)/, (match) => `macOS ${match[1].replace(/_/g, ".")}`],
    [/(?:iPhone|iPad|iPod).*OS ([\d_]+)/, (match) => `iOS ${match[1].replace(/_/g, ".")}`],
    [/Android ([\d.]+)/, (match) => `Android ${match[1]}`],
    [/CrOS [^ ]+ ([\d.]+)/, (match) => `Chrome OS ${match[1]}`],
    [/Linux/, () => "Linux"],
  ];

  for (const [pattern, format] of checks) {
    const match = userAgent.match(pattern);

    if (match) {
      return format(match);
    }
  }

  return "Unknown";
}

function parseEngine(userAgent: string): string {
  return firstMatch(userAgent, [
    [/AppleWebKit\/([\d.]+)/, "WebKit"],
    [/Gecko\/([\d.]+)/, "Gecko"],
    [/Trident\/([\d.]+)/, "Trident"],
  ]).name;
}

function parseDevice(userAgent: string, isBot: boolean): ParsedUserAgent["device"] {
  if (isBot) {
    return "bot";
  }

  if (/iPad|Tablet|PlayBook|Silk|Kindle|Android(?!.*Mobile)/i.test(userAgent)) {
    return "tablet";
  }

  if (/Mobi|iPhone|iPod|Android.*Mobile|Windows Phone/i.test(userAgent)) {
    return "mobile";
  }

  if (/Windows|Macintosh|Linux|CrOS/i.test(userAgent)) {
    return "desktop";
  }

  return "unknown";
}

export function parseUserAgent(userAgent: string): ParsedUserAgent {
  const trimmed = userAgent.trim();

  if (!trimmed) {
    throw new Error("empty");
  }

  const isBot = /bot|crawler|spider|slurp|bingpreview|facebookexternalhit|discordbot/i.test(trimmed);
  const browser = parseBrowser(trimmed);

  return {
    browser: browser.name,
    version: browser.version,
    os: parseOs(trimmed),
    device: parseDevice(trimmed, isBot),
    engine: parseEngine(trimmed),
    isBot,
  };
}
