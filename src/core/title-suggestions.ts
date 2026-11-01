import { fold } from './seo';
import type { KeywordRecommendations, KeywordVideo } from './types';

export type TitleKind = 'year' | 'number' | 'step';

export interface TitleSuggestion {
  title: string;
  kind: TitleKind;
}

const PLURAL_NOUNS = new Set([
  'trucos',
  'claves',
  'consejos',
  'errores',
  'ajustes',
  'pasos',
  'secretos',
  'ideas',
  'tips',
  'tutoriales',
  'guias',
  'guías',
]);

const PREPOSITION = /^(para|con|sin|desde|en|de|del|por|sobre|hasta)\b/i;

function capitalize(text: string): string {
  const value = text.trim();
  if (!value) return '';
  return value.charAt(0).toLocaleUpperCase() + value.slice(1);
}

function trimToTitle(value: string): string {
  const characters = Array.from(value);
  return characters.length > 100 ? characters.slice(0, 100).join('').trim() : value;
}

/**
 * Builds three editable title drafts from the winning patterns of the top 10:
 * the focus keyword first, plus a year, a number or a step-by-step angle.
 * It is deliberately rule-based: no model, no invented claims.
 */
export function suggestTitles(
  keyword: string,
  recommendations: KeywordRecommendations,
  videos: KeywordVideo[],
  now: Date = new Date(),
): TitleSuggestion[] {
  const base = keyword.replace(/\s+/g, ' ').trim();
  if (!base) return [];

  const capitalized = capitalize(base);
  const keywordFold = fold(base);

  const phrases = recommendations.phrases
    .map((phrase) => phrase.text.replace(/\s+/g, ' ').trim())
    .filter((phrase) => phrase.length > 0 && !keywordFold.includes(fold(phrase)));

  const nounPhrases = phrases.filter((phrase) => !PREPOSITION.test(phrase));
  const prepositionPhrases = phrases.filter((phrase) => PREPOSITION.test(phrase));

  const year = now.getFullYear();
  const yearPhrase = nounPhrases[0] ?? 'guía completa';
  const numberNoun =
    nounPhrases.find((phrase) => PLURAL_NOUNS.has(fold(phrase))) ?? 'trucos';
  const stepSuffix =
    prepositionPhrases.find((phrase) => /^para\b/i.test(phrase)) ?? 'para principiantes';

  const numberCounts = new Map<string, number>();
  for (const video of videos) {
    for (const match of video.title.match(/\b([3-9]|1[0-2])\b/g) ?? []) {
      numberCounts.set(match, (numberCounts.get(match) ?? 0) + 1);
    }
  }
  const number =
    [...numberCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? '5';

  const drafts: TitleSuggestion[] = [
    { title: `${capitalized} en ${year}: ${yearPhrase}`, kind: 'year' },
    { title: `${capitalized}: ${number} ${numberNoun} que funcionan`, kind: 'number' },
    { title: `${capitalized} paso a paso ${stepSuffix}`, kind: 'step' },
  ];

  const seen = new Set<string>();
  const result: TitleSuggestion[] = [];

  for (const draft of drafts) {
    let title = draft.title.replace(/\s+/g, ' ').trim();
    if (!title) continue;

    if (Array.from(title).length < 30) {
      title = `${title} (${year})`;
    }

    title = trimToTitle(title);
    const key = fold(title);
    if (seen.has(key)) continue;

    seen.add(key);
    result.push({ title, kind: draft.kind });
  }

  return result;
}
