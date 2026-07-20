export declare function runJsonPath(jsonText: string, expression: string): Array<{ path: string; value: unknown }>;
export declare function stringifyJsonPathResult(matches: Array<{ path: string; value: unknown }>): string;
