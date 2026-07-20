export declare function runRegexTest(pattern: string, flags: string, text: string): { matches: unknown[]; flags: string; error: string; truncated: boolean };
export declare function formatRegexResults(result: { matches: unknown[]; flags: string; error: string; truncated: boolean }): string;
