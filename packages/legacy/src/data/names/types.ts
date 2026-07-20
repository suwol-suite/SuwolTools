export type NameGender = "male" | "female" | "neutral";

export type NameOrder = "family-given" | "given-family";

export type CountryNameData = {
  id: string;
  countryKey: string;
  nativeLabel: string;
  nameOrder: NameOrder;
  separator?: string;
  surnames: string[];
  maleGivenNames: string[];
  femaleGivenNames: string[];
  neutralGivenNames?: string[];
  romanization?: {
    surnames?: Record<string, string>;
    givenNames?: Record<string, string>;
  };
};
