export type SeoMetaInput = {
  title: string;
  description: string;
  keywords: string;
  canonicalUrl: string;
  robots: string;
  author: string;
};

export type OpenGraphInput = {
  title: string;
  description: string;
  url: string;
  image: string;
  siteName: string;
  type: string;
  twitterCard: string;
};

export function buildSeoMetaTags(input: SeoMetaInput): string {
  const lines: string[] = [];

  if (input.title.trim()) {
    lines.push(`<title>${escapeHtmlText(input.title.trim())}</title>`);
  }

  addMeta(lines, "description", input.description);
  addMeta(lines, "keywords", input.keywords);
  addMeta(lines, "robots", input.robots);
  addMeta(lines, "author", input.author);

  if (input.canonicalUrl.trim()) {
    lines.push(`<link rel="canonical" href="${escapeHtmlAttribute(input.canonicalUrl.trim())}">`);
  }

  return lines.join("\n");
}

export function buildOpenGraphTags(input: OpenGraphInput): string {
  const lines: string[] = [];

  addProperty(lines, "og:title", input.title);
  addProperty(lines, "og:description", input.description);
  addProperty(lines, "og:url", input.url);
  addProperty(lines, "og:image", input.image);
  addProperty(lines, "og:site_name", input.siteName);
  addProperty(lines, "og:type", input.type);
  addMeta(lines, "twitter:card", input.twitterCard);
  addMeta(lines, "twitter:title", input.title);
  addMeta(lines, "twitter:description", input.description);
  addMeta(lines, "twitter:image", input.image);

  return lines.join("\n");
}

function addMeta(lines: string[], name: string, content: string) {
  if (content.trim()) {
    lines.push(`<meta name="${name}" content="${escapeHtmlAttribute(content.trim())}">`);
  }
}

function addProperty(lines: string[], property: string, content: string) {
  if (content.trim()) {
    lines.push(`<meta property="${property}" content="${escapeHtmlAttribute(content.trim())}">`);
  }
}

function escapeHtmlText(input: string): string {
  return input.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function escapeHtmlAttribute(input: string): string {
  return escapeHtmlText(input).replace(/"/g, "&quot;");
}
