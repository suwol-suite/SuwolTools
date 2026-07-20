export type NumberBase = 2 | 8 | 10 | 16;

export type NumberBaseResult = {
  value: bigint;
  binary: string;
  octal: string;
  decimal: string;
  hexadecimal: string;
};

const basePrefixes: Record<string, NumberBase> = {
  "0b": 2,
  "0o": 8,
  "0x": 16,
};

function digitValue(character: string): number {
  const code = character.toLowerCase().charCodeAt(0);

  if (code >= 48 && code <= 57) {
    return code - 48;
  }

  if (code >= 97 && code <= 122) {
    return code - 87;
  }

  return -1;
}

export function parseNumberBaseInput(input: string, selectedBase: NumberBase): bigint {
  let normalized = input.trim().replace(/[\s_]/g, "");

  if (!normalized) {
    throw new Error("empty");
  }

  let sign = 1n;

  if (normalized.startsWith("-")) {
    sign = -1n;
    normalized = normalized.slice(1);
  } else if (normalized.startsWith("+")) {
    normalized = normalized.slice(1);
  }

  const prefix = normalized.slice(0, 2).toLowerCase();
  const base = basePrefixes[prefix] ?? selectedBase;

  if (basePrefixes[prefix]) {
    normalized = normalized.slice(2);
  }

  if (!normalized) {
    throw new Error("empty");
  }

  let value = 0n;
  const bigBase = BigInt(base);

  for (const character of normalized) {
    const digit = digitValue(character);

    if (digit < 0 || digit >= base) {
      throw new Error("invalid-digit");
    }

    value = value * bigBase + BigInt(digit);
  }

  return value * sign;
}

export function formatNumberBase(value: bigint, base: NumberBase): string {
  const formatted = value.toString(base);
  return base === 16 ? formatted.toUpperCase() : formatted;
}

export function convertNumberBase(input: string, selectedBase: NumberBase): NumberBaseResult {
  const value = parseNumberBaseInput(input, selectedBase);

  return {
    value,
    binary: formatNumberBase(value, 2),
    octal: formatNumberBase(value, 8),
    decimal: formatNumberBase(value, 10),
    hexadecimal: formatNumberBase(value, 16),
  };
}
