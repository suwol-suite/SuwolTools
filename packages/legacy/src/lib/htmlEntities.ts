export type HtmlEntityDefinition = {
  entity: string;
  character: string;
  name: string;
  description: string;
};

export const htmlEntityDefinitions: HtmlEntityDefinition[] = [
  { entity: "&amp;", character: "&", name: "Ampersand", description: "Escapes an ampersand." },
  { entity: "&lt;", character: "<", name: "Less than", description: "Escapes an opening angle bracket." },
  { entity: "&gt;", character: ">", name: "Greater than", description: "Escapes a closing angle bracket." },
  { entity: "&quot;", character: "\"", name: "Double quote", description: "Escapes a double quotation mark." },
  { entity: "&apos;", character: "'", name: "Apostrophe", description: "Escapes a single quotation mark." },
  { entity: "&nbsp;", character: "\u00a0", name: "Non-breaking space", description: "Keeps adjacent text on the same line." },
  { entity: "&copy;", character: "\u00a9", name: "Copyright", description: "Copyright sign." },
  { entity: "&reg;", character: "\u00ae", name: "Registered", description: "Registered trademark sign." },
  { entity: "&trade;", character: "\u2122", name: "Trademark", description: "Trademark sign." },
  { entity: "&euro;", character: "\u20ac", name: "Euro", description: "Euro currency sign." },
  { entity: "&pound;", character: "\u00a3", name: "Pound", description: "Pound currency sign." },
  { entity: "&yen;", character: "\u00a5", name: "Yen", description: "Yen currency sign." },
  { entity: "&cent;", character: "\u00a2", name: "Cent", description: "Cent currency sign." },
  { entity: "&deg;", character: "\u00b0", name: "Degree", description: "Degree sign." },
  { entity: "&plusmn;", character: "\u00b1", name: "Plus minus", description: "Plus-minus sign." },
  { entity: "&times;", character: "\u00d7", name: "Multiply", description: "Multiplication sign." },
  { entity: "&divide;", character: "\u00f7", name: "Divide", description: "Division sign." },
  { entity: "&mdash;", character: "\u2014", name: "Em dash", description: "Long dash." },
  { entity: "&ndash;", character: "\u2013", name: "En dash", description: "Medium dash." },
  { entity: "&hellip;", character: "\u2026", name: "Ellipsis", description: "Horizontal ellipsis." },
  { entity: "&laquo;", character: "\u00ab", name: "Left guillemet", description: "Left angle quote." },
  { entity: "&raquo;", character: "\u00bb", name: "Right guillemet", description: "Right angle quote." },
];

const characterToEntity = new Map(
  htmlEntityDefinitions.map((definition) => [definition.character, definition.entity]),
);

const entityToCharacter = new Map(
  htmlEntityDefinitions.map((definition) => [definition.entity, definition.character]),
);

export function encodeHtmlEntities(input: string): string {
  return Array.from(input)
    .map((character) => {
      const named = characterToEntity.get(character);

      if (named) {
        return named;
      }

      const codePoint = character.codePointAt(0) ?? 0;
      return codePoint > 126 ? `&#${codePoint};` : character;
    })
    .join("");
}

export function decodeHtmlEntities(input: string): string {
  return input.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (entity, body: string) => {
    const named = entityToCharacter.get(entity);

    if (named) {
      return named;
    }

    if (body.startsWith("#x") || body.startsWith("#X")) {
      const codePoint = Number.parseInt(body.slice(2), 16);
      return Number.isFinite(codePoint) && codePoint >= 0 && codePoint <= 0x10ffff
        ? String.fromCodePoint(codePoint)
        : entity;
    }

    if (body.startsWith("#")) {
      const codePoint = Number.parseInt(body.slice(1), 10);
      return Number.isFinite(codePoint) && codePoint >= 0 && codePoint <= 0x10ffff
        ? String.fromCodePoint(codePoint)
        : entity;
    }

    return entity;
  });
}
