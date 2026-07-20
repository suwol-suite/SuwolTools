export type JsonSchemaOptions = {
  title?: string;
  includeRequired: boolean;
  allowNull: boolean;
};

type JsonValue =
  | null
  | boolean
  | number
  | string
  | JsonValue[]
  | { [key: string]: JsonValue };

type JsonSchema = Record<string, unknown>;

function isRecord(value: JsonValue): value is { [key: string]: JsonValue } {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function mergeSchemas(schemas: JsonSchema[]): JsonSchema {
  const uniqueSchemas = Array.from(
    new Map(schemas.map((schema) => [JSON.stringify(schema), schema])).values(),
  );

  if (uniqueSchemas.length === 0) {
    return {};
  }

  if (uniqueSchemas.length === 1) {
    return uniqueSchemas[0];
  }

  const simpleTypes = uniqueSchemas
    .map((schema) => schema.type)
    .filter((type): type is string => typeof type === "string");

  if (
    simpleTypes.length === uniqueSchemas.length &&
    uniqueSchemas.every((schema) => Object.keys(schema).length === 1)
  ) {
    return { type: Array.from(new Set(simpleTypes)) };
  }

  return { anyOf: uniqueSchemas };
}

function withNullable(schema: JsonSchema, allowNull: boolean): JsonSchema {
  if (!allowNull || schema.type === "null") {
    return schema;
  }

  if (typeof schema.type === "string") {
    return { ...schema, type: [schema.type, "null"] };
  }

  if (Array.isArray(schema.type) && !schema.type.includes("null")) {
    return { ...schema, type: [...schema.type, "null"] };
  }

  return schema;
}

function inferSchema(value: JsonValue, options: JsonSchemaOptions): JsonSchema {
  if (value === null) {
    return { type: "null" };
  }

  if (Array.isArray(value)) {
    return {
      type: "array",
      items: mergeSchemas(value.map((item) => inferSchema(item, options))),
    };
  }

  if (isRecord(value)) {
    const properties = Object.fromEntries(
      Object.entries(value).map(([key, propertyValue]) => [
        key,
        withNullable(inferSchema(propertyValue, options), options.allowNull),
      ]),
    );
    const schema: JsonSchema = {
      type: "object",
      properties,
    };

    if (options.includeRequired) {
      schema.required = Object.keys(value);
    }

    return schema;
  }

  if (Number.isInteger(value)) {
    return { type: "integer" };
  }

  return { type: typeof value };
}

export function generateJsonSchema(input: string, options: JsonSchemaOptions): string {
  const parsed = JSON.parse(input) as JsonValue;
  const schema: JsonSchema = {
    $schema: "http://json-schema.org/draft-07/schema#",
    ...inferSchema(parsed, options),
  };

  if (options.title?.trim()) {
    schema.title = options.title.trim();
  }

  return JSON.stringify(schema, null, 2);
}
