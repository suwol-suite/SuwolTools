export declare function parseHexColor(input: string): { r: number; g: number; b: number } | null;
export declare function parseRgbColor(input: string): { r: number; g: number; b: number } | null;
export declare function parseHslColor(input: string): { r: number; g: number; b: number } | null;
export declare function rgbToHex(color: { r: number; g: number; b: number }): string;
export declare function rgbToHsl(color: { r: number; g: number; b: number }): { h: number; s: number; l: number };
export declare function formatRgb(color: { r: number; g: number; b: number }): string;
export declare function formatHsl(color: { h: number; s: number; l: number }): string;
export declare function getContrastTextColor(color: { r: number; g: number; b: number }): "#000000" | "#ffffff";
