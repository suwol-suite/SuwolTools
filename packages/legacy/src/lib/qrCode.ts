export type QrErrorCorrectionLevel = "L" | "M" | "Q" | "H";

export type QrCodeOptions = {
  size: number;
  margin: number;
  foregroundColor: string;
  backgroundColor: string;
  errorCorrectionLevel: QrErrorCorrectionLevel;
  transparentBackground: boolean;
};

export type QrMatrix = {
  modules: boolean[][];
  version: number;
  size: number;
};

export type QrRenderMetrics = {
  actualSize: number;
  cellSize: number;
  requestedSize: number;
  totalModules: number;
  adjusted: boolean;
};

const minimumOutputSize = 128;
const maximumOutputSize = 1024;

const eccCodewordsPerBlock: Record<QrErrorCorrectionLevel, number[]> = {
  L: [0, 7, 10, 15, 20, 26, 18, 20, 24, 30, 18, 20, 24, 26, 30, 22, 24, 28, 30, 28, 28, 28, 28, 30, 30, 26, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
  M: [0, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 24, 28, 28, 26, 26, 26, 26, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28],
  Q: [0, 13, 22, 18, 26, 18, 24, 18, 22, 20, 24, 28, 26, 24, 20, 30, 24, 28, 28, 26, 30, 28, 30, 30, 30, 30, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
  H: [0, 17, 28, 22, 16, 22, 28, 26, 26, 24, 28, 24, 28, 22, 24, 24, 30, 28, 28, 26, 28, 30, 24, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
};

const numErrorCorrectionBlocks: Record<QrErrorCorrectionLevel, number[]> = {
  L: [0, 1, 1, 1, 1, 1, 2, 2, 2, 2, 4, 4, 4, 4, 4, 6, 6, 6, 6, 7, 8, 8, 9, 9, 10, 12, 12, 12, 13, 14, 15, 16, 17, 18, 19, 19, 20, 21, 22, 24, 25],
  M: [0, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16, 17, 17, 18, 20, 21, 23, 25, 26, 28, 29, 31, 33, 35, 37, 38, 40, 43, 45, 47, 49],
  Q: [0, 1, 1, 2, 2, 4, 4, 6, 6, 8, 8, 8, 10, 12, 16, 12, 17, 16, 18, 21, 20, 23, 23, 25, 27, 29, 34, 34, 35, 38, 40, 43, 45, 48, 51, 53, 56, 59, 62, 65, 68],
  H: [0, 1, 1, 2, 4, 4, 4, 5, 6, 8, 8, 11, 11, 16, 16, 18, 16, 19, 21, 25, 25, 25, 34, 30, 32, 35, 37, 40, 42, 45, 48, 51, 54, 57, 60, 63, 66, 70, 74, 77, 81],
};

const formatLevelBits: Record<QrErrorCorrectionLevel, number> = {
  M: 0,
  L: 1,
  H: 2,
  Q: 3,
};

function getDataCodewordCount(version: number, level: QrErrorCorrectionLevel): number {
  return (
    getRawDataCodewordCount(version) -
    eccCodewordsPerBlock[level][version] * numErrorCorrectionBlocks[level][version]
  );
}

function getRawDataCodewordCount(version: number): number {
  let modules = (16 * version + 128) * version + 64;

  if (version >= 2) {
    const alignmentPatternCount = Math.floor(version / 7) + 2;
    modules -= (25 * alignmentPatternCount - 10) * alignmentPatternCount - 55;

    if (version >= 7) {
      modules -= 36;
    }
  }

  return Math.floor(modules / 8);
}

function getCharacterCountBitLength(version: number): number {
  return version <= 9 ? 8 : 16;
}

function appendBits(bits: number[], value: number, length: number): void {
  for (let i = length - 1; i >= 0; i -= 1) {
    bits.push((value >>> i) & 1);
  }
}

function pickVersion(dataLength: number, level: QrErrorCorrectionLevel): number {
  for (let version = 1; version <= 40; version += 1) {
    const capacityBits = getDataCodewordCount(version, level) * 8;
    const requiredBits = 4 + getCharacterCountBitLength(version) + dataLength * 8;

    if (requiredBits <= capacityBits) {
      return version;
    }
  }

  throw new Error("QR input is too long.");
}

function encodeDataCodewords(input: string, version: number, level: QrErrorCorrectionLevel): number[] {
  const bytes = Array.from(new TextEncoder().encode(input));
  const dataCodewords = getDataCodewordCount(version, level);
  const capacityBits = dataCodewords * 8;
  const bits: number[] = [];

  appendBits(bits, 0b0100, 4);
  appendBits(bits, bytes.length, getCharacterCountBitLength(version));
  bytes.forEach((byte) => appendBits(bits, byte, 8));
  appendBits(bits, 0, Math.min(4, capacityBits - bits.length));

  while (bits.length % 8 !== 0) {
    bits.push(0);
  }

  const codewords: number[] = [];
  for (let i = 0; i < bits.length; i += 8) {
    let value = 0;
    for (let j = 0; j < 8; j += 1) {
      value = (value << 1) | bits[i + j];
    }
    codewords.push(value);
  }

  for (let padByte = 0xec; codewords.length < dataCodewords; padByte ^= 0xec ^ 0x11) {
    codewords.push(padByte);
  }

  return codewords;
}

function gfMultiply(x: number, y: number): number {
  let z = 0;

  for (let i = 7; i >= 0; i -= 1) {
    z = (z << 1) ^ ((z >>> 7) * 0x11d);
    z ^= ((y >>> i) & 1) * x;
  }

  return z & 0xff;
}

function gfPow(x: number, power: number): number {
  let result = 1;

  for (let i = 0; i < power; i += 1) {
    result = gfMultiply(result, x);
  }

  return result;
}

function reedSolomonGenerator(degree: number): number[] {
  let generator = [1];

  for (let i = 0; i < degree; i += 1) {
    const next = new Array(generator.length + 1).fill(0) as number[];

    generator.forEach((coefficient, index) => {
      next[index] ^= gfMultiply(coefficient, gfPow(2, i));
      next[index + 1] ^= coefficient;
    });

    generator = next;
  }

  // The polynomial is built low-degree first, but division below reads the leading term first.
  return generator.reverse();
}

function reedSolomonRemainder(data: number[], degree: number): number[] {
  const generator = reedSolomonGenerator(degree);
  const result = [...data, ...new Array(degree).fill(0)];

  for (let i = 0; i < data.length; i += 1) {
    const factor = result[i];

    if (factor === 0) {
      continue;
    }

    for (let j = 0; j < generator.length; j += 1) {
      result[i + j] ^= gfMultiply(generator[j], factor);
    }
  }

  return result.slice(result.length - degree);
}

function addErrorCorrectionAndInterleave(
  data: number[],
  version: number,
  level: QrErrorCorrectionLevel,
): number[] {
  const numBlocks = numErrorCorrectionBlocks[level][version];
  const blockEccLength = eccCodewordsPerBlock[level][version];
  const totalCodewords = getRawDataCodewordCount(version);
  const numShortBlocks = numBlocks - (totalCodewords % numBlocks);
  const shortBlockLength = Math.floor(totalCodewords / numBlocks);
  const shortDataLength = shortBlockLength - blockEccLength;
  const blocks: Array<{ data: number[]; ecc: number[] }> = [];
  let offset = 0;

  for (let i = 0; i < numBlocks; i += 1) {
    const dataLength = shortDataLength + (i < numShortBlocks ? 0 : 1);
    const blockData = data.slice(offset, offset + dataLength);
    offset += dataLength;
    blocks.push({
      data: blockData,
      ecc: reedSolomonRemainder(blockData, blockEccLength),
    });
  }

  const result: number[] = [];
  const maxDataLength = Math.max(...blocks.map((block) => block.data.length));

  for (let i = 0; i < maxDataLength; i += 1) {
    blocks.forEach((block) => {
      if (i < block.data.length) {
        result.push(block.data[i]);
      }
    });
  }

  for (let i = 0; i < blockEccLength; i += 1) {
    blocks.forEach((block) => {
      result.push(block.ecc[i]);
    });
  }

  return result;
}

function createMatrix(size: number): { modules: boolean[][]; functionModules: boolean[][] } {
  return {
    modules: Array.from({ length: size }, () => Array(size).fill(false) as boolean[]),
    functionModules: Array.from({ length: size }, () => Array(size).fill(false) as boolean[]),
  };
}

function setFunctionModule(
  modules: boolean[][],
  functionModules: boolean[][],
  x: number,
  y: number,
  dark: boolean,
): void {
  if (x < 0 || y < 0 || y >= modules.length || x >= modules.length) {
    return;
  }

  modules[y][x] = dark;
  functionModules[y][x] = true;
}

function drawFinderPattern(
  modules: boolean[][],
  functionModules: boolean[][],
  x: number,
  y: number,
): void {
  for (let dy = -1; dy <= 7; dy += 1) {
    for (let dx = -1; dx <= 7; dx += 1) {
      const xx = x + dx;
      const yy = y + dy;
      const dark =
        dx >= 0 &&
        dx <= 6 &&
        dy >= 0 &&
        dy <= 6 &&
        (dx === 0 || dx === 6 || dy === 0 || dy === 6 || (dx >= 2 && dx <= 4 && dy >= 2 && dy <= 4));

      setFunctionModule(modules, functionModules, xx, yy, dark);
    }
  }
}

function drawAlignmentPattern(
  modules: boolean[][],
  functionModules: boolean[][],
  centerX: number,
  centerY: number,
): void {
  for (let dy = -2; dy <= 2; dy += 1) {
    for (let dx = -2; dx <= 2; dx += 1) {
      setFunctionModule(
        modules,
        functionModules,
        centerX + dx,
        centerY + dy,
        Math.max(Math.abs(dx), Math.abs(dy)) !== 1,
      );
    }
  }
}

function drawFormatBits(
  modules: boolean[][],
  functionModules: boolean[][],
  level: QrErrorCorrectionLevel,
): void {
  const size = modules.length;
  const data = (formatLevelBits[level] << 3) | 0;
  let remainder = data;

  for (let i = 0; i < 10; i += 1) {
    remainder = (remainder << 1) ^ (((remainder >>> 9) & 1) * 0x537);
  }

  const bits = ((data << 10) | remainder) ^ 0x5412;

  for (let i = 0; i <= 5; i += 1) {
    setFunctionModule(modules, functionModules, 8, i, ((bits >>> i) & 1) !== 0);
  }
  setFunctionModule(modules, functionModules, 8, 7, ((bits >>> 6) & 1) !== 0);
  setFunctionModule(modules, functionModules, 8, 8, ((bits >>> 7) & 1) !== 0);
  setFunctionModule(modules, functionModules, 7, 8, ((bits >>> 8) & 1) !== 0);

  for (let i = 9; i < 15; i += 1) {
    setFunctionModule(modules, functionModules, 14 - i, 8, ((bits >>> i) & 1) !== 0);
  }

  for (let i = 0; i < 8; i += 1) {
    setFunctionModule(modules, functionModules, size - 1 - i, 8, ((bits >>> i) & 1) !== 0);
  }

  for (let i = 8; i < 15; i += 1) {
    setFunctionModule(modules, functionModules, 8, size - 15 + i, ((bits >>> i) & 1) !== 0);
  }

  setFunctionModule(modules, functionModules, 8, size - 8, true);
}

function drawVersionBits(
  modules: boolean[][],
  functionModules: boolean[][],
  version: number,
): void {
  if (version < 7) {
    return;
  }

  const size = modules.length;
  let remainder = version;

  for (let i = 0; i < 12; i += 1) {
    remainder = (remainder << 1) ^ (((remainder >>> 11) & 1) * 0x1f25);
  }

  const bits = (version << 12) | remainder;

  for (let i = 0; i < 18; i += 1) {
    const bit = ((bits >>> i) & 1) !== 0;
    const x = size - 11 + (i % 3);
    const y = Math.floor(i / 3);

    setFunctionModule(modules, functionModules, x, y, bit);
    setFunctionModule(modules, functionModules, y, x, bit);
  }
}

function getAlignmentPatternCenters(version: number): number[] {
  if (version === 1) {
    return [];
  }

  const size = version * 4 + 17;
  const alignmentPatternCount = Math.floor(version / 7) + 2;
  const step =
    version === 32
      ? 26
      : Math.ceil((version * 4 + 4) / (alignmentPatternCount * 2 - 2)) * 2;
  const result = [6];

  for (let position = size - 7; result.length < alignmentPatternCount; position -= step) {
    result.splice(1, 0, position);
  }

  return result;
}

function drawFunctionPatterns(
  modules: boolean[][],
  functionModules: boolean[][],
  version: number,
  level: QrErrorCorrectionLevel,
): void {
  const size = modules.length;

  drawFinderPattern(modules, functionModules, 0, 0);
  drawFinderPattern(modules, functionModules, size - 7, 0);
  drawFinderPattern(modules, functionModules, 0, size - 7);

  for (let i = 8; i < size - 8; i += 1) {
    const dark = i % 2 === 0;
    setFunctionModule(modules, functionModules, i, 6, dark);
    setFunctionModule(modules, functionModules, 6, i, dark);
  }

  const centers = getAlignmentPatternCenters(version);
  centers.forEach((y) => {
    centers.forEach((x) => {
      const overlapsFinder =
        (x === 6 && y === 6) || (x === 6 && y === size - 7) || (x === size - 7 && y === 6);

      if (!overlapsFinder) {
        drawAlignmentPattern(modules, functionModules, x, y);
      }
    });
  });

  drawFormatBits(modules, functionModules, level);
  drawVersionBits(modules, functionModules, version);
}

function drawCodewords(
  modules: boolean[][],
  functionModules: boolean[][],
  codewords: number[],
): void {
  const size = modules.length;
  let bitIndex = 0;
  let upward = true;

  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) {
      right -= 1;
    }

    for (let vert = 0; vert < size; vert += 1) {
      const y = upward ? size - 1 - vert : vert;

      for (let j = 0; j < 2; j += 1) {
        const x = right - j;

        if (functionModules[y][x]) {
          continue;
        }

        const byte = codewords[Math.floor(bitIndex / 8)] ?? 0;
        const bit = ((byte >>> (7 - (bitIndex % 8))) & 1) !== 0;
        const masked = (x + y) % 2 === 0 ? !bit : bit;
        modules[y][x] = masked;
        bitIndex += 1;
      }
    }

    upward = !upward;
  }
}

export function createQrMatrix(input: string, level: QrErrorCorrectionLevel): QrMatrix {
  if (!input) {
    throw new Error("QR input is empty.");
  }

  const dataLength = new TextEncoder().encode(input).length;
  const version = pickVersion(dataLength, level);
  const size = version * 4 + 17;
  const dataCodewords = encodeDataCodewords(input, version, level);
  const codewords = addErrorCorrectionAndInterleave(dataCodewords, version, level);
  const { modules, functionModules } = createMatrix(size);

  drawFunctionPatterns(modules, functionModules, version, level);
  drawCodewords(modules, functionModules, codewords);

  return {
    modules,
    version,
    size,
  };
}

export function getQrRenderMetrics(matrix: QrMatrix, options: QrCodeOptions): QrRenderMetrics {
  const totalModules = matrix.size + options.margin * 2;
  const requestedSize = Math.min(maximumOutputSize, Math.max(minimumOutputSize, options.size));
  let cellSize = Math.max(1, Math.round(requestedSize / totalModules));
  let actualSize = totalModules * cellSize;

  if (actualSize < minimumOutputSize) {
    cellSize = Math.max(1, Math.ceil(minimumOutputSize / totalModules));
    actualSize = totalModules * cellSize;
  }

  if (actualSize > maximumOutputSize) {
    cellSize = Math.max(1, Math.floor(maximumOutputSize / totalModules));
    actualSize = totalModules * cellSize;
  }

  return {
    actualSize,
    cellSize,
    requestedSize,
    totalModules,
    adjusted: actualSize !== requestedSize,
  };
}

function disableCanvasSmoothing(context: CanvasRenderingContext2D): void {
  const contextWithVendorFlags = context as CanvasRenderingContext2D & {
    mozImageSmoothingEnabled?: boolean;
    msImageSmoothingEnabled?: boolean;
    webkitImageSmoothingEnabled?: boolean;
  };

  context.imageSmoothingEnabled = false;
  contextWithVendorFlags.mozImageSmoothingEnabled = false;
  contextWithVendorFlags.msImageSmoothingEnabled = false;
  contextWithVendorFlags.webkitImageSmoothingEnabled = false;
}

export function drawQrToCanvas(canvas: HTMLCanvasElement, matrix: QrMatrix, options: QrCodeOptions): void {
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("Canvas is not available.");
  }

  const { actualSize, cellSize } = getQrRenderMetrics(matrix, options);

  canvas.width = actualSize;
  canvas.height = actualSize;
  canvas.style.width = `${actualSize}px`;
  canvas.style.height = `${actualSize}px`;

  context.setTransform(1, 0, 0, 1, 0, 0);
  disableCanvasSmoothing(context);
  context.clearRect(0, 0, actualSize, actualSize);

  if (!options.transparentBackground) {
    context.fillStyle = options.backgroundColor;
    context.fillRect(0, 0, actualSize, actualSize);
  }

  context.fillStyle = options.foregroundColor;

  matrix.modules.forEach((row, y) => {
    row.forEach((dark, x) => {
      if (dark) {
        context.fillRect((x + options.margin) * cellSize, (y + options.margin) * cellSize, cellSize, cellSize);
      }
    });
  });
}

export function qrMatrixToSvg(matrix: QrMatrix, options: QrCodeOptions): string {
  const totalModules = matrix.size + options.margin * 2;
  const { actualSize } = getQrRenderMetrics(matrix, options);
  const paths: string[] = [];

  matrix.modules.forEach((row, y) => {
    row.forEach((dark, x) => {
      if (dark) {
        paths.push(`M${x + options.margin},${y + options.margin}h1v1h-1z`);
      }
    });
  });

  const background = options.transparentBackground
    ? ""
    : `<rect width="100%" height="100%" fill="${options.backgroundColor}"/>`;

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalModules} ${totalModules}" width="${actualSize}" height="${actualSize}" shape-rendering="crispEdges">`,
    background,
    `<path d="${paths.join("")}" fill="${options.foregroundColor}"/>`,
    "</svg>",
  ].join("");
}
