import { fold, STOPWORDS } from './seo';
import type { KeywordVideo } from './types';

export type ContentLanguage = 'es' | 'en';

export interface TitleInsights {
  sampleSize: number;
  averageLength: number;
  medianLength: number;
  keywordAtStart: number;
  withNumber: number;
  withYear: number;
  withBrackets: number;
  withQuestion: number;
  withColon: number;
  withPowerWord: number;
  powerWords: string[];
  nouns: string[];
  angles: string[];
  numbers: string[];
  language: ContentLanguage;
}

const ES_HINTS = new Set([
  'como', 'que', 'para', 'con', 'por', 'sin', 'desde', 'guia', 'tutorial',
  'trucos', 'truco', 'errores', 'error', 'consejos', 'claves', 'secretos',
  'paso', 'principiantes', 'principiante', 'avanzado', 'completo', 'mejor',
  'facil', 'rapido', 'gratis', 'nuevo', 'funciona', 'real', 'probado',
]);

const EN_HINTS = new Set([
  'the', 'and', 'how', 'what', 'why', 'guide', 'tutorial', 'tips', 'tricks',
  'mistakes', 'step', 'from', 'without', 'best', 'easy', 'fast', 'free', 'new',
  'beginner', 'beginners', 'advanced', 'complete', 'secret', 'works', 'real',
  'tested',
]);

const POWER_WORDS = [
  'como', 'guia', 'tutorial', 'secreto', 'error', 'truco', 'mejor', 'facil',
  'rapido', 'gratis', 'nuevo', 'principiante', 'avanzado', 'completo',
  'definitivo', 'funciona', 'real', 'probado', 'paso a paso', 'desde cero',
  'how', 'guide', 'secret', 'mistake', 'trick', 'best', 'easy', 'fast', 'free',
  'beginner', 'advanced', 'ultimate', 'works', 'tested', 'step by step',
  'from scratch',
];

const ANGLE_PATTERNS = [
  /\bpara\s+[\p{L}\p{N}]+(?:\s+[\p{L}\p{N}]+){0,2}/giu,
  /\bsin\s+[\p{L}\p{N}]+(?:\s+[\p{L}\p{N}]+){0,2}/giu,
  /\bdesde\s+[\p{L}\p{N}]+(?:\s+[\p{L}\p{N}]+){0,2}/giu,
  /\bfor\s+[\p{L}\p{N}]+(?:\s+[\p{L}\p{N}]+){0,2}/giu,
  /\bwithout\s+[\p{L}\p{N}]+(?:\s+[\p{L}\p{N}]+){0,2}/giu,
  /\bfrom\s+[\p{L}\p{N}]+(?:\s+[\p{L}\p{N}]+){0,2}/giu,
  /\bpaso a paso\b/giu,
  /\bstep by step\b/giu,
];

const SPANISH_NUMBERS = new Set(['3', '4', '5', '6', '7', '8', '9', '10', '11', '12']);

export function detectContentLanguage(text: string): ContentLanguage {
  const words = text
    .toLocaleLowerCase()
    .split(/[^\p{L}]+/u)
    .map((word) => fold(word))
    .filter(Boolean);

  let spanish = 0;
  let english = 0;
  for (const word of words) {
    if (ES_HINTS.has(word)) spanish += 1;
    if (EN_HINTS.has(word)) english += 1;
  }

  return english > spanish ? 'en' : 'es';
}

export function analyzeTitleInsights(
  keyword: string,
  videos: KeywordVideo[],
): TitleInsights {
  const sampleSize = videos.length;
  const lengths = videos.map((video) => Array.from(video.title).length);
  const averageLength =
    sampleSize > 0
      ? Math.round(lengths.reduce((sum, length) => sum + length, 0) / sampleSize)
      : 0;
  const sortedLengths = [...lengths].sort((a, b) => a - b);
  const medianLength =
    sampleSize > 0
      ? sampleSize % 2 === 1
        ? sortedLengths[Math.floor(sampleSize / 2)]
        : Math.round(
            (sortedLengths[sampleSize / 2 - 1] + sortedLengths[sampleSize / 2]) / 2,
          )
      : 0;

  const foldedKeyword = fold(keyword).trim();
  let keywordAtStart = 0;
  let withNumber = 0;
  let withYear = 0;
  let withBrackets = 0;
  let withQuestion = 0;
  let withColon = 0;

  const phraseStats = new Map<string, { count: number; views: number }>();
  const angleStats = new Map<string, number>();
  const numberStats = new Map<string, number>();
  const powerStats = new Map<string, number>();

  for (const video of videos) {
    const title = video.title;
    const folded = fold(title);
    if (foldedKeyword && folded.trim().startsWith(foldedKeyword)) keywordAtStart += 1;
    if (/\d/.test(title.replace(/20\d{2}/g, ''))) withNumber += 1;
    if (/20\d{2}/.test(title)) withYear += 1;
    if (/[[\](){}]/.test(title)) withBrackets += 1;
    if (/[?¿]/.test(title) || /^(como|que|por que|how|what|why)\b/i.test(folded)) {
      withQuestion += 1;
    }
    if (/[:|]/.test(title)) withColon += 1;

    for (const power of POWER_WORDS) {
      if (folded.includes(fold(power))) {
        powerStats.set(power, (powerStats.get(power) ?? 0) + 1);
      }
    }

    for (const match of title.match(/\b(?:[3-9]|1[0-2])\b/g) ?? []) {
      if (SPANISH_NUMBERS.has(match)) {
        numberStats.set(match, (numberStats.get(match) ?? 0) + 1);
      }
    }

    for (const pattern of ANGLE_PATTERNS) {
      for (const match of title.match(pattern) ?? []) {
        const angle = cleanPhrase(match);
        if (angle) angleStats.set(angle, (angleStats.get(angle) ?? 0) + 1);
      }
    }

    const tokens = tokenize(title);
    const candidates = new Set<string>();
    for (let index = 0; index < tokens.length; index += 1) {
      candidates.add(tokens[index]);
      if (index + 1 < tokens.length) {
        candidates.add(`${tokens[index]} ${tokens[index + 1]}`);
      }
    }

    for (const phrase of candidates) {
      const entry = phraseStats.get(phrase) ?? { count: 0, views: 0 };
      entry.count += 1;
      entry.views += video.views;
      phraseStats.set(phrase, entry);
    }
  }

  const nouns = [...phraseStats.entries()]
    .filter(([, stats]) => stats.count >= 2)
    .sort((a, b) => b[1].count - a[1].count || b[1].views - a[1].views)
    .map(([text]) => text)
    .filter((text) => text && text !== foldedKeyword)
    .slice(0, 8);

  const angles = [...angleStats.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([text]) => text)
    .filter((text) => text && fold(text) !== foldedKeyword)
    .slice(0, 8);

  const numbers = [...numberStats.entries()]
    .sort((a, b) => b[1] - a[1] || Number(a[0]) - Number(b[0]))
    .map(([number]) => number)
    .slice(0, 4);

  const powerWords = [...powerStats.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([word]) => word)
    .slice(0, 6);

  return {
    sampleSize,
    averageLength,
    medianLength,
    keywordAtStart,
    withNumber,
    withYear,
    withBrackets,
    withQuestion,
    withColon,
    withPowerWord: powerWords.length,
    powerWords,
    nouns,
    angles,
    numbers,
    language: detectContentLanguage(
      [keyword, ...videos.map((video) => video.title)].join(' '),
    ),
  };
}

function tokenize(title: string): string[] {
  return title
    .split(/[^\p{L}\p{N}]+/u)
    .map((word) => fold(word))
    .filter((word) => word.length > 2 && !STOPWORDS.has(word));
}

function cleanPhrase(value: string): string {
  return value
    .replace(/\s+/g, ' ')
    .replace(/[.,;:!?¿¡|()[\]{}]+$/g, '')
    .trim()
    .toLocaleLowerCase();
}
