const PARTICLES_AND_AUXILIARIES = new Set([
  "は",
  "が",
  "を",
  "に",
  "へ",
  "と",
  "で",
  "の",
  "も",
  "や",
  "か",
  "から",
  "まで",
  "より",
  "ほど",
  "だけ",
  "しか",
  "など",
  "って",
  "では",
  "には",
  "とは",
  "なら",
  "ので",
  "のに",
  "ても",
  "でも",
  "ば",
  "し",
  "ね",
  "よ",
  "ぞ",
  "さ",
  "な",
  "です",
  "ます",
  "ない",
  "たい",
  "た",
  "だ",
  "く",
  "れ",
  "れる",
  "られる",
  "せる",
  "させる",
  "う",
]);

const PREFERRED_BREAK_PARTICLES = [
  "から",
  "まで",
  "より",
  "ほど",
  "だけ",
  "しか",
  "など",
  "って",
  "では",
  "には",
  "とは",
  "なら",
  "ので",
  "のに",
  "ても",
  "でも",
  "は",
  "が",
  "を",
  "に",
  "へ",
  "と",
  "で",
  "の",
  "も",
  "や",
  "か",
  "ば",
  "し",
  "ね",
  "よ",
  "ぞ",
] as const;

const OPENING_PUNCTUATION = new Set(["（", "(", "［", "[", "｛", "{", "「", "『", "【", "〈", "《", "“", "‘"]);
const CLOSING_PUNCTUATION = new Set([
  "、",
  "。",
  "，",
  "．",
  ",",
  ".",
  "！",
  "!",
  "？",
  "?",
  "：",
  ":",
  "；",
  ";",
  "）",
  ")",
  "］",
  "]",
  "｝",
  "}",
  "」",
  "』",
  "】",
  "〉",
  "》",
  "”",
  "’",
  "…",
  "ー",
]);
const SENTENCE_PUNCTUATION_AT_END = /[、。，．,.！？!?：:；;](?:[」』】〉》”’）)］\]｝}])*$/u;

const segmenter = new Intl.Segmenter("ja", { granularity: "word" });
const layoutCache = new Map<string, SubtitleLayout>();
const MAX_CACHE_ENTRIES = 500;

export const SUBTITLE_LAYOUT = {
  maxFontSize: 58,
  minFontSize: 24,
  lineHeight: 1.45,
  maxWidthPx: 1560,
  maxHeightPx: 205,
  strokePx: 10,
} as const;

export type SubtitleLayout = {
  lines: string[];
  fontSize: number;
};

export function segmentSubtitlePhrases(text: string): string[] {
  const phrases: string[] = [];
  for (const { segment } of segmenter.segment(text)) {
    if (!segment) continue;
    if (/^\s+$/u.test(segment)) {
      if (phrases.length > 0) phrases[phrases.length - 1] += segment;
      continue;
    }

    const previous = phrases.at(-1);
    if (
      previous &&
      (PARTICLES_AND_AUXILIARIES.has(segment) ||
        CLOSING_PUNCTUATION.has(segment) ||
        OPENING_PUNCTUATION.has(previous.trim()))
    ) {
      phrases[phrases.length - 1] += segment;
    } else {
      phrases.push(segment);
    }
  }

  return phrases.reduce<string[]>((combined, phrase, index) => {
    if (/^[ぁ-ゖ]$/u.test(phrase) && index < phrases.length - 1) {
      combined.push(phrase);
      return combined;
    }
    const previous = combined.at(-1);
    if (previous && /^[ぁ-ゖ]$/u.test(previous)) {
      combined[combined.length - 1] += phrase;
    } else {
      combined.push(phrase);
    }
    return combined;
  }, []);
}

export function layoutSubtitleText(text: string): SubtitleLayout {
  const cached = layoutCache.get(text);
  if (cached) return cached;

  const paragraphs = text.replaceAll("\r\n", "\n").split("\n");
  let largestFittingLayout: SubtitleLayout | null = null;
  for (let fontSize = SUBTITLE_LAYOUT.maxFontSize; fontSize >= SUBTITLE_LAYOUT.minFontSize; fontSize -= 1) {
    const lines = wrapParagraphs(paragraphs, fontSize);
    if (!fits(lines, fontSize)) continue;
    const layout = { lines, fontSize };
    largestFittingLayout ??= layout;
    if (text.includes("\n") || !hasLineBreakInsideQuotes(lines)) return cacheLayout(text, layout);
  }

  return cacheLayout(
    text,
    largestFittingLayout ?? {
      lines: wrapParagraphs(paragraphs, SUBTITLE_LAYOUT.minFontSize),
      fontSize: SUBTITLE_LAYOUT.minFontSize,
    },
  );
}

function wrapParagraphs(paragraphs: string[], fontSize: number) {
  const maximumUnits = SUBTITLE_LAYOUT.maxWidthPx / fontSize;
  return paragraphs.flatMap((paragraph) => wrapPhrases(segmentSubtitlePhrases(paragraph), maximumUnits));
}

function wrapPhrases(phrases: string[], maximumUnits: number) {
  if (phrases.length === 0) return [""];
  const greedyLines: string[][] = [];
  let line: string[] = [];

  for (const phrase of phrases) {
    const candidate = [...line, phrase].join("").trimStart();
    if (line.length > 0 && estimateTextUnits(candidate) > maximumUnits) {
      greedyLines.push(line);
      line = [phrase.trimStart()];
    } else {
      line.push(line.length === 0 ? phrase.trimStart() : phrase);
    }
  }
  greedyLines.push(line);
  let linePhrases = chooseNaturalLineBreaks(phrases, maximumUnits, greedyLines.length) ?? greedyLines;
  if (hasLargeLineImbalance(linePhrases)) {
    linePhrases = chooseNaturalLineBreaks(phrases, maximumUnits, greedyLines.length, true) ?? linePhrases;
  }
  return linePhrases.map((items) => items.join("").trim());
}

function chooseNaturalLineBreaks(
  phrases: string[],
  maximumUnits: number,
  lineCount: number,
  prioritizeBalance = false,
) {
  const quoteDepths = getQuoteDepthsAtBoundaries(phrases);
  const memo = new Map<string, { cost: number; lines: string[][] } | null>();

  const visit = (start: number, remainingLines: number): { cost: number; lines: string[][] } | null => {
    const memoKey = `${start}:${remainingLines}`;
    if (memo.has(memoKey)) return memo.get(memoKey)!;
    if (remainingLines === 1) {
      const finalLine = phrases.slice(start);
      const width = estimateTextUnits(finalLine.join("").trim());
      const result =
        finalLine.length > 0 && width <= maximumUnits
          ? { cost: raggednessCost(width, maximumUnits, prioritizeBalance), lines: [finalLine] }
          : null;
      memo.set(memoKey, result);
      return result;
    }

    let best: { cost: number; lines: string[][] } | null = null;
    const lastEnd = phrases.length - remainingLines + 1;
    for (let end = start + 1; end <= lastEnd; end += 1) {
      const currentLine = phrases.slice(start, end);
      const width = estimateTextUnits(currentLine.join("").trim());
      if (width > maximumUnits) break;
      const rest = visit(end, remainingLines - 1);
      if (!rest) continue;
      const cost =
        boundaryCost(phrases[end - 1], phrases[end], quoteDepths[end - 1], prioritizeBalance) +
        raggednessCost(width, maximumUnits, prioritizeBalance) +
        rest.cost;
      if (!best || cost < best.cost) best = { cost, lines: [currentLine, ...rest.lines] };
    }
    memo.set(memoKey, best);
    return best;
  };

  return visit(0, lineCount)?.lines ?? null;
}

function boundaryCost(previousPhrase: string, nextPhrase: string, quoteDepth: number, prioritizeBalance: boolean) {
  if (quoteDepth > 0) return 1_000;
  const text = previousPhrase.trimEnd();
  if (nextPhrase.trimStart().startsWith("「") || nextPhrase.trimStart().startsWith("『")) return 0;
  if (text.endsWith("」") || text.endsWith("』")) return 0;
  if (SENTENCE_PUNCTUATION_AT_END.test(text)) return prioritizeBalance ? 4 : 2;
  if (PREFERRED_BREAK_PARTICLES.some((particle) => text.endsWith(particle))) return prioritizeBalance ? 5 : 6;
  return prioritizeBalance ? 7 : 10;
}

function raggednessCost(width: number, maximumUnits: number, prioritizeBalance = false) {
  return (Math.max(0, maximumUnits - width) / maximumUnits) ** 2 * (prioritizeBalance ? 40 : 4);
}

function hasLargeLineImbalance(lines: string[][]) {
  if (lines.length < 2) return false;
  const widths = lines.map((line) => estimateTextUnits(line.join("").trim())).filter((width) => width > 0);
  return widths.length >= 2 && Math.max(...widths) >= Math.min(...widths) * 2;
}

function getQuoteDepthsAtBoundaries(phrases: string[]) {
  let depth = 0;
  return phrases.map((phrase) => {
    for (const character of phrase) {
      if (character === "「" || character === "『") depth += 1;
      else if (character === "」" || character === "』") depth = Math.max(0, depth - 1);
    }
    return depth;
  });
}

function hasLineBreakInsideQuotes(lines: string[]) {
  let depth = 0;
  return lines.some((line, index) => {
    for (const character of line) {
      if (character === "「" || character === "『") depth += 1;
      else if (character === "」" || character === "』") depth = Math.max(0, depth - 1);
    }
    return index < lines.length - 1 && depth > 0;
  });
}

function fits(lines: string[], fontSize: number) {
  const height = lines.length * fontSize * SUBTITLE_LAYOUT.lineHeight + SUBTITLE_LAYOUT.strokePx * 2;
  return (
    height <= SUBTITLE_LAYOUT.maxHeightPx &&
    lines.every((line) => estimateTextUnits(line) * fontSize <= SUBTITLE_LAYOUT.maxWidthPx)
  );
}

function estimateTextUnits(text: string) {
  let units = 0;
  for (const character of text) {
    if (/\p{Mark}/u.test(character)) continue;
    if (/\s/u.test(character)) units += 0.33;
    else if (/^[\x20-\x7e]$/u.test(character)) units += 0.62;
    else units += 1;
  }
  return units;
}

function cacheLayout(text: string, layout: SubtitleLayout) {
  if (layoutCache.size >= MAX_CACHE_ENTRIES) {
    const oldestKey = layoutCache.keys().next().value;
    if (oldestKey !== undefined) layoutCache.delete(oldestKey);
  }
  layoutCache.set(text, layout);
  return layout;
}
