export type RgbColor = {
  r: number;
  g: number;
  b: number;
};

export type HslColor = {
  h: number;
  s: number;
  l: number;
};

export function parseHexColor(input: string): RgbColor | null {
  const normalized = input.trim().replace(/^#/, "");

  if (/^[0-9a-fA-F]{3}$/.test(normalized)) {
    const [r, g, b] = normalized.split("").map((value) => parseInt(value + value, 16));
    return { r, g, b };
  }

  if (/^[0-9a-fA-F]{6}$/.test(normalized)) {
    return {
      r: parseInt(normalized.slice(0, 2), 16),
      g: parseInt(normalized.slice(2, 4), 16),
      b: parseInt(normalized.slice(4, 6), 16),
    };
  }

  return null;
}

export function parseRgbColor(input: string): RgbColor | null {
  const values = input
    .trim()
    .replace(/^rgba?\(/i, "")
    .replace(/\)$/, "")
    .split(",")
    .map((value) => Number(value.trim()));

  if (values.length < 3 || values.slice(0, 3).some((value) => !Number.isFinite(value))) {
    return null;
  }

  const [r, g, b] = values;

  if ([r, g, b].some((value) => value < 0 || value > 255)) {
    return null;
  }

  return {
    r: Math.round(r),
    g: Math.round(g),
    b: Math.round(b),
  };
}

export function parseHslColor(input: string): RgbColor | null {
  const values = input
    .trim()
    .replace(/^hsla?\(/i, "")
    .replace(/\)$/, "")
    .split(",")
    .map((value) => Number(value.trim().replace("%", "")));

  if (values.length < 3 || values.slice(0, 3).some((value) => !Number.isFinite(value))) {
    return null;
  }

  const [h, s, l] = values;

  if (s < 0 || s > 100 || l < 0 || l > 100) {
    return null;
  }

  return hslToRgb({
    h: ((h % 360) + 360) % 360,
    s,
    l,
  });
}

export function rgbToHex(color: RgbColor): string {
  return `#${[color.r, color.g, color.b]
    .map((value) => Math.max(0, Math.min(255, value)).toString(16).padStart(2, "0"))
    .join("")}`;
}

export function rgbToHsl(color: RgbColor): HslColor {
  const r = color.r / 255;
  const g = color.g / 255;
  const b = color.b / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (delta !== 0) {
    s = delta / (1 - Math.abs(2 * l - 1));

    switch (max) {
      case r:
        h = 60 * (((g - b) / delta) % 6);
        break;
      case g:
        h = 60 * ((b - r) / delta + 2);
        break;
      case b:
      default:
        h = 60 * ((r - g) / delta + 4);
        break;
    }
  }

  return {
    h: Math.round((h + 360) % 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  };
}

export function hslToRgb(color: HslColor): RgbColor {
  const s = color.s / 100;
  const l = color.l / 100;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((color.h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0;
  let g = 0;
  let b = 0;

  if (color.h < 60) {
    r = c;
    g = x;
  } else if (color.h < 120) {
    r = x;
    g = c;
  } else if (color.h < 180) {
    g = c;
    b = x;
  } else if (color.h < 240) {
    g = x;
    b = c;
  } else if (color.h < 300) {
    r = x;
    b = c;
  } else {
    r = c;
    b = x;
  }

  return {
    r: Math.round((r + m) * 255),
    g: Math.round((g + m) * 255),
    b: Math.round((b + m) * 255),
  };
}

export function formatRgb(color: RgbColor): string {
  return `rgb(${color.r}, ${color.g}, ${color.b})`;
}

export function formatHsl(color: HslColor): string {
  return `hsl(${color.h}, ${color.s}%, ${color.l}%)`;
}

export function getContrastTextColor(color: RgbColor): "#000000" | "#ffffff" {
  const luminance = (0.299 * color.r + 0.587 * color.g + 0.114 * color.b) / 255;
  return luminance > 0.58 ? "#000000" : "#ffffff";
}
