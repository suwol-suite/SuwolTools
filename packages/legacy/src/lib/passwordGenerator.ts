export type PasswordGenerationOptions = {
  length: number;
  count: number;
  includeUppercase: boolean;
  includeLowercase: boolean;
  includeNumbers: boolean;
  includeSymbols: boolean;
  excludeAmbiguous: boolean;
};

export type PasswordStrength = "weak" | "medium" | "strong";

const uppercase = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const lowercase = "abcdefghijklmnopqrstuvwxyz";
const numbers = "0123456789";
const symbols = "!@#$%^&*()_+-=[]{}|;:,.<>?";
const ambiguous = new Set("0Oo1lI".split(""));

export const defaultPasswordOptions: PasswordGenerationOptions = {
  length: 16,
  count: 10,
  includeUppercase: true,
  includeLowercase: true,
  includeNumbers: true,
  includeSymbols: true,
  excludeAmbiguous: true,
};

export function generatePasswords(options: PasswordGenerationOptions): string[] {
  const pools = getPools(options);

  if (pools.length === 0) {
    throw new Error("Select at least one character set.");
  }

  const length = Math.max(pools.length, Math.min(128, Math.round(options.length)));
  const count = Math.max(1, Math.min(100, Math.round(options.count)));

  return Array.from({ length: count }, () => generatePassword(length, pools));
}

export function estimatePasswordStrength(password: string): PasswordStrength {
  const variety = [
    /[A-Z]/.test(password),
    /[a-z]/.test(password),
    /\d/.test(password),
    /[^A-Za-z0-9]/.test(password),
  ].filter(Boolean).length;
  const score = password.length + variety * 6;

  if (score >= 36) {
    return "strong";
  }

  if (score >= 24) {
    return "medium";
  }

  return "weak";
}

function generatePassword(length: number, pools: string[]): string {
  const required = pools.map((pool) => pool[secureIndex(pool.length)]);
  const allCharacters = pools.join("");
  const remaining = Array.from({ length: length - required.length }, () => {
    return allCharacters[secureIndex(allCharacters.length)];
  });

  return shuffleSecure([...required, ...remaining]).join("");
}

function getPools(options: PasswordGenerationOptions): string[] {
  const pools = [
    options.includeUppercase ? uppercase : "",
    options.includeLowercase ? lowercase : "",
    options.includeNumbers ? numbers : "",
    options.includeSymbols ? symbols : "",
  ]
    .map((pool) =>
      options.excludeAmbiguous
        ? pool
            .split("")
            .filter((character) => !ambiguous.has(character))
            .join("")
        : pool,
    )
    .filter(Boolean);

  return pools;
}

function shuffleSecure(values: string[]): string[] {
  const shuffled = [...values];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = secureIndex(index + 1);
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }

  return shuffled;
}

function secureIndex(max: number): number {
  const randomValues = new Uint32Array(1);
  const limit = Math.floor(0xffffffff / max) * max;

  do {
    crypto.getRandomValues(randomValues);
  } while (randomValues[0] >= limit);

  return randomValues[0] % max;
}
