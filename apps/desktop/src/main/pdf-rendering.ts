import { createCanvas, DOMMatrix, ImageData, Path2D } from "@napi-rs/canvas";
import { createRequire } from "node:module";
import path from "node:path";

type PdfPageResult = { data: Uint8Array; mimeType: "image/png" | "image/jpeg"; extension: "png" | "jpg"; index: number };

type PdfJsPage = {
  getViewport: (options: { scale: number }) => { width: number; height: number };
  render: (options: { canvasContext: unknown; viewport: unknown; canvasFactory?: unknown }) => { promise: Promise<void> };
};

type PdfJsDocument = {
  numPages: number;
  getPage: (pageNumber: number) => Promise<PdfJsPage>;
  destroy: () => Promise<void>;
};

const require = createRequire(import.meta.url);

function installCanvasGlobals(): void {
  const globals = globalThis as Record<string, unknown>;
  globals.DOMMatrix = DOMMatrix as unknown as Record<string, unknown>;
  globals.ImageData = ImageData as unknown as Record<string, unknown>;
  globals.Path2D = Path2D as unknown as Record<string, unknown>;
}

export async function renderPdfPages(data: Uint8Array, options: Record<string, unknown>, onProgress?: (fraction: number) => void): Promise<PdfPageResult[]> {
  installCanvasGlobals();
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const pdfjsRoot = path.dirname(require.resolve("pdfjs-dist/package.json"));
  const document = await pdfjs.getDocument({ data, isEvalSupported: false, useSystemFonts: false, disableFontFace: true, standardFontDataUrl: path.join(pdfjsRoot, "standard_fonts") + path.sep }).promise as unknown as PdfJsDocument;
  const pageCount = document.numPages;
  const requested = Array.isArray(options.pages)
    ? options.pages.filter((value): value is number => typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= pageCount)
    : Array.from({ length: pageCount }, (_, index) => index + 1);
  const pages = [...new Set(requested)].slice(0, Math.max(1, Math.min(500, Math.round(typeof options.maxPages === "number" ? options.maxPages : 500))));
  const scale = Math.max(0.08, Math.min(4, typeof options.scale === "number" && Number.isFinite(options.scale) ? options.scale : 1));
  const format = options.format === "jpeg" ? "jpeg" : "png";
  const quality = Math.max(1, Math.min(100, Math.round(typeof options.quality === "number" ? options.quality : 92)));
  const results: PdfPageResult[] = [];
  try {
    for (let index = 0; index < pages.length; index += 1) {
      const pageNumber = pages[index]!;
      const page = await document.getPage(pageNumber);
      const viewport = page.getViewport({ scale });
      const canvas = createCanvas(Math.max(1, Math.ceil(viewport.width)), Math.max(1, Math.ceil(viewport.height)));
      await page.render({ canvasContext: canvas.getContext("2d"), viewport }).promise;
      const buffer = format === "jpeg" ? canvas.toBuffer("image/jpeg", quality) : canvas.toBuffer("image/png");
      results.push({ data: new Uint8Array(buffer), mimeType: format === "jpeg" ? "image/jpeg" : "image/png", extension: format === "jpeg" ? "jpg" : "png", index: pageNumber - 1 });
      onProgress?.((index + 1) / Math.max(1, pages.length));
    }
  } finally {
    await document.destroy();
  }
  return results;
}
