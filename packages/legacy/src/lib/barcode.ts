export type BarcodeFormat =
  | "CODE128"
  | "CODE39"
  | "EAN13"
  | "EAN8"
  | "UPC"
  | "ITF14"
  | "MSI"
  | "pharmacode";

export type BarcodeOptions = {
  format: BarcodeFormat;
  width: number;
  height: number;
  margin: number;
  displayValue: boolean;
  fontSize: number;
  lineColor: string;
  background: string;
};

export type BarcodeSvgResult = {
  svg: string;
  width: number;
  height: number;
  value: string;
};

const code128Patterns = [
  "212222",
  "222122",
  "222221",
  "121223",
  "121322",
  "131222",
  "122213",
  "122312",
  "132212",
  "221213",
  "221312",
  "231212",
  "112232",
  "122132",
  "122231",
  "113222",
  "123122",
  "123221",
  "223211",
  "221132",
  "221231",
  "213212",
  "223112",
  "312131",
  "311222",
  "321122",
  "321221",
  "312212",
  "322112",
  "322211",
  "212123",
  "212321",
  "232121",
  "111323",
  "131123",
  "131321",
  "112313",
  "132113",
  "132311",
  "211313",
  "231113",
  "231311",
  "112133",
  "112331",
  "132131",
  "113123",
  "113321",
  "133121",
  "313121",
  "211331",
  "231131",
  "213113",
  "213311",
  "213131",
  "311123",
  "311321",
  "331121",
  "312113",
  "312311",
  "332111",
  "314111",
  "221411",
  "431111",
  "111224",
  "111422",
  "121124",
  "121421",
  "141122",
  "141221",
  "112214",
  "112412",
  "122114",
  "122411",
  "142112",
  "142211",
  "241211",
  "221114",
  "413111",
  "241112",
  "134111",
  "111242",
  "121142",
  "121241",
  "114212",
  "124112",
  "124211",
  "411212",
  "421112",
  "421211",
  "212141",
  "214121",
  "412121",
  "111143",
  "111341",
  "131141",
  "114113",
  "114311",
  "411113",
  "411311",
  "113141",
  "114131",
  "311141",
  "411131",
  "211412",
  "211214",
  "211232",
  "2331112",
];

const code39Patterns: Record<string, string> = {
  "0": "101001101101",
  "1": "110100101011",
  "2": "101100101011",
  "3": "110110010101",
  "4": "101001101011",
  "5": "110100110101",
  "6": "101100110101",
  "7": "101001011011",
  "8": "110100101101",
  "9": "101100101101",
  A: "110101001011",
  B: "101101001011",
  C: "110110100101",
  D: "101011001011",
  E: "110101100101",
  F: "101101100101",
  G: "101010011011",
  H: "110101001101",
  I: "101101001101",
  J: "101011001101",
  K: "110101010011",
  L: "101101010011",
  M: "110110101001",
  N: "101011010011",
  O: "110101101001",
  P: "101101101001",
  Q: "101010110011",
  R: "110101011001",
  S: "101101011001",
  T: "101011011001",
  U: "110010101011",
  V: "100110101011",
  W: "110011010101",
  X: "100101101011",
  Y: "110010110101",
  Z: "100110110101",
  "-": "100101011011",
  ".": "110010101101",
  " ": "100110101101",
  $: "100100100101",
  "/": "100100101001",
  "+": "100101001001",
  "%": "101001001001",
  "*": "100101101101",
};

const digitPatterns = {
  L: ["0001101", "0011001", "0010011", "0111101", "0100011", "0110001", "0101111", "0111011", "0110111", "0001011"],
  G: ["0100111", "0110011", "0011011", "0100001", "0011101", "0111001", "0000101", "0010001", "0001001", "0010111"],
  R: ["1110010", "1100110", "1101100", "1000010", "1011100", "1001110", "1010000", "1000100", "1001000", "1110100"],
};

const ean13Parity = [
  "LLLLLL",
  "LLGLGG",
  "LLGGLG",
  "LLGGGL",
  "LGLLGG",
  "LGGLLG",
  "LGGGLL",
  "LGLGLG",
  "LGLGGL",
  "LGGLGL",
];

const itfPatterns = ["nnwwn", "wnnnw", "nwnnw", "wwnnn", "nnwnw", "wnwnn", "nwwnn", "nnnww", "wnnwn", "nwnwn"];

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function assertDigits(value: string, pattern: RegExp, message: string): void {
  if (!pattern.test(value)) {
    throw new Error(message);
  }
}

function computeGtinCheckDigit(value: string): number {
  const digits = value.split("").map(Number).reverse();
  const sum = digits.reduce((total, digit, index) => total + digit * (index % 2 === 0 ? 3 : 1), 0);
  return (10 - (sum % 10)) % 10;
}

function validateOrAppendCheckDigit(value: string, baseLength: number, fullLength: number, label: string): string {
  assertDigits(value, new RegExp(`^\\d{${baseLength},${fullLength}}$`), label);

  if (value.length === baseLength) {
    return `${value}${computeGtinCheckDigit(value)}`;
  }

  const expected = computeGtinCheckDigit(value.slice(0, baseLength));

  if (Number(value[fullLength - 1]) !== expected) {
    throw new Error(label);
  }

  return value;
}

function encodeCode128(value: string): string {
  if (!/^[ -~]+$/.test(value)) {
    throw new Error("Invalid CODE128 value.");
  }

  const codes = [104, ...value.split("").map((character) => character.charCodeAt(0) - 32)];
  const checksum = codes.reduce((sum, code, index) => sum + (index === 0 ? code : code * index), 0) % 103;
  codes.push(checksum, 106);

  return codes.map((code) => code128Patterns[code]).join("");
}

function encodeCode39(value: string): string {
  const normalized = value.toUpperCase();

  if (!/^[0-9A-Z .$/+%-]+$/.test(normalized)) {
    throw new Error("Invalid CODE39 value.");
  }

  return `*${normalized}*`
    .split("")
    .map((character) => `${code39Patterns[character]}0`)
    .join("");
}

function encodeEan13(value: string): { bits: string; text: string } {
  const text = validateOrAppendCheckDigit(value, 12, 13, "EAN-13 requires 12 or 13 digits.");
  const parity = ean13Parity[Number(text[0])];
  const left = text
    .slice(1, 7)
    .split("")
    .map((digit, index) => digitPatterns[parity[index] as "L" | "G"][Number(digit)])
    .join("");
  const right = text
    .slice(7)
    .split("")
    .map((digit) => digitPatterns.R[Number(digit)])
    .join("");

  return { bits: `101${left}01010${right}101`, text };
}

function encodeEan8(value: string): { bits: string; text: string } {
  const text = validateOrAppendCheckDigit(value, 7, 8, "EAN-8 requires 7 or 8 digits.");
  const left = text
    .slice(0, 4)
    .split("")
    .map((digit) => digitPatterns.L[Number(digit)])
    .join("");
  const right = text
    .slice(4)
    .split("")
    .map((digit) => digitPatterns.R[Number(digit)])
    .join("");

  return { bits: `101${left}01010${right}101`, text };
}

function encodeUpc(value: string): { bits: string; text: string } {
  const text = validateOrAppendCheckDigit(value, 11, 12, "UPC requires 11 or 12 digits.");
  const left = text
    .slice(0, 6)
    .split("")
    .map((digit) => digitPatterns.L[Number(digit)])
    .join("");
  const right = text
    .slice(6)
    .split("")
    .map((digit) => digitPatterns.R[Number(digit)])
    .join("");

  return { bits: `101${left}01010${right}101`, text };
}

function encodeItf14(value: string): { pattern: string; text: string } {
  const text = validateOrAppendCheckDigit(value, 13, 14, "ITF14 requires 13 or 14 digits.");
  let pattern = "nnnn";

  for (let i = 0; i < text.length; i += 2) {
    const bars = itfPatterns[Number(text[i])];
    const spaces = itfPatterns[Number(text[i + 1])];

    for (let j = 0; j < 5; j += 1) {
      pattern += bars[j] + spaces[j];
    }
  }

  return { pattern: `${pattern}wnn`, text };
}

function encodeMsi(value: string): string {
  assertDigits(value, /^\d+$/, "MSI requires numeric input.");
  return `110${value
    .split("")
    .map((digit) =>
      Number(digit)
        .toString(2)
        .padStart(4, "0")
        .split("")
        .map((bit) => (bit === "1" ? "110" : "100"))
        .join(""),
    )
    .join("")}1001`;
}

function encodePharmacode(value: string): string {
  assertDigits(value, /^\d+$/, "Pharmacode requires a number.");
  let numericValue = Number(value);

  if (!Number.isInteger(numericValue) || numericValue < 3 || numericValue > 131070) {
    throw new Error("Pharmacode requires a number from 3 to 131070.");
  }

  const bars: string[] = [];
  while (numericValue > 0) {
    if (numericValue % 2 === 0) {
      bars.unshift("w");
      numericValue = (numericValue - 2) / 2;
    } else {
      bars.unshift("n");
      numericValue = (numericValue - 1) / 2;
    }
  }

  return bars.join("n");
}

function appendBinaryBars(bits: string): string {
  return bits
    .split("")
    .map((bit) => (bit === "1" ? "1" : "0"))
    .join("");
}

function patternToRuns(pattern: string): Array<{ dark: boolean; units: number }> {
  const runs: Array<{ dark: boolean; units: number }> = [];
  let dark = true;

  pattern.split("").forEach((character) => {
    const units = character === "w" ? 3 : character === "n" ? 1 : Number(character);
    runs.push({ dark, units });
    dark = !dark;
  });

  return runs;
}

function bitsToRuns(bits: string): Array<{ dark: boolean; units: number }> {
  const runs: Array<{ dark: boolean; units: number }> = [];
  let previousBit = bits[0];
  let units = 0;

  bits.split("").forEach((bit) => {
    if (bit === previousBit) {
      units += 1;
      return;
    }

    runs.push({ dark: previousBit === "1", units });
    previousBit = bit;
    units = 1;
  });

  runs.push({ dark: previousBit === "1", units });
  return runs;
}

function encodeBarcode(value: string, format: BarcodeFormat): { runs: Array<{ dark: boolean; units: number }>; text: string } {
  switch (format) {
    case "CODE128":
      return { runs: patternToRuns(encodeCode128(value)), text: value };
    case "CODE39":
      return { runs: bitsToRuns(appendBinaryBars(encodeCode39(value))), text: value.toUpperCase() };
    case "EAN13": {
      const encoded = encodeEan13(value);
      return { runs: bitsToRuns(encoded.bits), text: encoded.text };
    }
    case "EAN8": {
      const encoded = encodeEan8(value);
      return { runs: bitsToRuns(encoded.bits), text: encoded.text };
    }
    case "UPC": {
      const encoded = encodeUpc(value);
      return { runs: bitsToRuns(encoded.bits), text: encoded.text };
    }
    case "ITF14": {
      const encoded = encodeItf14(value);
      return { runs: patternToRuns(encoded.pattern), text: encoded.text };
    }
    case "MSI":
      return { runs: bitsToRuns(encodeMsi(value)), text: value };
    case "pharmacode":
      return { runs: patternToRuns(encodePharmacode(value)), text: value };
    default:
      throw new Error("Unsupported barcode format.");
  }
}

export function generateBarcodeSvg(value: string, options: BarcodeOptions): BarcodeSvgResult {
  const trimmedValue = value.trim();

  if (!trimmedValue) {
    throw new Error("Barcode value is empty.");
  }

  const encoded = encodeBarcode(trimmedValue, options.format);
  const textHeight = options.displayValue ? options.fontSize + 8 : 0;
  const barHeight = options.height;
  const contentWidth = encoded.runs.reduce((sum, run) => sum + run.units * options.width, 0);
  const svgWidth = Math.ceil(contentWidth + options.margin * 2);
  const svgHeight = Math.ceil(barHeight + textHeight + options.margin * 2);
  let x = options.margin;
  const bars: string[] = [];

  encoded.runs.forEach((run) => {
    const runWidth = run.units * options.width;

    if (run.dark) {
      bars.push(
        `<rect x="${x}" y="${options.margin}" width="${runWidth}" height="${barHeight}" fill="${options.lineColor}"/>`,
      );
    }

    x += runWidth;
  });

  const textElement = options.displayValue
    ? `<text x="${svgWidth / 2}" y="${options.margin + barHeight + options.fontSize + 2}" text-anchor="middle" font-family="Arial, sans-serif" font-size="${options.fontSize}" fill="${options.lineColor}">${escapeHtml(encoded.text)}</text>`
    : "";

  const svg = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${svgWidth}" height="${svgHeight}" viewBox="0 0 ${svgWidth} ${svgHeight}" shape-rendering="crispEdges">`,
    `<rect width="100%" height="100%" fill="${options.background}"/>`,
    ...bars,
    textElement,
    "</svg>",
  ].join("");

  return {
    svg,
    width: svgWidth,
    height: svgHeight,
    value: encoded.text,
  };
}
