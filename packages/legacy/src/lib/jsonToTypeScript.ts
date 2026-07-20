export type TypeScriptOutputKind = "interface" | "type";

export type JsonToTypeScriptOptions = {
  rootName: string;
  outputKind: TypeScriptOutputKind;
  optionalProperties: boolean;
  separateNestedTypes: boolean;
  nullAsOptional: boolean;
};

type JsonValue =
  | null
  | boolean
  | number
  | string
  | JsonValue[]
  | { [key: string]: JsonValue };

function isRecord(value: JsonValue): value is { [key: string]: JsonValue } {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toPascalCase(value: string): string {
  const converted = value
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join("");

  return converted || "GeneratedType";
}

function propertyName(key: string): string {
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(key) ? key : JSON.stringify(key);
}

function mergeTypes(types: string[]): string {
  const uniqueTypes = Array.from(new Set(types));

  if (uniqueTypes.length === 0) {
    return "unknown";
  }

  if (uniqueTypes.length === 1) {
    return uniqueTypes[0];
  }

  return uniqueTypes.sort().join(" | ");
}

function inferType(
  value: JsonValue,
  name: string,
  options: JsonToTypeScriptOptions,
  declarations: Map<string, string>,
): string {
  if (value === null) {
    return options.nullAsOptional ? "unknown" : "null";
  }

  if (Array.isArray(value)) {
    const itemType = mergeTypes(
      value.map((item, index) => inferType(item, `${name}Item${index + 1}`, options, declarations)),
    );

    return itemType.includes(" | ") ? `Array<${itemType}>` : `${itemType}[]`;
  }

  if (!isRecord(value)) {
    return typeof value;
  }

  const body = Object.entries(value)
    .map(([key, propertyValue]) => {
      const optional = options.optionalProperties || (options.nullAsOptional && propertyValue === null);
      const nestedName = `${name}${toPascalCase(key)}`;
      const type = inferType(propertyValue, nestedName, options, declarations);

      return `  ${propertyName(key)}${optional ? "?" : ""}: ${type};`;
    })
    .join("\n");

  if (!options.separateNestedTypes) {
    return `{\n${body}\n}`;
  }

  const typeName = toPascalCase(name);
  const declaration =
    options.outputKind === "interface"
      ? `interface ${typeName} {\n${body}\n}`
      : `type ${typeName} = {\n${body}\n};`;

  declarations.set(typeName, declaration);
  return typeName;
}

export function generateTypeScriptFromJson(
  input: string,
  options: JsonToTypeScriptOptions,
): string {
  const parsed = JSON.parse(input) as JsonValue;
  const rootName = toPascalCase(options.rootName || "Root");
  const declarations = new Map<string, string>();

  if (isRecord(parsed) && options.separateNestedTypes) {
    inferType(parsed, rootName, options, declarations);
    return Array.from(declarations.values()).reverse().join("\n\n");
  }

  const rootType = inferType(parsed, rootName, options, declarations);
  const rootDeclaration =
    options.outputKind === "interface" && rootType.startsWith("{")
      ? `interface ${rootName} ${rootType}`
      : `type ${rootName} = ${rootType};`;

  return [...Array.from(declarations.values()).reverse(), rootDeclaration].join("\n\n").trim();
}
