export declare function compareTexts(leftText: string, rightText: string, options: { ignoreWhitespace: boolean; ignoreCase: boolean }): { rows: unknown[]; summary: Record<string, number> };
export declare function formatTextDiff(result: { rows: unknown[]; summary: Record<string, number> }): string;
