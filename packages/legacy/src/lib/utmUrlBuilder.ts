export type UtmParams = {
  baseUrl: string;
  source: string;
  medium: string;
  campaign: string;
  term: string;
  content: string;
};

export function buildUtmUrl(params: UtmParams): string {
  const parsed = new URL(params.baseUrl.trim());
  const entries = [
    ["utm_source", params.source],
    ["utm_medium", params.medium],
    ["utm_campaign", params.campaign],
    ["utm_term", params.term],
    ["utm_content", params.content],
  ] as const;

  entries.forEach(([key, value]) => {
    if (value.trim()) {
      parsed.searchParams.set(key, value.trim());
    } else {
      parsed.searchParams.delete(key);
    }
  });

  return parsed.toString();
}
