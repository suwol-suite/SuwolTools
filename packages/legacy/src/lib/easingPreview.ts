export type EasingCategory =
  | "css"
  | "quad"
  | "cubic"
  | "quart"
  | "quint"
  | "sine"
  | "expo"
  | "circ"
  | "back"
  | "elastic"
  | "bounce"
  | "custom";

export type EasingPreviewType = "ball" | "box" | "scale" | "opacity" | "rotate" | "panel";
export type EasingPlayMode = "once" | "loop" | "pingpong";
export type EasingDirection = "normal" | "reverse" | "alternate" | "alternate-reverse";
export type EasingIterationCount = number | "infinite";
export type EasingCodeTarget = "transition" | "animation" | "js" | "raf" | "waapi" | "tailwind";

export type CubicBezierValue = {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
};

export type EasingDefinition = {
  id: string;
  category: EasingCategory;
  cssTiming?: string;
  approximateCssTiming?: string;
  hasOvershoot?: boolean;
  jsBody: string;
};

export type EasingPreviewState = {
  easingId: string;
  previewType: EasingPreviewType;
  durationMs: number;
  delayMs: number;
  distancePx: number;
  playMode: EasingPlayMode;
  direction: EasingDirection;
  iterationCount: EasingIterationCount;
  autoPlay: boolean;
  customBezier: CubicBezierValue;
  compareIds: string[];
};

export type EasingUsagePreset = {
  id: string;
  easingId: string;
  durationMs: number;
  delayMs: number;
  distancePx: number;
  playMode: EasingPlayMode;
  direction: EasingDirection;
  previewType: EasingPreviewType;
};

export type PlaybackSample = {
  rawProgress: number;
  easedProgress: number;
  elapsedMs: number;
  isComplete: boolean;
  currentIteration: number;
};

export const EASING_CATEGORIES: EasingCategory[] = [
  "css",
  "quad",
  "cubic",
  "quart",
  "quint",
  "sine",
  "expo",
  "circ",
  "back",
  "elastic",
  "bounce",
  "custom",
];

export const PREVIEW_TYPES: EasingPreviewType[] = ["ball", "box", "scale", "opacity", "rotate", "panel"];
export const PLAY_MODES: EasingPlayMode[] = ["once", "loop", "pingpong"];
export const DIRECTIONS: EasingDirection[] = ["normal", "reverse", "alternate", "alternate-reverse"];
export const CODE_TARGETS: EasingCodeTarget[] = ["transition", "animation", "js", "raf", "waapi", "tailwind"];
export const MAX_COMPARE_IDS = 6;
export const CUSTOM_EASING_ID = "customBezier";
export const CUSTOM_BEZIER_STORAGE_KEY = "suwol-easing-preview-custom-bezier";

export const DEFAULT_CUSTOM_BEZIER: CubicBezierValue = {
  x1: 0.25,
  y1: 0.1,
  x2: 0.25,
  y2: 1,
};

export const DEFAULT_EASING_STATE: EasingPreviewState = {
  easingId: "easeOutCubic",
  previewType: "ball",
  durationMs: 1000,
  delayMs: 0,
  distancePx: 300,
  playMode: "loop",
  direction: "normal",
  iterationCount: "infinite",
  autoPlay: true,
  customBezier: DEFAULT_CUSTOM_BEZIER,
  compareIds: ["linear", "easeOutCubic"],
};

const easings = {
  linear: (t: number) => t,
  easeInQuad: (t: number) => t * t,
  easeOutQuad: (t: number) => 1 - (1 - t) * (1 - t),
  easeInOutQuad: (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
  easeInCubic: (t: number) => t * t * t,
  easeOutCubic: (t: number) => 1 - Math.pow(1 - t, 3),
  easeInOutCubic: (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  easeInQuart: (t: number) => t * t * t * t,
  easeOutQuart: (t: number) => 1 - Math.pow(1 - t, 4),
  easeInOutQuart: (t: number) => (t < 0.5 ? 8 * t * t * t * t : 1 - Math.pow(-2 * t + 2, 4) / 2),
  easeInQuint: (t: number) => t * t * t * t * t,
  easeOutQuint: (t: number) => 1 - Math.pow(1 - t, 5),
  easeInOutQuint: (t: number) => (t < 0.5 ? 16 * t * t * t * t * t : 1 - Math.pow(-2 * t + 2, 5) / 2),
  easeInSine: (t: number) => 1 - Math.cos((t * Math.PI) / 2),
  easeOutSine: (t: number) => Math.sin((t * Math.PI) / 2),
  easeInOutSine: (t: number) => -(Math.cos(Math.PI * t) - 1) / 2,
  easeInExpo: (t: number) => (t === 0 ? 0 : Math.pow(2, 10 * t - 10)),
  easeOutExpo: (t: number) => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t)),
  easeInOutExpo: (t: number) =>
    t === 0 ? 0 : t === 1 ? 1 : t < 0.5 ? Math.pow(2, 20 * t - 10) / 2 : (2 - Math.pow(2, -20 * t + 10)) / 2,
  easeInCirc: (t: number) => 1 - Math.sqrt(1 - Math.pow(t, 2)),
  easeOutCirc: (t: number) => Math.sqrt(1 - Math.pow(t - 1, 2)),
  easeInOutCirc: (t: number) =>
    t < 0.5 ? (1 - Math.sqrt(1 - Math.pow(2 * t, 2))) / 2 : (Math.sqrt(1 - Math.pow(-2 * t + 2, 2)) + 1) / 2,
  easeInBack: (t: number) => {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return c3 * t * t * t - c1 * t * t;
  },
  easeOutBack: (t: number) => {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  },
  easeInOutBack: (t: number) => {
    const c1 = 1.70158;
    const c2 = c1 * 1.525;
    return t < 0.5
      ? (Math.pow(2 * t, 2) * ((c2 + 1) * 2 * t - c2)) / 2
      : (Math.pow(2 * t - 2, 2) * ((c2 + 1) * (t * 2 - 2) + c2) + 2) / 2;
  },
  easeInElastic: (t: number) => {
    const c4 = (2 * Math.PI) / 3;
    return t === 0 ? 0 : t === 1 ? 1 : -Math.pow(2, 10 * t - 10) * Math.sin((t * 10 - 10.75) * c4);
  },
  easeOutElastic: (t: number) => {
    const c4 = (2 * Math.PI) / 3;
    return t === 0 ? 0 : t === 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
  },
  easeInOutElastic: (t: number) => {
    const c5 = (2 * Math.PI) / 4.5;
    return t === 0
      ? 0
      : t === 1
        ? 1
        : t < 0.5
          ? -(Math.pow(2, 20 * t - 10) * Math.sin((20 * t - 11.125) * c5)) / 2
          : (Math.pow(2, -20 * t + 10) * Math.sin((20 * t - 11.125) * c5)) / 2 + 1;
  },
  easeOutBounce: (t: number) => {
    const n1 = 7.5625;
    const d1 = 2.75;
    if (t < 1 / d1) {
      return n1 * t * t;
    }
    if (t < 2 / d1) {
      return n1 * (t -= 1.5 / d1) * t + 0.75;
    }
    if (t < 2.5 / d1) {
      return n1 * (t -= 2.25 / d1) * t + 0.9375;
    }
    return n1 * (t -= 2.625 / d1) * t + 0.984375;
  },
};

function easeInBounce(t: number) {
  return 1 - easings.easeOutBounce(1 - t);
}

function easeInOutBounce(t: number) {
  return t < 0.5 ? (1 - easings.easeOutBounce(1 - 2 * t)) / 2 : (1 + easings.easeOutBounce(2 * t - 1)) / 2;
}

const cssBezierValues: Record<string, CubicBezierValue> = {
  ease: { x1: 0.25, y1: 0.1, x2: 0.25, y2: 1 },
  "ease-in": { x1: 0.42, y1: 0, x2: 1, y2: 1 },
  "ease-out": { x1: 0, y1: 0, x2: 0.58, y2: 1 },
  "ease-in-out": { x1: 0.42, y1: 0, x2: 0.58, y2: 1 },
};

export const EASING_DEFINITIONS: EasingDefinition[] = [
  { id: "linear", category: "css", cssTiming: "linear", jsBody: "return t;" },
  {
    id: "ease",
    category: "css",
    cssTiming: "ease",
    jsBody: "return cubicBezier(0.25, 0.1, 0.25, 1)(t);",
  },
  {
    id: "ease-in",
    category: "css",
    cssTiming: "ease-in",
    jsBody: "return cubicBezier(0.42, 0, 1, 1)(t);",
  },
  {
    id: "ease-out",
    category: "css",
    cssTiming: "ease-out",
    jsBody: "return cubicBezier(0, 0, 0.58, 1)(t);",
  },
  {
    id: "ease-in-out",
    category: "css",
    cssTiming: "ease-in-out",
    jsBody: "return cubicBezier(0.42, 0, 0.58, 1)(t);",
  },
  { id: "easeInQuad", category: "quad", approximateCssTiming: "cubic-bezier(0.55, 0.085, 0.68, 0.53)", jsBody: "return t * t;" },
  { id: "easeOutQuad", category: "quad", approximateCssTiming: "cubic-bezier(0.25, 0.46, 0.45, 0.94)", jsBody: "return 1 - (1 - t) * (1 - t);" },
  {
    id: "easeInOutQuad",
    category: "quad",
    approximateCssTiming: "cubic-bezier(0.455, 0.03, 0.515, 0.955)",
    jsBody: "return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;",
  },
  { id: "easeInCubic", category: "cubic", approximateCssTiming: "cubic-bezier(0.55, 0.055, 0.675, 0.19)", jsBody: "return t * t * t;" },
  { id: "easeOutCubic", category: "cubic", approximateCssTiming: "cubic-bezier(0.215, 0.61, 0.355, 1)", jsBody: "return 1 - Math.pow(1 - t, 3);" },
  {
    id: "easeInOutCubic",
    category: "cubic",
    approximateCssTiming: "cubic-bezier(0.645, 0.045, 0.355, 1)",
    jsBody: "return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;",
  },
  { id: "easeInQuart", category: "quart", approximateCssTiming: "cubic-bezier(0.895, 0.03, 0.685, 0.22)", jsBody: "return t * t * t * t;" },
  { id: "easeOutQuart", category: "quart", approximateCssTiming: "cubic-bezier(0.165, 0.84, 0.44, 1)", jsBody: "return 1 - Math.pow(1 - t, 4);" },
  {
    id: "easeInOutQuart",
    category: "quart",
    approximateCssTiming: "cubic-bezier(0.77, 0, 0.175, 1)",
    jsBody: "return t < 0.5 ? 8 * t * t * t * t : 1 - Math.pow(-2 * t + 2, 4) / 2;",
  },
  { id: "easeInQuint", category: "quint", approximateCssTiming: "cubic-bezier(0.755, 0.05, 0.855, 0.06)", jsBody: "return t * t * t * t * t;" },
  { id: "easeOutQuint", category: "quint", approximateCssTiming: "cubic-bezier(0.23, 1, 0.32, 1)", jsBody: "return 1 - Math.pow(1 - t, 5);" },
  {
    id: "easeInOutQuint",
    category: "quint",
    approximateCssTiming: "cubic-bezier(0.86, 0, 0.07, 1)",
    jsBody: "return t < 0.5 ? 16 * t * t * t * t * t : 1 - Math.pow(-2 * t + 2, 5) / 2;",
  },
  { id: "easeInSine", category: "sine", approximateCssTiming: "cubic-bezier(0.47, 0, 0.745, 0.715)", jsBody: "return 1 - Math.cos((t * Math.PI) / 2);" },
  { id: "easeOutSine", category: "sine", approximateCssTiming: "cubic-bezier(0.39, 0.575, 0.565, 1)", jsBody: "return Math.sin((t * Math.PI) / 2);" },
  {
    id: "easeInOutSine",
    category: "sine",
    approximateCssTiming: "cubic-bezier(0.445, 0.05, 0.55, 0.95)",
    jsBody: "return -(Math.cos(Math.PI * t) - 1) / 2;",
  },
  { id: "easeInExpo", category: "expo", approximateCssTiming: "cubic-bezier(0.95, 0.05, 0.795, 0.035)", jsBody: "return t === 0 ? 0 : Math.pow(2, 10 * t - 10);" },
  { id: "easeOutExpo", category: "expo", approximateCssTiming: "cubic-bezier(0.19, 1, 0.22, 1)", jsBody: "return t === 1 ? 1 : 1 - Math.pow(2, -10 * t);" },
  {
    id: "easeInOutExpo",
    category: "expo",
    approximateCssTiming: "cubic-bezier(1, 0, 0, 1)",
    jsBody:
      "return t === 0 ? 0 : t === 1 ? 1 : t < 0.5 ? Math.pow(2, 20 * t - 10) / 2 : (2 - Math.pow(2, -20 * t + 10)) / 2;",
  },
  { id: "easeInCirc", category: "circ", approximateCssTiming: "cubic-bezier(0.6, 0.04, 0.98, 0.335)", jsBody: "return 1 - Math.sqrt(1 - Math.pow(t, 2));" },
  { id: "easeOutCirc", category: "circ", approximateCssTiming: "cubic-bezier(0.075, 0.82, 0.165, 1)", jsBody: "return Math.sqrt(1 - Math.pow(t - 1, 2));" },
  {
    id: "easeInOutCirc",
    category: "circ",
    approximateCssTiming: "cubic-bezier(0.785, 0.135, 0.15, 0.86)",
    jsBody:
      "return t < 0.5 ? (1 - Math.sqrt(1 - Math.pow(2 * t, 2))) / 2 : (Math.sqrt(1 - Math.pow(-2 * t + 2, 2)) + 1) / 2;",
  },
  {
    id: "easeInBack",
    category: "back",
    approximateCssTiming: "cubic-bezier(0.6, -0.28, 0.735, 0.045)",
    hasOvershoot: true,
    jsBody: "const c1 = 1.70158; const c3 = c1 + 1; return c3 * t * t * t - c1 * t * t;",
  },
  {
    id: "easeOutBack",
    category: "back",
    approximateCssTiming: "cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    hasOvershoot: true,
    jsBody: "const c1 = 1.70158; const c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);",
  },
  {
    id: "easeInOutBack",
    category: "back",
    approximateCssTiming: "cubic-bezier(0.68, -0.55, 0.265, 1.55)",
    hasOvershoot: true,
    jsBody:
      "const c1 = 1.70158; const c2 = c1 * 1.525; return t < 0.5 ? (Math.pow(2 * t, 2) * ((c2 + 1) * 2 * t - c2)) / 2 : (Math.pow(2 * t - 2, 2) * ((c2 + 1) * (t * 2 - 2) + c2) + 2) / 2;",
  },
  {
    id: "easeInElastic",
    category: "elastic",
    hasOvershoot: true,
    jsBody:
      "const c4 = (2 * Math.PI) / 3; return t === 0 ? 0 : t === 1 ? 1 : -Math.pow(2, 10 * t - 10) * Math.sin((t * 10 - 10.75) * c4);",
  },
  {
    id: "easeOutElastic",
    category: "elastic",
    hasOvershoot: true,
    jsBody:
      "const c4 = (2 * Math.PI) / 3; return t === 0 ? 0 : t === 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;",
  },
  {
    id: "easeInOutElastic",
    category: "elastic",
    hasOvershoot: true,
    jsBody:
      "const c5 = (2 * Math.PI) / 4.5; return t === 0 ? 0 : t === 1 ? 1 : t < 0.5 ? -(Math.pow(2, 20 * t - 10) * Math.sin((20 * t - 11.125) * c5)) / 2 : (Math.pow(2, -20 * t + 10) * Math.sin((20 * t - 11.125) * c5)) / 2 + 1;",
  },
  {
    id: "easeInBounce",
    category: "bounce",
    jsBody: "return 1 - easeOutBounce(1 - t);",
  },
  {
    id: "easeOutBounce",
    category: "bounce",
    jsBody:
      "const n1 = 7.5625; const d1 = 2.75; if (t < 1 / d1) return n1 * t * t; if (t < 2 / d1) return n1 * (t -= 1.5 / d1) * t + 0.75; if (t < 2.5 / d1) return n1 * (t -= 2.25 / d1) * t + 0.9375; return n1 * (t -= 2.625 / d1) * t + 0.984375;",
  },
  {
    id: "easeInOutBounce",
    category: "bounce",
    jsBody: "return t < 0.5 ? (1 - easeOutBounce(1 - 2 * t)) / 2 : (1 + easeOutBounce(2 * t - 1)) / 2;",
  },
  {
    id: CUSTOM_EASING_ID,
    category: "custom",
    cssTiming: "cubic-bezier(0.25, 0.1, 0.25, 1)",
    jsBody: "return cubicBezier(x1, y1, x2, y2)(t);",
  },
];

export const EASING_USAGE_PRESETS: EasingUsagePreset[] = [
  {
    id: "buttonHover",
    easingId: "easeOutCubic",
    durationMs: 180,
    delayMs: 0,
    distancePx: 18,
    playMode: "once",
    direction: "normal",
    previewType: "scale",
  },
  {
    id: "modalOpen",
    easingId: "easeOutBack",
    durationMs: 420,
    delayMs: 0,
    distancePx: 120,
    playMode: "once",
    direction: "normal",
    previewType: "panel",
  },
  {
    id: "modalClose",
    easingId: "easeInCubic",
    durationMs: 240,
    delayMs: 0,
    distancePx: 100,
    playMode: "once",
    direction: "reverse",
    previewType: "opacity",
  },
  {
    id: "toastEnter",
    easingId: "easeOutQuart",
    durationMs: 360,
    delayMs: 0,
    distancePx: 180,
    playMode: "once",
    direction: "normal",
    previewType: "box",
  },
  {
    id: "dropdown",
    easingId: "easeOutCubic",
    durationMs: 240,
    delayMs: 0,
    distancePx: 90,
    playMode: "once",
    direction: "normal",
    previewType: "panel",
  },
  {
    id: "sidebar",
    easingId: "easeInOutCubic",
    durationMs: 520,
    delayMs: 0,
    distancePx: 300,
    playMode: "once",
    direction: "normal",
    previewType: "panel",
  },
  {
    id: "cardEnter",
    easingId: "easeOutExpo",
    durationMs: 480,
    delayMs: 60,
    distancePx: 80,
    playMode: "once",
    direction: "normal",
    previewType: "scale",
  },
  {
    id: "cardHover",
    easingId: "easeOutQuad",
    durationMs: 200,
    delayMs: 0,
    distancePx: 24,
    playMode: "pingpong",
    direction: "alternate",
    previewType: "box",
  },
  {
    id: "alertEmphasis",
    easingId: "easeOutElastic",
    durationMs: 800,
    delayMs: 0,
    distancePx: 60,
    playMode: "pingpong",
    direction: "alternate",
    previewType: "scale",
  },
  {
    id: "shake",
    easingId: "easeInOutSine",
    durationMs: 120,
    delayMs: 0,
    distancePx: 80,
    playMode: "loop",
    direction: "alternate",
    previewType: "box",
  },
  {
    id: "loading",
    easingId: "easeInOutSine",
    durationMs: 900,
    delayMs: 0,
    distancePx: 360,
    playMode: "loop",
    direction: "normal",
    previewType: "rotate",
  },
  {
    id: "gamePopup",
    easingId: "easeOutBack",
    durationMs: 520,
    delayMs: 0,
    distancePx: 120,
    playMode: "once",
    direction: "normal",
    previewType: "scale",
  },
];

const easingFunctionMap: Record<string, (t: number) => number> = {
  linear: easings.linear,
  easeInQuad: easings.easeInQuad,
  easeOutQuad: easings.easeOutQuad,
  easeInOutQuad: easings.easeInOutQuad,
  easeInCubic: easings.easeInCubic,
  easeOutCubic: easings.easeOutCubic,
  easeInOutCubic: easings.easeInOutCubic,
  easeInQuart: easings.easeInQuart,
  easeOutQuart: easings.easeOutQuart,
  easeInOutQuart: easings.easeInOutQuart,
  easeInQuint: easings.easeInQuint,
  easeOutQuint: easings.easeOutQuint,
  easeInOutQuint: easings.easeInOutQuint,
  easeInSine: easings.easeInSine,
  easeOutSine: easings.easeOutSine,
  easeInOutSine: easings.easeInOutSine,
  easeInExpo: easings.easeInExpo,
  easeOutExpo: easings.easeOutExpo,
  easeInOutExpo: easings.easeInOutExpo,
  easeInCirc: easings.easeInCirc,
  easeOutCirc: easings.easeOutCirc,
  easeInOutCirc: easings.easeInOutCirc,
  easeInBack: easings.easeInBack,
  easeOutBack: easings.easeOutBack,
  easeInOutBack: easings.easeInOutBack,
  easeInElastic: easings.easeInElastic,
  easeOutElastic: easings.easeOutElastic,
  easeInOutElastic: easings.easeInOutElastic,
  easeInBounce,
  easeOutBounce: easings.easeOutBounce,
  easeInOutBounce,
};

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function roundNumber(value: number, digits = 3) {
  const multiplier = 10 ** digits;
  return Math.round(value * multiplier) / multiplier;
}

export function formatBezier(bezier: CubicBezierValue) {
  return `cubic-bezier(${roundNumber(bezier.x1)}, ${roundNumber(bezier.y1)}, ${roundNumber(bezier.x2)}, ${roundNumber(bezier.y2)})`;
}

export function isEasingId(value: string | null | undefined): value is string {
  return Boolean(value && EASING_DEFINITIONS.some((definition) => definition.id === value));
}

export function getEasingDefinition(id: string) {
  return EASING_DEFINITIONS.find((definition) => definition.id === id) ?? EASING_DEFINITIONS[0];
}

export function makeCubicBezierFunction(x1: number, y1: number, x2: number, y2: number) {
  const sampleCurveX = (t: number) => ((1 - 3 * x2 + 3 * x1) * t + (3 * x2 - 6 * x1)) * t * t + 3 * x1 * t;
  const sampleCurveY = (t: number) => ((1 - 3 * y2 + 3 * y1) * t + (3 * y2 - 6 * y1)) * t * t + 3 * y1 * t;
  const sampleDerivativeX = (t: number) => (3 * (1 - 3 * x2 + 3 * x1) * t + 2 * (3 * x2 - 6 * x1)) * t + 3 * x1;

  return (x: number) => {
    const target = clamp(x, 0, 1);
    let t = target;

    for (let i = 0; i < 8; i += 1) {
      const xEstimate = sampleCurveX(t) - target;
      const derivative = sampleDerivativeX(t);
      if (Math.abs(xEstimate) < 0.000001 || Math.abs(derivative) < 0.000001) {
        break;
      }
      t -= xEstimate / derivative;
    }

    if (t < 0 || t > 1) {
      let lower = 0;
      let upper = 1;
      t = target;
      for (let i = 0; i < 20; i += 1) {
        const xEstimate = sampleCurveX(t);
        if (Math.abs(xEstimate - target) < 0.000001) {
          break;
        }
        if (target > xEstimate) {
          lower = t;
        } else {
          upper = t;
        }
        t = (upper + lower) / 2;
      }
    }

    return sampleCurveY(clamp(t, 0, 1));
  };
}

export function getEasingFunction(id: string, customBezier: CubicBezierValue = DEFAULT_CUSTOM_BEZIER) {
  if (id === CUSTOM_EASING_ID) {
    return makeCubicBezierFunction(customBezier.x1, customBezier.y1, customBezier.x2, customBezier.y2);
  }

  if (cssBezierValues[id]) {
    const bezier = cssBezierValues[id];
    return makeCubicBezierFunction(bezier.x1, bezier.y1, bezier.x2, bezier.y2);
  }

  return easingFunctionMap[id] ?? easingFunctionMap.linear;
}

export function getCssTimingFunction(id: string, customBezier: CubicBezierValue = DEFAULT_CUSTOM_BEZIER) {
  if (id === CUSTOM_EASING_ID) {
    return formatBezier(customBezier);
  }

  const definition = getEasingDefinition(id);
  return definition.cssTiming ?? definition.approximateCssTiming ?? "linear";
}

export function validateCubicBezier(bezier: CubicBezierValue) {
  return (
    Number.isFinite(bezier.x1) &&
    Number.isFinite(bezier.y1) &&
    Number.isFinite(bezier.x2) &&
    Number.isFinite(bezier.y2) &&
    bezier.x1 >= 0 &&
    bezier.x1 <= 1 &&
    bezier.x2 >= 0 &&
    bezier.x2 <= 1 &&
    bezier.y1 >= -2 &&
    bezier.y1 <= 3 &&
    bezier.y2 >= -2 &&
    bezier.y2 <= 3
  );
}

function isPreviewType(value: string | null): value is EasingPreviewType {
  return Boolean(value && PREVIEW_TYPES.includes(value as EasingPreviewType));
}

function isPlayMode(value: string | null): value is EasingPlayMode {
  return Boolean(value && PLAY_MODES.includes(value as EasingPlayMode));
}

function isDirection(value: string | null): value is EasingDirection {
  return Boolean(value && DIRECTIONS.includes(value as EasingDirection));
}

export function normalizeDuration(value: number) {
  return clamp(Math.round(value), 50, 10000);
}

export function normalizeDelay(value: number) {
  return clamp(Math.round(value), 0, 5000);
}

export function normalizeDistance(value: number) {
  return clamp(Math.round(value), 0, 900);
}

export function normalizeIterationCount(value: EasingIterationCount): EasingIterationCount {
  if (value === "infinite") {
    return "infinite";
  }

  return clamp(Math.round(value), 1, 99);
}

export function normalizeCompareIds(ids: string[], easingId = DEFAULT_EASING_STATE.easingId) {
  const validIds = ids.filter((id, index, list) => isEasingId(id) && list.indexOf(id) === index);
  const withCurrent = validIds.includes(easingId) ? validIds : [easingId, ...validIds];
  return withCurrent.slice(0, MAX_COMPARE_IDS);
}

export function normalizeEasingState(partial: Partial<EasingPreviewState>): EasingPreviewState {
  const easingId = isEasingId(partial.easingId) ? partial.easingId : DEFAULT_EASING_STATE.easingId;
  const previewType = partial.previewType && PREVIEW_TYPES.includes(partial.previewType)
    ? partial.previewType
    : DEFAULT_EASING_STATE.previewType;
  const playMode = partial.playMode && PLAY_MODES.includes(partial.playMode)
    ? partial.playMode
    : DEFAULT_EASING_STATE.playMode;
  const direction = partial.direction && DIRECTIONS.includes(partial.direction)
    ? partial.direction
    : DEFAULT_EASING_STATE.direction;
  const customBezier = partial.customBezier && validateCubicBezier(partial.customBezier)
    ? partial.customBezier
    : DEFAULT_CUSTOM_BEZIER;

  return {
    easingId,
    previewType,
    durationMs: normalizeDuration(partial.durationMs ?? DEFAULT_EASING_STATE.durationMs),
    delayMs: normalizeDelay(partial.delayMs ?? DEFAULT_EASING_STATE.delayMs),
    distancePx: normalizeDistance(partial.distancePx ?? DEFAULT_EASING_STATE.distancePx),
    playMode,
    direction,
    iterationCount: normalizeIterationCount(partial.iterationCount ?? DEFAULT_EASING_STATE.iterationCount),
    autoPlay: partial.autoPlay ?? DEFAULT_EASING_STATE.autoPlay,
    customBezier,
    compareIds: normalizeCompareIds(partial.compareIds ?? DEFAULT_EASING_STATE.compareIds, easingId),
  };
}

export function parseEasingStateSearchParams(search: string) {
  const params = new URLSearchParams(search);
  const easingParam = params.get("easing");
  const previewParam = params.get("preview");
  const modeParam = params.get("mode");
  const directionParam = params.get("direction");
  const customBezier = {
    x1: Number(params.get("x1") ?? DEFAULT_CUSTOM_BEZIER.x1),
    y1: Number(params.get("y1") ?? DEFAULT_CUSTOM_BEZIER.y1),
    x2: Number(params.get("x2") ?? DEFAULT_CUSTOM_BEZIER.x2),
    y2: Number(params.get("y2") ?? DEFAULT_CUSTOM_BEZIER.y2),
  };
  const iterationsParam = params.get("iterations");
  const iterationCount = iterationsParam === "infinite" ? "infinite" : Number(iterationsParam ?? DEFAULT_EASING_STATE.iterationCount);
  const compareIds = (params.get("compare") ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);

  return normalizeEasingState({
    easingId: isEasingId(easingParam) ? easingParam : undefined,
    previewType: isPreviewType(previewParam) ? previewParam : undefined,
    durationMs: Number(params.get("duration") ?? DEFAULT_EASING_STATE.durationMs),
    delayMs: Number(params.get("delay") ?? DEFAULT_EASING_STATE.delayMs),
    distancePx: Number(params.get("distance") ?? DEFAULT_EASING_STATE.distancePx),
    playMode: isPlayMode(modeParam) ? modeParam : undefined,
    direction: isDirection(directionParam) ? directionParam : undefined,
    iterationCount,
    autoPlay: params.get("auto") !== "0",
    customBezier,
    compareIds: compareIds.length > 0 ? compareIds : DEFAULT_EASING_STATE.compareIds,
  });
}

export function stateToSearchParams(state: EasingPreviewState) {
  const params = new URLSearchParams();
  params.set("easing", state.easingId);
  params.set("duration", String(state.durationMs));
  params.set("delay", String(state.delayMs));
  params.set("distance", String(state.distancePx));
  params.set("mode", state.playMode);
  params.set("direction", state.direction);
  params.set("preview", state.previewType);
  params.set("iterations", String(state.iterationCount));
  params.set("auto", state.autoPlay ? "1" : "0");
  params.set("compare", state.compareIds.join(","));
  params.set("x1", String(roundNumber(state.customBezier.x1)));
  params.set("y1", String(roundNumber(state.customBezier.y1)));
  params.set("x2", String(roundNumber(state.customBezier.x2)));
  params.set("y2", String(roundNumber(state.customBezier.y2)));
  return params;
}

export function stateToJson(state: EasingPreviewState) {
  return JSON.stringify(state, null, 2);
}

export function computePlaybackSample(
  elapsedMs: number,
  state: EasingPreviewState,
  easingFunction = getEasingFunction(state.easingId, state.customBezier),
): PlaybackSample {
  const duration = Math.max(1, state.durationMs);
  const delayedElapsed = elapsedMs - state.delayMs;
  const iterationCount =
    state.playMode === "once"
      ? state.iterationCount === "infinite"
        ? 1
        : state.iterationCount
      : state.iterationCount;

  if (delayedElapsed <= 0) {
    const rawProgress = state.direction === "reverse" || state.direction === "alternate-reverse" ? 1 : 0;
    return {
      rawProgress,
      easedProgress: easingFunction(rawProgress),
      elapsedMs: Math.max(0, elapsedMs),
      isComplete: false,
      currentIteration: 0,
    };
  }

  const cyclePosition = delayedElapsed / duration;
  const currentIteration = Math.floor(cyclePosition);
  const finiteIterations = iterationCount === "infinite" ? Infinity : iterationCount;
  const isComplete = currentIteration >= finiteIterations;
  const iterationIndex = isComplete ? Math.max(0, finiteIterations - 1) : currentIteration;
  let progress = isComplete ? 1 : cyclePosition - currentIteration;
  const direction = state.playMode === "pingpong" ? "alternate" : state.direction;

  if (direction === "reverse") {
    progress = 1 - progress;
  } else if (direction === "alternate") {
    progress = iterationIndex % 2 === 1 ? 1 - progress : progress;
  } else if (direction === "alternate-reverse") {
    progress = iterationIndex % 2 === 1 ? progress : 1 - progress;
  }

  if (isComplete && (direction === "reverse" || direction === "alternate-reverse")) {
    progress = finiteIterations % 2 === 0 && direction !== "reverse" ? 1 : 0;
  }

  const rawProgress = clamp(progress, 0, 1);

  return {
    rawProgress,
    easedProgress: easingFunction(rawProgress),
    elapsedMs: Math.max(0, elapsedMs),
    isComplete,
    currentIteration: isComplete ? Math.max(0, finiteIterations - 1) : currentIteration,
  };
}

export function makeGraphPoints(id: string, customBezier: CubicBezierValue, steps = 120) {
  const easing = getEasingFunction(id, customBezier);
  const points = [];

  for (let index = 0; index <= steps; index += 1) {
    const x = index / steps;
    points.push({ x, y: easing(x) });
  }

  return points;
}

export function getGraphBounds(ids: string[], customBezier: CubicBezierValue) {
  const allValues = ids.flatMap((id) => makeGraphPoints(id, customBezier, 80).map((point) => point.y));
  const min = Math.min(0, ...allValues);
  const max = Math.max(1, ...allValues);
  const padding = Math.max(0.12, (max - min) * 0.12);

  return {
    minY: roundNumber(min - padding, 2),
    maxY: roundNumber(max + padding, 2),
  };
}

export function getTransformForPreview(type: EasingPreviewType, eased: number, distancePx: number) {
  const distance = roundNumber(distancePx * eased, 2);

  if (type === "scale" || type === "panel") {
    const scale = roundNumber(0.5 + eased * 0.7, 3);
    return `translateX(${distance}px) scale(${scale})`;
  }

  if (type === "rotate") {
    return `rotate(${roundNumber(360 * eased, 2)}deg)`;
  }

  return `translateX(${distance}px)`;
}

export function getOpacityForPreview(type: EasingPreviewType, eased: number) {
  if (type === "opacity" || type === "panel") {
    return clamp(eased, 0, 1);
  }

  return 1;
}

function getKeyframesForType(type: EasingPreviewType, distancePx: number) {
  if (type === "opacity") {
    return ["opacity: 0;", "opacity: 1;"];
  }

  if (type === "scale") {
    return ["transform: scale(0.5);", "transform: scale(1.2);"];
  }

  if (type === "rotate") {
    return ["transform: rotate(0deg);", "transform: rotate(360deg);"];
  }

  if (type === "panel") {
    return [
      "opacity: 0;",
      "transform: translateY(24px) scale(0.96);",
      "opacity: 1;",
      "transform: translateY(0) scale(1);",
    ];
  }

  return [`transform: translateX(0);`, `transform: translateX(${distancePx}px);`];
}

export function generateCodeSnippets(state: EasingPreviewState) {
  const definition = getEasingDefinition(state.easingId);
  const timingFunction = getCssTimingFunction(state.easingId, state.customBezier);
  const iterationCount = state.iterationCount === "infinite" ? "infinite" : String(state.iterationCount);
  const direction = state.playMode === "pingpong" ? "alternate" : state.direction;
  const [fromLine, toLine, panelFromExtra = "", panelToExtra = ""] = getKeyframesForType(state.previewType, state.distancePx);
  const jsFunctionName = state.easingId.replace(/[^a-zA-Z0-9_$]/g, "_");
  const jsBody = definition.id === CUSTOM_EASING_ID
    ? `const ease = cubicBezier(${state.customBezier.x1}, ${state.customBezier.y1}, ${state.customBezier.x2}, ${state.customBezier.y2});\n  return ease(t);`
    : definition.jsBody;

  const transition = `.example {
  transition-property: ${state.previewType === "opacity" || state.previewType === "panel" ? "opacity, transform" : "transform"};
  transition-duration: ${state.durationMs}ms;
  transition-delay: ${state.delayMs}ms;
  transition-timing-function: ${timingFunction};
}`;

  const animation = `.example {
  animation-name: suwol-easing-preview;
  animation-duration: ${state.durationMs}ms;
  animation-delay: ${state.delayMs}ms;
  animation-iteration-count: ${state.playMode === "once" ? iterationCount : "infinite"};
  animation-direction: ${direction};
  animation-timing-function: ${timingFunction};
}

@keyframes suwol-easing-preview {
  from {
    ${fromLine}
    ${panelFromExtra}
  }
  to {
    ${toLine}
    ${panelToExtra}
  }
}`;

  const js = `function ${jsFunctionName}(t) {
  t = Math.min(1, Math.max(0, t));
  ${jsBody}
}`;

  const raf = `const duration = ${state.durationMs};
const distance = ${state.distancePx};
const start = performance.now();

function ${jsFunctionName}(t) {
  t = Math.min(1, Math.max(0, t));
  ${jsBody}
}

function frame(now) {
  const progress = Math.min(1, (now - start) / duration);
  const eased = ${jsFunctionName}(progress);
  element.style.transform = \`translateX(\${distance * eased}px)\`;

  if (progress < 1) {
    requestAnimationFrame(frame);
  }
}

requestAnimationFrame(frame);`;

  const waapi = `element.animate(
  [
    { transform: "translateX(0)" },
    { transform: "translateX(${state.distancePx}px)" }
  ],
  {
    duration: ${state.durationMs},
    delay: ${state.delayMs},
    iterations: ${state.playMode === "once" ? iterationCount : "Infinity"},
    direction: "${direction}",
    easing: "${timingFunction}"
  }
);`;

  const tailwind = `<div class="transition-transform duration-[${state.durationMs}ms] ease-[${timingFunction.replaceAll(" ", "_")}]">
  ...
</div>`;

  return {
    transition,
    animation,
    js,
    raf,
    waapi,
    tailwind,
  } satisfies Record<EasingCodeTarget, string>;
}

export function isCssExact(definition: EasingDefinition) {
  return Boolean(definition.cssTiming);
}
