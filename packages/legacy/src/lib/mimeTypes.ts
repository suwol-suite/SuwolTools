export type MimeTypeEntry = {
  extension: string;
  mimeType: string;
  category: "image" | "text" | "application" | "audio" | "video" | "font";
  description: string;
};

export const mimeTypeEntries: MimeTypeEntry[] = [
  { extension: ".html", mimeType: "text/html", category: "text", description: "HTML document" },
  { extension: ".css", mimeType: "text/css", category: "text", description: "CSS stylesheet" },
  { extension: ".js", mimeType: "text/javascript", category: "text", description: "JavaScript file" },
  { extension: ".json", mimeType: "application/json", category: "application", description: "JSON data" },
  { extension: ".xml", mimeType: "application/xml", category: "application", description: "XML document" },
  { extension: ".txt", mimeType: "text/plain", category: "text", description: "Plain text" },
  { extension: ".csv", mimeType: "text/csv", category: "text", description: "CSV data" },
  { extension: ".png", mimeType: "image/png", category: "image", description: "PNG image" },
  { extension: ".jpg", mimeType: "image/jpeg", category: "image", description: "JPEG image" },
  { extension: ".jpeg", mimeType: "image/jpeg", category: "image", description: "JPEG image" },
  { extension: ".webp", mimeType: "image/webp", category: "image", description: "WebP image" },
  { extension: ".gif", mimeType: "image/gif", category: "image", description: "GIF image" },
  { extension: ".svg", mimeType: "image/svg+xml", category: "image", description: "SVG image" },
  { extension: ".pdf", mimeType: "application/pdf", category: "application", description: "PDF document" },
  { extension: ".zip", mimeType: "application/zip", category: "application", description: "ZIP archive" },
  { extension: ".mp3", mimeType: "audio/mpeg", category: "audio", description: "MP3 audio" },
  { extension: ".mp4", mimeType: "video/mp4", category: "video", description: "MP4 video" },
  { extension: ".woff", mimeType: "font/woff", category: "font", description: "WOFF font" },
  { extension: ".woff2", mimeType: "font/woff2", category: "font", description: "WOFF2 font" },
];

export function filterMimeTypes(query: string, category: string): MimeTypeEntry[] {
  const normalizedQuery = query.trim().toLowerCase();

  return mimeTypeEntries.filter((entry) => {
    const matchesCategory = category === "all" || entry.category === category;
    const haystack = `${entry.extension} ${entry.mimeType} ${entry.description}`.toLowerCase();
    return matchesCategory && (!normalizedQuery || haystack.includes(normalizedQuery));
  });
}
