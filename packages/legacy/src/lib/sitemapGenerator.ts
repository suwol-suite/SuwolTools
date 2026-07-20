export type SitemapChangefreq =
  | "always"
  | "hourly"
  | "daily"
  | "weekly"
  | "monthly"
  | "yearly"
  | "never";

export type SitemapGeneratorConfig = {
  urlsText: string;
  changefreq: SitemapChangefreq;
  priority: string;
  includeLastmod: boolean;
};

export type SitemapGeneratorResult = {
  xml: string;
  validUrls: string[];
  invalidUrls: string[];
};

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function normalizePriority(priority: string): string {
  const parsed = Number(priority);

  if (!Number.isFinite(parsed)) {
    return "0.7";
  }

  return Math.max(0, Math.min(1, parsed)).toFixed(1);
}

export function generateSitemapXml(config: SitemapGeneratorConfig): SitemapGeneratorResult {
  const urls = config.urlsText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const validUrls: string[] = [];
  const invalidUrls: string[] = [];

  urls.forEach((url) => {
    try {
      const parsed = new URL(url);

      if (parsed.protocol === "http:" || parsed.protocol === "https:") {
        validUrls.push(parsed.href);
      } else {
        invalidUrls.push(url);
      }
    } catch {
      invalidUrls.push(url);
    }
  });

  const lastmod = new Date().toISOString().slice(0, 10);
  const priority = normalizePriority(config.priority);
  const body = validUrls
    .map((url) => {
      const lines = [
        "  <url>",
        `    <loc>${escapeXml(url)}</loc>`,
        `    <changefreq>${config.changefreq}</changefreq>`,
        `    <priority>${priority}</priority>`,
      ];

      if (config.includeLastmod) {
        lines.push(`    <lastmod>${lastmod}</lastmod>`);
      }

      lines.push("  </url>");
      return lines.join("\n");
    })
    .join("\n");

  return {
    xml: `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`,
    validUrls,
    invalidUrls,
  };
}
