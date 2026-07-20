export type CsvDelimiter = "," | ";" | "\t";
export declare function csvToJson(input: string, delimiter: CsvDelimiter, useHeader: boolean): string;
export declare function jsonToCsv(input: string, delimiter: CsvDelimiter, includeHeader: boolean): string;
