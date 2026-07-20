export type LoremIpsumType = "words" | "sentences" | "paragraphs";

export type LoremIpsumOptions = {
  type: LoremIpsumType;
  count: number;
  startWithLorem: boolean;
  includeLineBreaks: boolean;
};

export const loremIpsumLimits: Record<LoremIpsumType, { min: number; max: number }> = {
  words: { min: 1, max: 500 },
  sentences: { min: 1, max: 100 },
  paragraphs: { min: 1, max: 50 },
};

const loremWords = [
  "lorem",
  "ipsum",
  "dolor",
  "sit",
  "amet",
  "consectetur",
  "adipiscing",
  "elit",
  "sed",
  "do",
  "eiusmod",
  "tempor",
  "incididunt",
  "ut",
  "labore",
  "et",
  "dolore",
  "magna",
  "aliqua",
  "enim",
  "ad",
  "minim",
  "veniam",
  "quis",
  "nostrud",
  "exercitation",
  "ullamco",
  "laboris",
  "nisi",
  "aliquip",
  "ex",
  "ea",
  "commodo",
  "consequat",
  "duis",
  "aute",
  "irure",
  "reprehenderit",
  "voluptate",
  "velit",
  "esse",
  "cillum",
  "fugiat",
  "nulla",
  "pariatur",
  "excepteur",
  "sint",
  "occaecat",
  "cupidatat",
  "non",
  "proident",
  "sunt",
  "culpa",
  "officia",
  "deserunt",
  "mollit",
  "anim",
  "id",
  "est",
  "laborum",
];

function clampCount(type: LoremIpsumType, count: number): number {
  const limit = loremIpsumLimits[type];

  return Math.max(limit.min, Math.min(limit.max, Math.round(count)));
}

function getWord(index: number): string {
  return loremWords[index % loremWords.length];
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function createWords(count: number, startIndex: number): string[] {
  return Array.from({ length: count }, (_, index) => getWord(startIndex + index));
}

function createSentence(startIndex: number, wordCount: number): string {
  const words = createWords(wordCount, startIndex);

  return `${capitalize(words.join(" "))}.`;
}

function createParagraph(startIndex: number, sentenceCount: number): string {
  const sentences: string[] = [];
  let offset = startIndex;

  for (let index = 0; index < sentenceCount; index += 1) {
    const wordCount = 8 + ((startIndex + index) % 9);
    sentences.push(createSentence(offset, wordCount));
    offset += wordCount;
  }

  return sentences.join(" ");
}

function randomStartIndex(startWithLorem: boolean): number {
  return startWithLorem ? 0 : Math.floor(Math.random() * loremWords.length);
}

export function generateLoremIpsum(options: LoremIpsumOptions): string {
  const count = clampCount(options.type, options.count);
  const startIndex = randomStartIndex(options.startWithLorem);

  if (options.type === "words") {
    const words = createWords(count, startIndex);

    if (!options.includeLineBreaks) {
      return words.join(" ");
    }

    return words
      .reduce<string[]>((lines, word, index) => {
        if (index % 12 === 0) {
          lines.push(word);
        } else {
          lines[lines.length - 1] = `${lines[lines.length - 1]} ${word}`;
        }

        return lines;
      }, [])
      .join("\n");
  }

  if (options.type === "sentences") {
    const sentences = Array.from({ length: count }, (_, index) =>
      createSentence(startIndex + index * 11, 8 + (index % 9)),
    );

    return sentences.join(options.includeLineBreaks ? "\n" : " ");
  }

  const paragraphs = Array.from({ length: count }, (_, index) =>
    createParagraph(startIndex + index * 47, 3 + (index % 3)),
  );

  return paragraphs.join(options.includeLineBreaks ? "\n\n" : " ");
}
