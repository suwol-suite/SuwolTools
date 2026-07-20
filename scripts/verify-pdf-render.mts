import { readFile, writeFile } from "node:fs/promises";
import { renderPdfPages } from "../apps/desktop/src/main/pdf-rendering";

const pages = await renderPdfPages(new Uint8Array(await readFile("tmp/pdfs/sample-3-pages.pdf")), { scale: 0.5, format: "png" });
console.log(JSON.stringify(pages.map((page) => ({ index: page.index, bytes: page.data.byteLength, mimeType: page.mimeType }))));
for (const page of pages) await writeFile(`output/pdf/sample-page-${page.index + 1}.png`, page.data);
