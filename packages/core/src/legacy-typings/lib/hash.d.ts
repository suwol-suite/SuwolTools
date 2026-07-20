export declare const defaultSelectedHashAlgorithms: string[];
export declare function hashBytes(data: Uint8Array, algorithm: string): Promise<Uint8Array>;
export declare function formatHashOutput(bytes: Uint8Array, format: "hex-lower" | "hex-upper" | "base64"): string;
export declare function hmacText(value: string, secret: string, algorithm: "HMAC-SHA1" | "HMAC-SHA256" | "HMAC-SHA384" | "HMAC-SHA512"): Promise<string>;
