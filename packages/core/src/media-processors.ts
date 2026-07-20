import JSZip from "jszip";
import { PDFDocument, StandardFonts, degrees, rgb } from "pdf-lib";
import type { ProcessedOutput, ResolvedInput, ToolProcessor } from "./types";

const encoder = new TextEncoder();
function stem(name: string): string { return name.replace(/\.[^/.]+$/, ""); }
function output(input: ResolvedInput, data: Uint8Array, name: string, mimeType: string): ProcessedOutput { return { name, data, mimeType }; }
function stringOption(options: Record<string, unknown>, key: string, fallback: string): string { return typeof options[key] === "string" ? options[key] as string : fallback; }
function numberOption(options: Record<string, unknown>, key: string, fallback: number): number { return typeof options[key] === "number" && Number.isFinite(options[key]) ? options[key] as number : fallback; }
function boolOption(options: Record<string, unknown>, key: string, fallback: boolean): boolean { return typeof options[key] === "boolean" ? options[key] as boolean : fallback; }
function arrayOption(options: Record<string, unknown>, key: string): Record<string, unknown>[] { return Array.isArray(options[key]) ? options[key].filter((value): value is Record<string, unknown> => Boolean(value && typeof value === "object")) : []; }
function pageIndices(value: string, pageCount: number): number[] {
  const pages: number[] = [];
  for (const part of value.split(",")) {
    const values = part.trim().split("-").map(Number);
    const start = Number.isFinite(values[0]) ? Math.floor(values[0]!) : 0;
    const end = Number.isFinite(values[1]) ? Math.floor(values[1]!) : start;
    if (start < 1 || end < start) continue;
    for (let page = start; page <= end && page <= pageCount; page += 1) if (page >= 1) pages.push(page - 1);
  }
  return [...new Set(pages)];
}
function pdfColor(value: unknown): ReturnType<typeof rgb> {
  const match = typeof value === "string" ? /^#?([0-9a-f]{6})$/i.exec(value.trim()) : undefined;
  if (!match) return rgb(0, 0, 0);
  return rgb(Number.parseInt(match[1]!.slice(0, 2), 16) / 255, Number.parseInt(match[1]!.slice(2, 4), 16) / 255, Number.parseInt(match[1]!.slice(4, 6), 16) / 255);
}

async function zipFiles(files: Array<{ name: string; data: Uint8Array }>): Promise<Uint8Array> {
  const zip = new JSZip();
  for (const file of files) zip.file(file.name, file.data);
  return zip.generateAsync({ type: "uint8array", compression: "DEFLATE", compressionOptions: { level: 6 } });
}

const appIconDefinitions = [
  ["favicon-16x16.png", 16], ["favicon-32x32.png", 32], ["favicon-48x48.png", 48], ["apple-touch-icon.png", 180], ["apple-touch-icon-152x152.png", 152], ["apple-touch-icon-167x167.png", 167], ["android-chrome-192x192.png", 192], ["android-chrome-512x512.png", 512], ["pwa-icon-192x192.png", 192], ["pwa-icon-512x512.png", 512], ["maskable-icon-192x192.png", 192], ["maskable-icon-512x512.png", 512], ["windows-icon-256.png", 256], ["macos-icon-512.png", 512],
] as const;
function selected(options: Record<string, unknown>, value: string): boolean { return Array.isArray(options.selectedPresets) ? options.selectedPresets.includes(value) : true; }
function appIconProcessor(): ToolProcessor {
  return async (input, options, context) => {
    if (!context.imageCodec) throw new Error("Image codec is unavailable.");
    const source = await input.read();
    const files: Array<{ name: string; data: Uint8Array }> = [];
    let largestPng: Uint8Array | undefined;
    for (const [name, size] of appIconDefinitions) {
      await context.waitIfPaused?.();
      const preset = name.startsWith("favicon") ? "favicon" : name.startsWith("apple") ? "ios" : name.startsWith("android") || name.startsWith("pwa") ? "androidPwa" : name.startsWith("maskable") ? "maskable" : "includeSource";
      if (!selected(options, preset)) continue;
      const paddingPercent = name.startsWith("maskable") && boolOption(options, "applyMaskableSafeArea", true)
        ? Math.max(18, numberOption(options, "paddingPercent", 10))
        : numberOption(options, "paddingPercent", 10);
      const image = await context.imageCodec.convert(source, { outputFormat: "png", width: size, height: size, fitMode: stringOption(options, "fitMode", "cover"), backgroundMode: stringOption(options, "backgroundMode", "transparent"), backgroundColor: stringOption(options, "backgroundColor", "#ffffff"), paddingPercent, cornerRadiusMode: stringOption(options, "cornerRadiusMode", "none"), maskable: name.startsWith("maskable") });
      files.push({ name, data: image.data });
      if (size >= 512 && !name.startsWith("maskable")) largestPng = image.data;
    }
    if (selected(options, "androidPwa") || selected(options, "maskable")) {
      const icons = files.filter((file) => file.name.includes("android-chrome") || file.name.includes("maskable-icon")).map((file) => ({ src: `/${file.name}`, sizes: `${file.name.match(/(\d+)x\1/)?.[1] ?? "192"}x${file.name.match(/(\d+)x\1/)?.[1] ?? "192"}`, type: "image/png", ...(file.name.startsWith("maskable") ? { purpose: "maskable" } : {}) }));
      files.push({ name: "site.webmanifest", data: encoder.encode(JSON.stringify({ icons, theme_color: stringOption(options, "themeColor", "#111827"), background_color: stringOption(options, "manifestBackgroundColor", "#ffffff"), start_url: stringOption(options, "startUrl", "/"), display: stringOption(options, "display", "standalone"), ...(stringOption(options, "appName", "").trim() ? { name: stringOption(options, "appName", "").trim() } : {}), ...(stringOption(options, "shortName", "").trim() ? { short_name: stringOption(options, "shortName", "").trim() } : {}) }, null, 2)) });
    }
    const htmlLines = [] as string[];
    if (selected(options, "favicon")) htmlLines.push("<link rel=\"icon\" type=\"image/png\" sizes=\"16x16\" href=\"/favicon-16x16.png\">", "<link rel=\"icon\" type=\"image/png\" sizes=\"32x32\" href=\"/favicon-32x32.png\">", "<link rel=\"icon\" type=\"image/png\" sizes=\"48x48\" href=\"/favicon-48x48.png\">");
    if (selected(options, "ios")) htmlLines.push("<link rel=\"apple-touch-icon\" sizes=\"180x180\" href=\"/apple-touch-icon.png\">");
    if (selected(options, "androidPwa") || selected(options, "maskable")) htmlLines.push("<link rel=\"manifest\" href=\"/site.webmanifest\">");
    if (htmlLines.length) files.push({ name: "icons.html", data: encoder.encode(htmlLines.join("\n")) });
    if (largestPng && context.iconCodec) {
      files.push({ name: "app-icon.ico", data: context.iconCodec.createIco(largestPng) });
      files.push({ name: "app-icon.icns", data: context.iconCodec.createIcns(largestPng) });
    }
    if (selected(options, "includeSource")) files.push({ name: `source-original.${input.name.split(".").pop() ?? "png"}`, data: source });
    return [output(input, await zipFiles(files), `${stem(input.name)}-app-icons.zip`, "application/zip")];
  };
}

const androidSizes = [48, 72, 96, 144, 192];
const androidDensities = ["mdpi", "hdpi", "xhdpi", "xxhdpi", "xxxhdpi"] as const;
const adaptiveSizes = [108, 162, 216, 324, 432];
const notificationSizes = [24, 36, 48, 72, 96];
const splashSizes = [160, 240, 320, 480, 640];
const playStoreAssets = [
  ["play-store/play-store-icon.png", 512, 512, "contain"],
  ["play-store/feature-graphic.png", 1024, 500, "contain"],
  ["play-store/promo-graphic.png", 180, 120, "contain"],
  ["play-store/tv-banner.png", 1280, 720, "contain"],
] as const;
function androidProcessor(): ToolProcessor {
  return async (input, options, context) => {
    if (!context.imageCodec) throw new Error("Image codec is unavailable.");
    const source = await input.read(); const files: Array<{ name: string; data: Uint8Array }> = [];
    const groups = Array.isArray(options.selectedGroups) ? options.selectedGroups : ["legacy", "round", "adaptive", "notification", "splash", "playStore"];
    const prefix = stringOption(options, "prefix", "").trim().toLowerCase().replace(/[^a-z0-9_]+/g, "_").replace(/^_+|_+$/g, "").replace(/_+/g, "_");
    const safePrefix = prefix && /^[a-z]/.test(prefix) ? prefix : prefix ? `a_${prefix}` : "";
    const name = (base: string) => safePrefix ? `${safePrefix}_${base}` : base;
    const fitMode = stringOption(options, "fitMode", "cover");
    const backgroundMode = stringOption(options, "backgroundMode", "transparent");
    const backgroundColor = stringOption(options, "backgroundColor", "#ffffff");
    const paddingPercent = numberOption(options, "paddingPercent", 8);
    if (groups.includes("legacy") || groups.includes("round")) for (let densityIndex = 0; densityIndex < androidSizes.length; densityIndex += 1) {
      const size = androidSizes[densityIndex]!;
      await context.waitIfPaused?.();
      const folder = `mipmap-${androidDensities[densityIndex]}`;
      if (groups.includes("legacy")) files.push({ name: `res/${folder}/${name("ic_launcher")}.png`, data: (await context.imageCodec.convert(source, { outputFormat: "png", width: size, height: size, fitMode, backgroundMode, backgroundColor, paddingPercent, cornerRadiusMode: stringOption(options, "maskMode", "none") })).data });
      if (groups.includes("round")) files.push({ name: `res/${folder}/${name("ic_launcher_round")}.png`, data: (await context.imageCodec.convert(source, { outputFormat: "png", width: size, height: size, fitMode, backgroundMode: "transparent", backgroundColor, paddingPercent, mask: "circle" })).data });
    }
    if (groups.includes("adaptive")) {
      for (let index = 0; index < adaptiveSizes.length; index += 1) {
        const size = adaptiveSizes[index]!;
        await context.waitIfPaused?.();
        files.push({ name: `mipmap-${androidDensities[index]}/${name("ic_launcher_foreground")}.png`, data: (await context.imageCodec.convert(source, { outputFormat: "png", width: size, height: size, fitMode, backgroundMode: "transparent", backgroundColor, paddingPercent: boolOption(options, "adaptiveSafeArea", true) ? Math.max(18, paddingPercent) : paddingPercent })).data });
      }
      files.push({ name: `res/drawable/${name("ic_launcher_background")}.xml`, data: encoder.encode(`<color xmlns:android=\"http://schemas.android.com/apk/res/android\">${backgroundColor}</color>`) });
      files.push({ name: `res/mipmap-anydpi-v26/${name("ic_launcher")}.xml`, data: encoder.encode(`<adaptive-icon xmlns:android=\"http://schemas.android.com/apk/res/android\"><background android:drawable=\"@drawable/${name("ic_launcher_background")}\"/><foreground android:drawable=\"@mipmap/${name("ic_launcher_foreground")}\"/></adaptive-icon>`) });
      files.push({ name: `res/mipmap-anydpi-v26/${name("ic_launcher_round")}.xml`, data: encoder.encode(`<adaptive-icon xmlns:android=\"http://schemas.android.com/apk/res/android\"><background android:drawable=\"@drawable/${name("ic_launcher_background")}\"/><foreground android:drawable=\"@mipmap/${name("ic_launcher_foreground")}\"/></adaptive-icon>`) });
    }
    if (groups.includes("notification")) for (let index = 0; index < notificationSizes.length; index += 1) { const size = notificationSizes[index]!; files.push({ name: `res/drawable-${androidDensities[index]}/${name("ic_notification")}.png`, data: (await context.imageCodec.convert(source, { outputFormat: "png", width: size, height: size, fitMode: "contain", backgroundMode: "transparent", notificationMode: stringOption(options, "notificationMode", "monochrome") })).data }); }
    if (groups.includes("splash")) for (let index = 0; index < splashSizes.length; index += 1) { const size = splashSizes[index]!; files.push({ name: `res/drawable-${androidDensities[index]}/${name("splash_logo")}.png`, data: (await context.imageCodec.convert(source, { outputFormat: "png", width: size, height: size, fitMode: "contain", backgroundMode, backgroundColor })).data }); }
    if (groups.includes("playStore")) for (const [fileName, width, height, storeFit] of playStoreAssets) files.push({ name: fileName, data: (await context.imageCodec.convert(source, { outputFormat: "png", width, height, fitMode: storeFit === "contain" ? stringOption(options, "storeFitMode", "contain") : "cover", backgroundMode: stringOption(options, "storeBackgroundMode", "average") === "color" ? "color" : stringOption(options, "storeBackgroundMode", "average"), backgroundColor })).data });
    files.push({ name: "manifest.json", data: encoder.encode(JSON.stringify({ tool: "android-app-asset-generator", options: { ...options, prefix: safePrefix }, files: files.map((file) => file.name) }, null, 2)) });
    files.push({ name: "README.txt", data: encoder.encode("Generated by Suwol Tools. Copy the res folder into app/src/main/res. Adaptive foreground/background and density variants are included when selected.\n") });
    return [output(input, await zipFiles(files), `${stem(input.name)}-android-assets.zip`, "application/zip")];
  };
}

const iosIconDefinitions = [
  ["iphone", "20x20", "2x", "icon-20@2x.png", 40], ["iphone", "20x20", "3x", "icon-20@3x.png", 60],
  ["iphone", "29x29", "2x", "icon-29@2x.png", 58], ["iphone", "29x29", "3x", "icon-29@3x.png", 87],
  ["iphone", "40x40", "2x", "icon-40@2x.png", 80], ["iphone", "40x40", "3x", "icon-40@3x.png", 120],
  ["iphone", "60x60", "2x", "icon-60@2x.png", 120], ["iphone", "60x60", "3x", "icon-60@3x.png", 180],
  ["ipad", "20x20", "1x", "icon-20@1x.png", 20], ["ipad", "20x20", "2x", "icon-20@2x.png", 40],
  ["ipad", "29x29", "1x", "icon-29@1x.png", 29], ["ipad", "29x29", "2x", "icon-29@2x.png", 58],
  ["ipad", "40x40", "1x", "icon-40@1x.png", 40], ["ipad", "40x40", "2x", "icon-40@2x.png", 80],
  ["ipad", "76x76", "1x", "icon-76@1x.png", 76], ["ipad", "76x76", "2x", "icon-76@2x.png", 152],
  ["ipad", "83.5x83.5", "2x", "icon-83.5@2x.png", 167], ["ios-marketing", "1024x1024", "1x", "icon-1024.png", 1024],
] as const;
function iosProcessor(): ToolProcessor {
  return async (input, options, context) => {
    if (!context.imageCodec) throw new Error("Image codec is unavailable.");
    const source = await input.read(); const files: Array<{ name: string; data: Uint8Array }> = []; const groups = Array.isArray(options.selectedGroups) ? options.selectedGroups : ["appIcon", "launchLogo", "appStore", "brandLogo", "splashColor"];
    const fitMode = stringOption(options, "fitMode", "cover"); const backgroundMode = stringOption(options, "backgroundMode", "color"); const backgroundColor = stringOption(options, "backgroundColor", "#ffffff"); const paddingPercent = numberOption(options, "paddingPercent", 0);
    const iconMetadata: Array<Record<string, string>> = [];
    if (groups.includes("appIcon")) for (const [idiom, size, scale, fileName, width] of iosIconDefinitions) { await context.waitIfPaused?.(); files.push({ name: `Assets.xcassets/AppIcon.appiconset/${fileName}`, data: (await context.imageCodec.convert(source, { outputFormat: "png", width, height: width, fitMode, backgroundMode, backgroundColor, paddingPercent })).data }); iconMetadata.push({ idiom, size, scale, filename: fileName }); }
    if (groups.includes("launchLogo")) {
      const baseSize = Math.max(1, numberOption(options, "launchLogoBaseSize", 200));
      for (const [fileName, , size] of [["launch-logo-1x.png", "1x", baseSize], ["launch-logo-2x.png", "2x", baseSize * 2], ["launch-logo-3x.png", "3x", baseSize * 3]] as const) files.push({ name: `Assets.xcassets/LaunchLogo.imageset/${fileName}`, data: (await context.imageCodec.convert(source, { outputFormat: "png", width: size, height: size, fitMode: "contain", backgroundMode: stringOption(options, "launchBackgroundMode", "transparent"), backgroundColor: stringOption(options, "launchBackgroundColor", "#ffffff") })).data });
      files.push({ name: "Assets.xcassets/LaunchLogo.imageset/Contents.json", data: encoder.encode(JSON.stringify({ images: ["1x", "2x", "3x"].map((scale) => ({ idiom: "universal", filename: `launch-logo-${scale}.png`, scale })), info: { author: "xcode", version: 1 } }, null, 2)) });
    }
    if (groups.includes("brandLogo")) { for (const [fileName, , size] of [["brand-logo-1x.png", "1x", 120], ["brand-logo-2x.png", "2x", 240], ["brand-logo-3x.png", "3x", 360]] as const) files.push({ name: `Assets.xcassets/BrandLogo.imageset/${fileName}`, data: (await context.imageCodec.convert(source, { outputFormat: "png", width: size, height: size, fitMode: "contain", backgroundMode: "transparent" })).data }); files.push({ name: "Assets.xcassets/BrandLogo.imageset/Contents.json", data: encoder.encode(JSON.stringify({ images: ["1x", "2x", "3x"].map((scale) => ({ idiom: "universal", filename: `brand-logo-${scale}.png`, scale })), info: { author: "xcode", version: 1 } }, null, 2)) }); }
    if (groups.includes("splashColor")) files.push({ name: "Assets.xcassets/SplashBackground.colorset/Contents.json", data: encoder.encode(JSON.stringify({ colors: [{ idiom: "universal", color: { "color-space": "srgb", components: { red: backgroundColor.slice(1, 3), green: backgroundColor.slice(3, 5), blue: backgroundColor.slice(5, 7), alpha: "1.000" } } }], info: { author: "xcode", version: 1 } }, null, 2)) });
    if (groups.includes("appStore")) for (const fileName of ["app-store-icon.png", "marketing-icon.png"]) files.push({ name: `AppStoreAssets/${fileName}`, data: (await context.imageCodec.convert(source, { outputFormat: "png", width: 1024, height: 1024, fitMode, backgroundMode, backgroundColor, paddingPercent })).data });
    if (groups.includes("appIcon")) files.push({ name: "Assets.xcassets/AppIcon.appiconset/Contents.json", data: encoder.encode(JSON.stringify({ images: iconMetadata, info: { author: "xcode", version: 1 } }, null, 2)) });
    files.push({ name: "AppStoreAssets/asset-manifest.json", data: encoder.encode(JSON.stringify({ tool: "ios-asset-generator", options, files: files.map((file) => file.name) }, null, 2)) });
    files.push({ name: "README.txt", data: encoder.encode("Generated by Suwol Tools. Add the Assets.xcassets catalog to the Xcode project. Contents.json keeps idiom, size, scale, and filename metadata.\n") });
    return [output(input, await zipFiles(files), `${stem(input.name)}-ios-assets.zip`, "application/zip")];
  };
}

function imageEditorProcessor(): ToolProcessor {
  return async (input, options, context) => {
    if (!context.imageCodec) throw new Error("Image codec is unavailable.");
    const operation = stringOption(options, "operation", "resize");
    if (operation === "save-project") {
      const project = { version: 1, source: input.name, canvas: { width: numberOption(options, "canvasWidth", 0), height: numberOption(options, "canvasHeight", 0) }, layers: arrayOption(options, "layers"), options };
      return [output(input, encoder.encode(JSON.stringify(project, null, 2)), `${stem(input.name)}.suwol-image.json`, "application/json;charset=utf-8")];
    }
    if (operation === "render-project" && context.imageCodec.renderProject) {
      const rendered = await context.imageCodec.renderProject(await input.read(), options);
      return [output(input, rendered.data, `${stem(input.name)}.${rendered.extension}`, rendered.mimeType)];
    }
    const result = await context.imageCodec.convert(await input.read(), { ...options, operation: stringOption(options, "operation", "resize"), outputFormat: stringOption(options, "outputFormat", "png"), fitMode: stringOption(options, "fitMode", "cover") });
    return [output(input, result.data, `${stem(input.name)}.${result.extension}`, result.mimeType)];
  };
}

function screenshotProcessor(): ToolProcessor {
  const processor: ToolProcessor = async (input, options, context) => {
    if (!context.imageCodec?.compose) throw new Error("Image composition codec is unavailable.");
    const inputs = context.inputs ?? [input]; const data: Uint8Array[] = []; for (const item of inputs) { await context.waitIfPaused?.(); data.push(await item.read()); }
      const result = await context.imageCodec.compose(data, { direction: stringOption(options, "direction", "vertical"), sizeMode: stringOption(options, "sizeMode", "first"), customSize: numberOption(options, "customSize", 1080), gap: numberOption(options, "gap", 12), outerPadding: numberOption(options, "outerPadding", 24), backgroundColor: stringOption(options, "backgroundColor", "#ffffff"), transparentBackground: boolOption(options, "transparentBackground", false), outputFormat: stringOption(options, "outputFormat", "png"), quality: numberOption(options, "quality", 92), redactions: arrayOption(options, "redactions"), overlap: numberOption(options, "overlap", 0), crop: options.crop && typeof options.crop === "object" ? options.crop : undefined });
    return [output(input, result.data, stringOption(options, "fileName", `${stem(input.name)}-stitched.${result.extension}`), result.mimeType)];
  };
  processor.batch = true;
  return processor;
}

function pdfProcessor(): ToolProcessor {
  const processor: ToolProcessor = async (input, options, context) => {
    const inputs = context.inputs ?? [input];
    const mode = stringOption(options, "mode", "merge");
    if (options.password || options.userPassword || options.ownerPassword) throw new Error("PDF password protection is not available in the current cross-platform PDF adapter. Remove the password option or use the web version.");
    const imageInputs = inputs.filter((item) => (item.mimeType ?? "").startsWith("image/") || /\.(png|jpe?g|webp)$/i.test(item.name));
    if (mode === "imageToPdf" || (imageInputs.length > 0 && inputs.length === imageInputs.length)) {
      if (!context.imageCodec) throw new Error("Image codec is unavailable for image-to-PDF.");
      const document = await PDFDocument.create();
      const margin = Math.max(0, numberOption(options, "margin", 24));
      const pageSize = stringOption(options, "pageSize", "image-fit");
      const orientation = stringOption(options, "orientation", "portrait");
      for (let index = 0; index < imageInputs.length; index += 1) {
        await context.waitIfPaused?.();
        const item = imageInputs[index]!;
        const image = await context.imageCodec.convert(await item.read(), { outputFormat: "jpeg", quality: numberOption(options, "quality", 92) });
        const embedded = await document.embedJpg(image.data);
        const original = { width: embedded.width + margin * 2, height: embedded.height + margin * 2 };
        const standard = pageSize === "letter" ? { width: 612, height: 792 } : { width: 595.28, height: 841.89 };
        const pageDimensions = pageSize === "a4" || pageSize === "letter" ? standard : original;
        const page = document.addPage(orientation === "landscape" ? [pageDimensions.height, pageDimensions.width] : [pageDimensions.width, pageDimensions.height]);
        const scale = pageSize === "image-fit" || pageSize === "original" ? 1 : Math.min((page.getWidth() - margin * 2) / embedded.width, (page.getHeight() - margin * 2) / embedded.height);
        const width = embedded.width * scale; const height = embedded.height * scale;
        page.drawImage(embedded, { x: (page.getWidth() - width) / 2, y: (page.getHeight() - height) / 2, width, height });
      }
      return [output(input, new Uint8Array(await document.save({ useObjectStreams: true })), stringOption(options, "outputName", `${stem(input.name)}.pdf`), "application/pdf")];
    }
    if (mode === "merge") {
      const merged = await PDFDocument.create();
      for (const item of inputs) { await context.waitIfPaused?.(); const source = await PDFDocument.load(await item.read(), { ignoreEncryption: true, updateMetadata: false }); const pages = await merged.copyPages(source, source.getPageIndices()); pages.forEach((page) => merged.addPage(page)); }
      return [output(input, new Uint8Array(await merged.save({ useObjectStreams: true })), stringOption(options, "outputName", `${stem(input.name)}_merged.pdf`), "application/pdf")];
    }
    const source = await PDFDocument.load(await input.read(), { ignoreEncryption: true, updateMetadata: false });
    const metadata = { pageCount: source.getPageCount(), title: source.getTitle() ?? "", author: source.getAuthor() ?? "", subject: source.getSubject() ?? "", keywords: source.getKeywords() ?? [], creator: source.getCreator() ?? "", producer: source.getProducer() ?? "", creationDate: source.getCreationDate()?.toISOString() ?? null, modificationDate: source.getModificationDate()?.toISOString() ?? null };
    if (mode === "metadata") return [output(input, encoder.encode(JSON.stringify(metadata, null, 2)), `${stem(input.name)}.json`, "application/json;charset=utf-8")];
    if (mode === "pdfToImage" || mode === "pdf-to-images") {
      if (!context.pdfCodec) throw new Error("PDF.js rendering is unavailable in this build.");
      const requestedPages = pageIndices(stringOption(options, "ranges", ""), source.getPageCount()).map((page) => page + 1);
      const rendered = await context.pdfCodec.renderPages(await input.read(), { pages: requestedPages.length ? requestedPages : undefined, scale: numberOption(options, "scale", 1), format: stringOption(options, "format", "png"), quality: numberOption(options, "quality", 92) });
      return rendered.map((page) => output(input, page.data, `${stem(input.name)}_page_${String(page.index + 1).padStart(3, "0")}.${page.extension}`, page.mimeType));
    }
    if (mode === "metadata-edit") {
      if (typeof options.title === "string") source.setTitle(options.title); if (typeof options.author === "string") source.setAuthor(options.author); if (typeof options.subject === "string") source.setSubject(options.subject); if (typeof options.creator === "string") source.setCreator(options.creator); if (typeof options.producer === "string") source.setProducer(options.producer); if (Array.isArray(options.keywords)) source.setKeywords(options.keywords.filter((value): value is string => typeof value === "string"));
      if (typeof options.creationDate === "string" && !Number.isNaN(Date.parse(options.creationDate))) source.setCreationDate(new Date(options.creationDate));
      if (typeof options.modificationDate === "string" && !Number.isNaN(Date.parse(options.modificationDate))) source.setModificationDate(new Date(options.modificationDate));
      return [output(input, new Uint8Array(await source.save({ useObjectStreams: stringOption(options, "compression", "on") !== "off" })), stringOption(options, "outputName", `${stem(input.name)}_metadata.pdf`), "application/pdf")];
    }
    const pageCount = source.getPageCount();
    const requested = pageIndices(stringOption(options, "ranges", ""), pageCount);
    const ranges = requested.length ? requested : Array.from({ length: pageCount }, (_, index) => index);
    if (mode === "split") {
      const outputs: ProcessedOutput[] = [];
      for (const pageIndex of ranges) {
        await context.waitIfPaused?.();
        const document = await PDFDocument.create();
        const [page] = await document.copyPages(source, [pageIndex]);
        document.addPage(page!);
        outputs.push(output(input, new Uint8Array(await document.save({ useObjectStreams: true })), `${stem(input.name)}_page_${String(pageIndex + 1).padStart(3, "0")}.pdf`, "application/pdf"));
      }
      return outputs;
    }
    if (mode === "extract" || mode === "select") {
      const document = await PDFDocument.create(); const pages = await document.copyPages(source, ranges); pages.forEach((page) => document.addPage(page));
      return [output(input, new Uint8Array(await document.save({ useObjectStreams: true })), stringOption(options, "outputName", `${stem(input.name)}_extract.pdf`), "application/pdf")];
    }
    if (mode === "rotate" || mode === "delete" || mode === "remove" || mode === "reorder") {
      const selectedPages = requested.length ? requested : Array.from({ length: pageCount }, (_, index) => index); const selectedSet = new Set(selectedPages);
      const explicitOrder = Array.isArray(options.pageOrder) ? options.pageOrder.filter((value): value is number => typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= pageCount).map((value) => value - 1) : [];
      const order = mode === "delete" || mode === "remove" ? Array.from({ length: pageCount }, (_, index) => index).filter((index) => !selectedSet.has(index)) : mode === "reorder" ? (explicitOrder.length ? explicitOrder : selectedPages) : Array.from({ length: pageCount }, (_, index) => index);
      const document = await PDFDocument.create(); const pages = await document.copyPages(source, order);
      pages.forEach((page, index) => { if (mode === "rotate" && (boolOption(options, "applyAll", false) || selectedSet.has(order[index]!))) page.setRotation(degrees(numberOption(options, "angle", 90))); document.addPage(page); });
      return [output(input, new Uint8Array(await document.save({ useObjectStreams: true })), stringOption(options, "outputName", `${stem(input.name)}_${mode}.pdf`), "application/pdf")];
    }
    if (mode === "watermark" || mode === "pageNumbers") {
      const document = await PDFDocument.load(await input.read(), { ignoreEncryption: true, updateMetadata: false });
      const font = await document.embedFont(StandardFonts.Helvetica); const pages = document.getPages();
      const selectedPages = requested.length ? new Set(requested) : new Set(pages.map((_, index) => index));
      pages.forEach((page, index) => {
        if (!selectedPages.has(index)) return;
        const { width, height } = page.getSize(); const fontSize = Math.max(6, numberOption(options, "fontSize", 24)); const opacity = Math.max(0, Math.min(1, numberOption(options, "opacity", 0.5))); const color = pdfColor(options.color);
        if (mode === "watermark") {
          const text = stringOption(options, "text", "Suwol Tools"); const textWidth = font.widthOfTextAtSize(text, fontSize); const position = stringOption(options, "position", "center"); const x = position.includes("left") ? 24 : position.includes("right") ? Math.max(24, width - textWidth - 24) : Math.max(24, (width - textWidth) / 2); const y = position.includes("top") ? height - fontSize - 24 : position.includes("bottom") ? 24 : Math.max(24, (height - fontSize) / 2); page.drawText(text, { x, y, size: fontSize, font, color, opacity, rotate: degrees(numberOption(options, "rotation", 0)) });
        } else {
          const number = index + 1 + numberOption(options, "startNumber", 1) - 1; const format = stringOption(options, "numberFormat", "plain"); const label = format === "page" ? `Page ${number}` : format === "padded" ? String(number).padStart(3, "0") : format === "total" ? `${number} / ${pages.length}` : String(number); const textWidth = font.widthOfTextAtSize(label, fontSize); page.drawText(label, { x: Math.max(12, (width - textWidth) / 2), y: Math.max(12, numberOption(options, "margin", 24)), size: fontSize, font, color, opacity });
        }
      });
      return [output(input, new Uint8Array(await document.save({ useObjectStreams: true })), stringOption(options, "outputName", `${stem(input.name)}_${mode}.pdf`), "application/pdf")];
    }
    if (mode === "compress") return [output(input, new Uint8Array(await source.save({ useObjectStreams: true, addDefaultPage: false })), stringOption(options, "outputName", `${stem(input.name)}_compressed.pdf`), "application/pdf")];
    const rawRanges = stringOption(options, "ranges", "").split(",").map((part) => pageIndices(part, pageCount)).filter((group) => group.length > 0);
    const splitRanges = rawRanges.length ? rawRanges : [Array.from({ length: pageCount }, (_, index) => index)];
    const outputs: ProcessedOutput[] = [];
    for (let index = 0; index < splitRanges.length; index += 1) { await context.waitIfPaused?.(); const document = await PDFDocument.create(); const pages = await document.copyPages(source, splitRanges[index]!); pages.forEach((page) => document.addPage(page)); outputs.push(output(input, new Uint8Array(await document.save({ useObjectStreams: true })), `${stem(input.name)}_pages_${index + 1}.pdf`, "application/pdf")); }
    return outputs;
  };
  processor.batch = true;
  return processor;
}

function gifProcessor(): ToolProcessor {
  return async (input, options, context) => {
    if (!context.imageCodec?.extractFrames) throw new Error("Animated image codec is unavailable.");
    await context.waitIfPaused?.();
    const extracted = await context.imageCodec.extractFrames(await input.read(), { outputFormat: stringOption(options, "outputFormat", "png"), frameRange: stringOption(options, "frameRange", ""), width: numberOption(options, "width", 0), height: numberOption(options, "height", 0), crop: options.crop });
    const byIndex = new Map(extracted.map((frame) => [frame.index, frame]));
    const frameOrder = Array.isArray(options.frameOrder) ? options.frameOrder.filter((value): value is number => typeof value === "number" && Number.isInteger(value) && byIndex.has(value)) : [];
    const frames = frameOrder.length ? frameOrder.map((index) => byIndex.get(index)!).filter(Boolean) : extracted;
    if (!frames.length) throw new Error("At least one GIF frame must remain.");
    const delays = options.frameDelays && typeof options.frameDelays === "object" ? options.frameDelays as Record<string, unknown> : {};
    if ((stringOption(options, "mode", "zip") === "gif" || stringOption(options, "saveMode", "zip") === "gif") && context.mediaCodec?.encodeFrames) {
      const encoded = await context.mediaCodec.encodeFrames(frames.map((frame) => ({ data: frame.data, delayMs: typeof delays[String(frame.index)] === "number" ? delays[String(frame.index)] as number : numberOption(options, "delayMs", 83) })), { outputFormat: "gif", fps: numberOption(options, "fps", 12), loop: boolOption(options, "loop", true), loopCount: numberOption(options, "loopCount", 0), quality: numberOption(options, "quality", 85) });
      return [{ filePath: encoded.filePath, size: encoded.size, name: `${stem(input.name)}-edited.gif`, mimeType: encoded.mimeType }];
    }
    const outputFormat = stringOption(options, "outputFormat", "png");
    const zip = await zipFiles(frames.map((frame) => ({ name: `${stem(input.name)}-${String(frame.index + 1).padStart(4, "0")}.${outputFormat === "jpeg" ? "jpg" : frame.extension}`, data: frame.data })));
    return [output(input, zip, `${stem(input.name)}-frames.zip`, "application/zip")];
  };
}

const mediaProcessors: Record<string, ToolProcessor> = { "app-icon-generator": appIconProcessor(), "android-asset-generator": androidProcessor(), "ios-asset-generator": iosProcessor(), "image-editor": imageEditorProcessor(), "screenshot-stitch-redact": screenshotProcessor(), "pdf-tools": pdfProcessor(), "gif-frame-editor": gifProcessor() };
export function getMediaProcessor(toolId: string): ToolProcessor | undefined { return mediaProcessors[toolId]; }
