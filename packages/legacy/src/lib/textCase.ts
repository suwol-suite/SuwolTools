export type TextCaseResult = {
  label: string;
  value: string;
};

function splitWords(input: string): string[] {
  const spaced = input
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2");

  return spaced.match(/[\p{L}\p{N}]+/gu) ?? [];
}

function capitalize(word: string): string {
  if (!word) {
    return "";
  }

  return word.charAt(0).toLocaleUpperCase() + word.slice(1).toLocaleLowerCase();
}

function sentenceCase(words: string[]): string {
  const sentence = words.map((word) => word.toLocaleLowerCase()).join(" ");
  return sentence ? sentence.charAt(0).toLocaleUpperCase() + sentence.slice(1) : "";
}

export function convertTextCases(input: string): TextCaseResult[] {
  const words = splitWords(input);
  const lowerWords = words.map((word) => word.toLocaleLowerCase());
  const pascalWords = words.map(capitalize);

  return [
    {
      label: "camelCase",
      value: lowerWords
        .map((word, index) => (index === 0 ? word : capitalize(word)))
        .join(""),
    },
    { label: "PascalCase", value: pascalWords.join("") },
    { label: "snake_case", value: lowerWords.join("_") },
    { label: "kebab-case", value: lowerWords.join("-") },
    { label: "CONSTANT_CASE", value: lowerWords.join("_").toLocaleUpperCase() },
    { label: "Title Case", value: pascalWords.join(" ") },
    { label: "Sentence case", value: sentenceCase(words) },
    { label: "UPPER CASE", value: input.toLocaleUpperCase() },
    { label: "lower case", value: input.toLocaleLowerCase() },
  ];
}
