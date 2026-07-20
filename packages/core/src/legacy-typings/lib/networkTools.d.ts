export type PortProtocol = "TCP" | "UDP";
export type PortEntry = { port: number; protocol: "TCP" | "UDP"; service: string; description: string; risk: "low" | "medium" | "high" };
export type IpCalculationResult = Record<string, unknown>;
export declare function calculateIpv4Subnet(addressInput: string, prefixInput: string): IpCalculationResult;
export declare function searchPorts(query: string, protocol: "all" | PortProtocol): PortEntry[];
export declare function analyzePingTrace(input: string): Record<string, unknown>;
export declare function parsePemCertificate(pem: string): Promise<Record<string, unknown>>;
