import { getNameCountry } from "../data/names";
import type { CountryNameData, NameGender } from "../data/names";

export type NameGenerationGender = NameGender | "random";
export type NameOutputFormat = "text" | "csv" | "json";
export type NameDisplayMode = "full" | "surname" | "given" | "full-with-romanized";

export type GenerateNameOptions = {
  countryId: string;
  gender: NameGenerationGender;
  fixedSurname?: string;
  count: number;
  unique: boolean;
  showRomanized?: boolean;
};

export type GeneratedName = {
  fullName: string;
  surname: string;
  givenName: string;
  gender: NameGender;
  countryId: string;
  romanizedName?: string;
};

function pickRandom<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

function getPools(country: CountryNameData): Record<NameGender, string[]> {
  return {
    male: country.maleGivenNames,
    female: country.femaleGivenNames,
    neutral:
      country.neutralGivenNames && country.neutralGivenNames.length > 0
        ? country.neutralGivenNames
        : [...country.maleGivenNames, ...country.femaleGivenNames],
  };
}

function pickGender(country: CountryNameData, gender: NameGenerationGender): NameGender {
  if (gender !== "random") {
    return gender;
  }

  const pools = getPools(country);
  const availableGenders = (Object.keys(pools) as NameGender[]).filter(
    (candidate) => pools[candidate].length > 0,
  );

  return pickRandom(availableGenders);
}

function formatName(country: CountryNameData, surname: string, givenName: string): string {
  const separator = country.separator ?? " ";

  if (country.nameOrder === "family-given") {
    return `${surname}${separator}${givenName}`;
  }

  return `${givenName}${separator}${surname}`;
}

function buildRomanizedName(
  country: CountryNameData,
  surname: string,
  givenName: string,
): string | undefined {
  const romanizedSurname = country.romanization?.surnames?.[surname];
  const romanizedGivenName = country.romanization?.givenNames?.[givenName];

  if (!romanizedSurname && !romanizedGivenName) {
    return undefined;
  }

  const parts =
    country.nameOrder === "family-given"
      ? [romanizedSurname, romanizedGivenName]
      : [romanizedGivenName, romanizedSurname];

  return parts.filter(Boolean).join(" ");
}

export function generateNames(options: GenerateNameOptions): GeneratedName[] {
  const country = getNameCountry(options.countryId) ?? getNameCountry("ko-KR");

  if (!country) {
    return [];
  }

  const safeCount = Math.min(100, Math.max(1, Math.floor(options.count || 1)));
  const fixedSurname = options.fixedSurname?.trim();
  const results: GeneratedName[] = [];
  const seenNames = new Set<string>();
  const maxAttempts = options.unique ? Math.max(50, safeCount * 20) : safeCount;

  for (let attempts = 0; attempts < maxAttempts && results.length < safeCount; attempts += 1) {
    const generatedGender = pickGender(country, options.gender);
    const pools = getPools(country);
    const givenPool = pools[generatedGender];

    if (givenPool.length === 0 || country.surnames.length === 0) {
      break;
    }

    const surname = fixedSurname || pickRandom(country.surnames);
    const givenName = pickRandom(givenPool);
    const fullName = formatName(country, surname, givenName);
    const romanizedName = options.showRomanized
      ? buildRomanizedName(country, surname, givenName)
      : undefined;

    if (options.unique && seenNames.has(fullName)) {
      continue;
    }

    seenNames.add(fullName);
    results.push({
      fullName,
      surname,
      givenName,
      gender: generatedGender,
      countryId: country.id,
      romanizedName,
    });
  }

  return results;
}

function getDisplayValue(name: GeneratedName, displayMode: NameDisplayMode): string {
  switch (displayMode) {
    case "surname":
      return name.surname;
    case "given":
      return name.givenName;
    case "full-with-romanized":
      return name.romanizedName ? `${name.fullName} / ${name.romanizedName}` : name.fullName;
    default:
      return name.fullName;
  }
}

function escapeCsvValue(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }

  return value;
}

export function formatGeneratedNames(
  names: GeneratedName[],
  format: NameOutputFormat,
  displayMode: NameDisplayMode,
): string {
  if (format === "json") {
    return JSON.stringify(names, null, 2);
  }

  if (format === "csv") {
    return [
      ["fullName", "surname", "givenName", "gender", "country", "romanizedName"]
        .map(escapeCsvValue)
        .join(","),
      ...names.map((name) =>
        [
          name.fullName,
          name.surname,
          name.givenName,
          name.gender,
          name.countryId,
          name.romanizedName ?? "",
        ]
          .map(escapeCsvValue)
          .join(","),
      ),
    ].join("\n");
  }

  return names.map((name) => getDisplayValue(name, displayMode)).join("\n");
}

export function formatGeneratedNameForDisplay(
  name: GeneratedName,
  displayMode: NameDisplayMode,
): string {
  return getDisplayValue(name, displayMode);
}
