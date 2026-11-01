import { clamp, statusForScore, weightedScore } from './score';
import { findDuplicates, normalizeTags, TAG_CHARACTER_LIMIT, tagCharacters } from './tags';
import type { CheckResult } from './types';

export type KeywordSource = 'user' | 'tag' | 'title' | 'none';

export interface SeoSection {
  score: number;
  checks: CheckResult[];
}

export interface SeoReport {
  score: number;
  keyword: string;
  keywordSource: KeywordSource;
  description: SeoSection;
  tags: SeoSection;
  title: SeoSection;
}

export const STOPWORDS = new Set([
  'el', 'la', 'los', 'las', 'un', 'una', 'unos', 'unas', 'de', 'del', 'al', 'en',
  'con', 'por', 'para', 'y', 'o', 'que', 'se', 'su', 'sus', 'tu', 'tus', 'mi',
  'mis', 'es', 'son', 'como', 'the', 'a', 'an', 'of', 'in', 'on', 'with', 'for',
  'and', 'or', 'to', 'my', 'your', 'this', 'that', 'is', 'are', 'it', 'how',
  'what', 'why',
]);

const CTA_PATTERN =
  /(suscr[ií]bete|subscribe|s[ií]gueme|follow|curso|course|descarga|download|compra|buy|instagram|tiktok|discord|patreon|web|newsletter)/i;

export function fold(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase();
}

function contentWords(text: string): string[] {
  return text
    .split(/\s+/)
    .map((word) => word.replace(/[^\p{L}\p{N}]/gu, ''))
    .filter((word) => word.length > 2 && !STOPWORDS.has(fold(word)));
}

function countOccurrences(text: string, needle: string): number {
  const haystack = fold(text);
  const target = fold(needle).trim();
  if (!target) return 0;

  let count = 0;
  let index = 0;
  while ((index = haystack.indexOf(target, index)) !== -1) {
    count += 1;
    index += target.length;
  }
  return count;
}

function makeCheck(
  id: string,
  weight: number,
  score: number,
  value: number,
  unit: CheckResult['unit'],
): CheckResult {
  const normalised = clamp(score, 0, 100);
  return {
    id,
    weight,
    score: normalised,
    status: statusForScore(normalised),
    value,
    unit,
  };
}

function scoreDescriptionLength(words: number): number {
  if (words >= 250) return 100;
  if (words >= 150) return 70 + ((words - 150) / 100) * 30;
  if (words >= 80) return 40 + ((words - 80) / 70) * 30;
  return (words / 80) * 40;
}

function scoreOccurrences(occurrences: number): number {
  if (occurrences === 0) return 0;
  if (occurrences === 1) return 50;
  if (occurrences <= 4) return 100;
  if (occurrences <= 6) return 70;
  return 30;
}

function scoreTagCount(count: number): number {
  if (count >= 15 && count <= 30) return 100;
  if (count > 30) return 60;
  if (count >= 8) return 70;
  if (count > 0) return 40;
  return 0;
}

export function detectKeyword(
  title: string,
  tags: string[],
  explicit?: string | null,
): { keyword: string; source: KeywordSource } {
  const manual = (explicit ?? '').trim();
  if (manual) return { keyword: manual, source: 'user' };

  const firstTag = tags.map((tag) => tag.trim()).find((tag) => tag.length >= 3);
  if (firstTag) return { keyword: firstTag, source: 'tag' };

  const fromTitle = contentWords(title).slice(0, 2);
  const fallback = fromTitle.length > 0 ? fromTitle : title.trim().split(/\s+/).slice(0, 2);
  const keyword = fallback.join(' ').trim();

  return { keyword, source: keyword ? 'title' : 'none' };
}

function descriptionSection(description: string, keyword: string): SeoSection {
  const text = description.trim();
  const wordCount = text ? text.split(/\s+/).filter(Boolean).length : 0;
  const firstLines = text.slice(0, 160);
  const occurrences = keyword ? countOccurrences(text, keyword) : 0;
  const links = (text.match(/https?:\/\/\S+/gi) ?? []).length;
  const timestamps = (text.match(/(?:^|\s)\d{1,2}:\d{2}(?::\d{2})?(?=\s|$)/g) ?? []).length;
  const hashtags = (text.match(/(?:^|\s)#[\p{L}\p{N}_]+/gu) ?? []).length;
  const hasCta = CTA_PATTERN.test(text);

  const firstLinesScore = !keyword
    ? 30
    : fold(firstLines).includes(fold(keyword))
      ? 100
      : firstLines.length >= 20
        ? 50
        : 0;

  const checks: CheckResult[] = [
    makeCheck('seoDescriptionLength', 25, scoreDescriptionLength(wordCount), wordCount, 'words'),
    makeCheck('seoDescriptionFirstLines', 20, firstLinesScore, firstLines.length, 'chars'),
    makeCheck('seoDescriptionKeyword', 20, scoreOccurrences(occurrences), occurrences, 'count'),
    makeCheck(
      'seoDescriptionLinks',
      15,
      links > 0 || timestamps >= 3 ? 100 : timestamps > 0 ? 70 : 50,
      links + timestamps,
      'count',
    ),
    makeCheck(
      'seoDescriptionHashtags',
      10,
      hashtags >= 3 && hashtags <= 5 ? 100 : hashtags === 0 ? 40 : 60,
      hashtags,
      'count',
    ),
    makeCheck('seoDescriptionCta', 10, hasCta ? 100 : 50, 0, 'score'),
  ];

  return { score: weightedScore(checks), checks };
}

function tagsSection(tags: string[], keyword: string): SeoSection {
  const unique = normalizeTags(tags);
  const count = unique.length;
  const exact = keyword ? unique.some((tag) => fold(tag) === fold(keyword)) : false;
  const keywordWords = contentWords(keyword);
  const allWords =
    keywordWords.length > 0 &&
    keywordWords.every((word) => unique.some((tag) => fold(tag).includes(fold(word))));
  const longTail = unique.filter((tag) => tag.split(/\s+/).filter(Boolean).length >= 2).length;
  const duplicates = findDuplicates(tags).length;
  const chars = tagCharacters(unique);

  const checks: CheckResult[] = [
    makeCheck('seoTagsCount', 30, scoreTagCount(count), count, 'count'),
    makeCheck('seoTagsKeyword', 25, !keyword ? 0 : exact ? 100 : allWords ? 60 : 0, 0, 'score'),
    makeCheck('seoTagsLongTail', 20, longTail >= 3 ? 100 : longTail >= 1 ? 60 : 20, longTail, 'count'),
    makeCheck('seoTagsDuplicates', 10, duplicates === 0 ? 100 : duplicates === 1 ? 50 : 0, duplicates, 'count'),
    makeCheck(
      'seoTagsBudget',
      15,
      chars <= 400 ? 100 : chars <= TAG_CHARACTER_LIMIT ? 70 : 0,
      chars,
      'chars',
    ),
  ];

  return { score: weightedScore(checks), checks };
}

function titleSection(title: string, keyword: string): SeoSection {
  const length = Array.from(title.trim()).length;
  const hasKeyword = keyword ? fold(title).includes(fold(keyword)) : false;
  const keywordWords = contentWords(keyword);
  const partial =
    keyword.length > 0 &&
    !hasKeyword &&
    keywordWords.some((word) => fold(title).includes(fold(word)));

  const checks: CheckResult[] = [
    makeCheck('seoTitleKeyword', 50, !keyword ? 0 : hasKeyword ? 100 : partial ? 50 : 0, 0, 'score'),
    makeCheck(
      'seoTitleLength',
      50,
      length >= 30 && length <= 60 ? 100 : length >= 20 && length <= 70 ? 70 : 40,
      length,
      'chars',
    ),
  ];

  return { score: weightedScore(checks), checks };
}

export function analyzeSeo(input: {
  title: string;
  description: string;
  tags: string[];
  keyword?: string | null;
}): SeoReport {
  const detected = detectKeyword(input.title, input.tags, input.keyword);
  const description = descriptionSection(input.description, detected.keyword);
  const tags = tagsSection(input.tags, detected.keyword);
  const title = titleSection(input.title, detected.keyword);

  const score = Math.round(
    description.score * 0.5 + tags.score * 0.3 + title.score * 0.2,
  );

  return {
    score,
    keyword: detected.keyword,
    keywordSource: detected.source,
    description,
    tags,
    title,
  };
}
