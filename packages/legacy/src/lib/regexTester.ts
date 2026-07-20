export type RegexMatch = {
  index: number;
  text: string;
  groups: string[];
  namedGroups: Record<string, string>;
};

export type RegexTestResult = {
  matches: RegexMatch[];
  flags: string;
  error: string;
  truncated: boolean;
};

const maxMatches = 500;

export function runRegexTest(pattern: string, flags: string, text: string): RegexTestResult {
  if (!pattern || !text) {
    return {
      matches: [],
      flags,
      error: "",
      truncated: false,
    };
  }

  try {
    const uniqueFlags = Array.from(new Set(flags.split(""))).join("");
    const regex = new RegExp(pattern, uniqueFlags);
    const matches: RegexMatch[] = [];

    if (!regex.global) {
      const match = regex.exec(text);

      if (match) {
        matches.push(toRegexMatch(match));
      }

      return {
        matches,
        flags: uniqueFlags,
        error: "",
        truncated: false,
      };
    }

    let match: RegExpExecArray | null = regex.exec(text);

    while (match && matches.length < maxMatches) {
      matches.push(toRegexMatch(match));

      if (match[0] === "") {
        regex.lastIndex += 1;
      }

      match = regex.exec(text);
    }

    return {
      matches,
      flags: uniqueFlags,
      error: "",
      truncated: Boolean(match),
    };
  } catch (error) {
    return {
      matches: [],
      flags,
      error: error instanceof Error ? error.message : "Invalid regular expression.",
      truncated: false,
    };
  }
}

export function formatRegexResults(result: RegexTestResult): string {
  if (result.error) {
    return result.error;
  }

  if (result.matches.length === 0) {
    return "No matches.";
  }

  return result.matches
    .map((match, index) => {
      const groups =
        match.groups.length > 0
          ? `\n  groups: ${match.groups.map((group) => group ?? "").join(", ")}`
          : "";
      const namedGroups =
        Object.keys(match.namedGroups).length > 0
          ? `\n  named groups: ${JSON.stringify(match.namedGroups)}`
          : "";

      return `${index + 1}. index ${match.index}: ${match.text}${groups}${namedGroups}`;
    })
    .join("\n");
}

function toRegexMatch(match: RegExpExecArray): RegexMatch {
  return {
    index: match.index,
    text: match[0],
    groups: match.slice(1),
    namedGroups: match.groups ? { ...match.groups } : {},
  };
}
