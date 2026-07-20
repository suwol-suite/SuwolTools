export type CssOutputMode = "class" | "inline";

export type CssDeclaration = {
  property: string;
  value: string;
};

export type CssRule = {
  selector: string;
  declarations: CssDeclaration[];
};

export type CssColorStop = {
  id: string;
  color: string;
  position: number;
};

export type CssGradientType = "linear" | "radial" | "conic";
export type BackgroundPatternType = "dots" | "grid" | "diagonal" | "stripes" | "checkerboard";

export type CssSnippetDefinition = {
  id: string;
  titleKey: string;
  descriptionKey: string;
  css: string;
};

const defaultClassName = "suwol-css-box";

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function formatNumber(value: number): string {
  return Number(value.toFixed(3)).toString();
}

export function sanitizeClassName(value: string, fallback = defaultClassName): string {
  const cleaned = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-_]+|[-_]+$/g, "");

  if (!cleaned) return fallback;
  if (/^[a-z_]/.test(cleaned)) return cleaned;

  return `${fallback}-${cleaned}`;
}

export function rgbaFromHex(hex: string, opacity: number): string {
  const raw = hex.replace("#", "").trim();
  const normalized =
    raw.length === 3
      ? raw
          .split("")
          .map((part) => `${part}${part}`)
          .join("")
      : raw.padEnd(6, "0").slice(0, 6);
  const value = Number.parseInt(normalized, 16);
  const red = (value >> 16) & 255;
  const green = (value >> 8) & 255;
  const blue = value & 255;
  const alpha = formatNumber(clamp(opacity, 0, 100) / 100);

  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

export function formatCssDeclarations(declarations: CssDeclaration[], indent = "  "): string {
  return declarations
    .filter((declaration) => declaration.value.trim().length > 0)
    .map((declaration) => `${indent}${declaration.property}: ${declaration.value};`)
    .join("\n");
}

export function buildCssOutput({
  className,
  declarations,
  outputMode,
  extraRules = [],
}: {
  className: string;
  declarations: CssDeclaration[];
  outputMode: CssOutputMode;
  extraRules?: CssRule[];
}): string {
  if (outputMode === "inline") {
    return formatCssDeclarations(declarations, "");
  }

  const selector = `.${sanitizeClassName(className)}`;
  const baseRule = `${selector} {\n${formatCssDeclarations(declarations)}\n}`;
  const nestedRules = extraRules
    .map((rule) => `${selector}${rule.selector} {\n${formatCssDeclarations(rule.declarations)}\n}`)
    .join("\n\n");

  return nestedRules ? `${baseRule}\n\n${nestedRules}` : baseRule;
}

function formatStops(stops: CssColorStop[]): string {
  return stops
    .slice()
    .sort((left, right) => left.position - right.position)
    .map((stop) => `${stop.color} ${clamp(stop.position, 0, 100)}%`)
    .join(", ");
}

export function buildGradientValue(options: {
  type: CssGradientType;
  angle: number;
  radialShape: "circle" | "ellipse";
  position: string;
  repeating: boolean;
  stops: CssColorStop[];
}): string {
  const functionName = `${options.repeating ? "repeating-" : ""}${options.type}-gradient`;
  const stops = formatStops(options.stops);

  if (options.type === "radial") {
    return `${functionName}(${options.radialShape} at ${options.position}, ${stops})`;
  }

  if (options.type === "conic") {
    return `${functionName}(from ${options.angle}deg at ${options.position}, ${stops})`;
  }

  return `${functionName}(${options.angle}deg, ${stops})`;
}

export function buildBoxShadowValue(options: {
  xOffset: number;
  yOffset: number;
  blur: number;
  spread: number;
  color: string;
  opacity: number;
  inset: boolean;
}): string {
  const inset = options.inset ? "inset " : "";

  return `${inset}${options.xOffset}px ${options.yOffset}px ${options.blur}px ${options.spread}px ${rgbaFromHex(
    options.color,
    options.opacity,
  )}`;
}

export function buildTextShadowValue(options: {
  xOffset: number;
  yOffset: number;
  blur: number;
  color: string;
  opacity: number;
}): string {
  return `${options.xOffset}px ${options.yOffset}px ${options.blur}px ${rgbaFromHex(options.color, options.opacity)}`;
}

export function buildRadiusValue(options: {
  topLeft: number;
  topRight: number;
  bottomRight: number;
  bottomLeft: number;
}): string {
  return `${options.topLeft}px ${options.topRight}px ${options.bottomRight}px ${options.bottomLeft}px`;
}

export function buildTransformValue(options: {
  translateX: number;
  translateY: number;
  rotate: number;
  scale: number;
  skewX: number;
  skewY: number;
}): string {
  return [
    `translate(${options.translateX}px, ${options.translateY}px)`,
    `rotate(${options.rotate}deg)`,
    `scale(${formatNumber(options.scale)})`,
    `skew(${options.skewX}deg, ${options.skewY}deg)`,
  ].join(" ");
}

export function buildFilterValue(options: {
  blur: number;
  brightness: number;
  contrast: number;
  grayscale: number;
  hueRotate: number;
  invert: number;
  saturate: number;
  sepia: number;
}): string {
  return [
    `blur(${options.blur}px)`,
    `brightness(${options.brightness}%)`,
    `contrast(${options.contrast}%)`,
    `grayscale(${options.grayscale}%)`,
    `hue-rotate(${options.hueRotate}deg)`,
    `invert(${options.invert}%)`,
    `saturate(${options.saturate}%)`,
    `sepia(${options.sepia}%)`,
  ].join(" ");
}

export function buildBackgroundPattern(options: {
  type: BackgroundPatternType;
  patternColor: string;
  backgroundColor: string;
  opacity: number;
  size: number;
}): CssDeclaration[] {
  const color = rgbaFromHex(options.patternColor, options.opacity);
  const size = Math.max(4, options.size);
  const stripeWidth = Math.max(2, Math.round(size / 4));

  if (options.type === "dots") {
    return [
      { property: "background-color", value: options.backgroundColor },
      { property: "background-image", value: `radial-gradient(${color} 2px, transparent 2px)` },
      { property: "background-size", value: `${size}px ${size}px` },
    ];
  }

  if (options.type === "grid") {
    return [
      { property: "background-color", value: options.backgroundColor },
      {
        property: "background-image",
        value: `linear-gradient(${color} 1px, transparent 1px), linear-gradient(90deg, ${color} 1px, transparent 1px)`,
      },
      { property: "background-size", value: `${size}px ${size}px` },
    ];
  }

  if (options.type === "checkerboard") {
    return [
      { property: "background-color", value: options.backgroundColor },
      {
        property: "background-image",
        value: `linear-gradient(45deg, ${color} 25%, transparent 25%), linear-gradient(-45deg, ${color} 25%, transparent 25%), linear-gradient(45deg, transparent 75%, ${color} 75%), linear-gradient(-45deg, transparent 75%, ${color} 75%)`,
      },
      {
        property: "background-position",
        value: `0 0, 0 ${size / 2}px, ${size / 2}px -${size / 2}px, -${size / 2}px 0px`,
      },
      { property: "background-size", value: `${size}px ${size}px` },
    ];
  }

  if (options.type === "stripes") {
    return [
      {
        property: "background",
        value: `repeating-linear-gradient(135deg, ${color} 0 ${stripeWidth}px, transparent ${stripeWidth}px ${size}px), ${options.backgroundColor}`,
      },
    ];
  }

  return [
    {
      property: "background",
      value: `repeating-linear-gradient(45deg, ${color} 0 2px, transparent 2px ${size}px), ${options.backgroundColor}`,
    },
  ];
}

export const cssSnippetDefinitions: CssSnippetDefinition[] = [
  {
    id: "visually-hidden",
    titleKey: "tools.cssGenerator.snippetVisuallyHidden",
    descriptionKey: "tools.cssGenerator.snippetVisuallyHiddenDescription",
    css: `.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}`,
  },
  {
    id: "focus-ring",
    titleKey: "tools.cssGenerator.snippetFocusRing",
    descriptionKey: "tools.cssGenerator.snippetFocusRingDescription",
    css: `.focus-ring:focus-visible {
  outline: 3px solid #14b8a6;
  outline-offset: 3px;
}`,
  },
  {
    id: "line-clamp",
    titleKey: "tools.cssGenerator.snippetLineClamp",
    descriptionKey: "tools.cssGenerator.snippetLineClampDescription",
    css: `.line-clamp-3 {
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}`,
  },
  {
    id: "responsive-grid",
    titleKey: "tools.cssGenerator.snippetResponsiveGrid",
    descriptionKey: "tools.cssGenerator.snippetResponsiveGridDescription",
    css: `.responsive-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 1rem;
}`,
  },
];
