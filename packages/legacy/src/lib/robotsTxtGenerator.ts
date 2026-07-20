export type RobotsTxtMode = "allowAll" | "blockAll" | "custom";

export type RobotsTxtConfig = {
  mode: RobotsTxtMode;
  userAgent: string;
  allowPaths: string;
  disallowPaths: string;
  sitemapUrl: string;
  crawlDelay: string;
};

function splitPaths(input: string): string[] {
  return input
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

export function generateRobotsTxt(config: RobotsTxtConfig): string {
  const lines: string[] = [];
  const userAgent = config.mode === "custom" ? config.userAgent.trim() || "*" : "*";

  lines.push(`User-agent: ${userAgent}`);

  if (config.mode === "allowAll") {
    lines.push("Allow: /");
  } else if (config.mode === "blockAll") {
    lines.push("Disallow: /");
  } else {
    splitPaths(config.allowPaths).forEach((path) => lines.push(`Allow: ${path}`));
    splitPaths(config.disallowPaths).forEach((path) => lines.push(`Disallow: ${path}`));

    if (!config.allowPaths.trim() && !config.disallowPaths.trim()) {
      lines.push("Allow: /");
    }

    if (config.crawlDelay.trim()) {
      lines.push(`Crawl-delay: ${config.crawlDelay.trim()}`);
    }
  }

  if (config.sitemapUrl.trim()) {
    lines.push("");
    lines.push(`Sitemap: ${config.sitemapUrl.trim()}`);
  }

  return `${lines.join("\n")}\n`;
}
