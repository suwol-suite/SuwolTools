export declare function generateNames(options: { countryId: string; gender: "male" | "female" | "neutral" | "random"; fixedSurname?: string; count: number; unique: boolean; showRomanized?: boolean }): unknown[];
export declare function formatGeneratedNames(results: unknown[], format: "text" | "csv" | "json", displayMode: "full" | "surname" | "given" | "full-with-romanized"): string;
