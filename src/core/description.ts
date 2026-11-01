import { detectContentLanguage } from './insights';
import type { ContentLanguage } from './insights';
import {
  GENERIC_HASHTAGS,
  type DescriptionCompetitionInsights,
} from './description-insights';
import { analyzeSeo, detectKeyword, fold } from './seo';
import { normalizeTags } from './tags';
import type { CheckResult } from './types';

export interface DescriptionInput {
  title: string;
  description: string;
  tags: string[];
  keyword?: string | null;
}

export type DescriptionIssueCode =
  | 'length'
  | 'first-lines'
  | 'keyword'
  | 'links'
  | 'hashtags'
  | 'cta'
  | 'tags'
  | 'chapters';

export interface DescriptionIssue {
  code: DescriptionIssueCode;
  severity: 'warn' | 'bad';
  value?: number;
}

export interface DescriptionAnalysis {
  score: number;
  checks: CheckResult[];
  keyword: string;
  wordCount: number;
  charCount: number;
  hasKeywordFirstLines: boolean;
  keywordOccurrences: number;
  hashtags: string[];
  links: string[];
  timestamps: string[];
  hasCta: boolean;
  missingTags: string[];
  issues: DescriptionIssue[];
}

export type DescriptionChange =
  | 'keyword-first'
  | 'structure'
  | 'tags'
  | 'hashtags'
  | 'cta'
  | 'links'
  | 'chapters'
  | 'competition';

export interface DescriptionProposal {
  text: string;
  hashtags: string[];
  before: DescriptionAnalysis;
  after: DescriptionAnalysis;
  mode: 'basic' | 'advanced';
  changes: DescriptionChange[];
}

export interface DescriptionProposalOptions {
  mode?: 'basic' | 'advanced';
  competition?: DescriptionCompetitionInsights | null;
}

export interface DiffLine {
  type: 'added' | 'removed';
  text: string;
}

const ISSUE_BY_CHECK: Record<string, DescriptionIssueCode> = {
  seoDescriptionLength: 'length',
  seoDescriptionFirstLines: 'first-lines',
  seoDescriptionKeyword: 'keyword',
  seoDescriptionLinks: 'links',
  seoDescriptionHashtags: 'hashtags',
  seoDescriptionCta: 'cta',
};

const CTA_PATTERN =
  /(suscr[ií]bete|subscribe|s[ií]gueme|follow|comenta|comment|descarga|download|compra|buy|curso|course|discord|patreon|instagram|tiktok|newsletter)/i;

const PRESERVE_HEADING =
  /(cap[ií]tulos|chapters|timestamps|marcas de tiempo|recursos|resources|links|enlaces|fuentes|sources|cr[eé]ditos|credits|m[uú]sica|music|descargo|disclaimer|contacto|contact|negocios|business)/i;

export function analyzeDescription(input: DescriptionInput): DescriptionAnalysis {
  const keyword = resolveKeyword(input);
  const text = input.description.trim();
  const report = analyzeSeo({
    title: input.title,
    description: input.description,
    tags: input.tags,
    keyword,
  });
  const checks = report.description.checks;
  const wordCount = text ? text.split(/\s+/).filter(Boolean).length : 0;
  const charCount = Array.from(text).length;
  const firstLines = text.slice(0, 160);
  const firstLinesFold = fold(firstLines);
  const keywordFold = fold(keyword).trim();
  const hasKeywordFirstLines =
    keywordFold.length > 0 && firstLinesFold.includes(keywordFold);
  const keywordOccurrences = countOccurrences(text, keyword);
  const hashtags = extractHashtags(text);
  const links = text.match(/https?:\/\/\S+/gi) ?? [];
  const timestamps =
    text.match(/(?:^|\s)\d{1,2}:\d{2}(?::\d{2})?(?=\s|$)/g) ?? [];
  const hasCta = CTA_PATTERN.test(text.replace(/https?:\/\/\S+/gi, ' '));
  const tags = normalizeTags(input.tags);
  const missingTags = tags.filter((tag) => !fold(text).includes(fold(tag)));

  const issues: DescriptionIssue[] = [];
  for (const check of checks) {
    if (check.status === 'good') continue;
    const code = ISSUE_BY_CHECK[check.id];
    if (!code) continue;
    issues.push({
      code,
      severity: check.score < 50 ? 'bad' : 'warn',
      value: check.value,
    });
  }

  if (missingTags.length > 0) {
    issues.push({
      code: 'tags',
      severity: missingTags.length > 3 ? 'bad' : 'warn',
      value: missingTags.length,
    });
  }

  if (timestamps.length > 0 && timestamps.length < 3) {
    issues.push({ code: 'chapters', severity: 'warn', value: timestamps.length });
  }

  if (hashtags.length !== 3) {
    issues.push({
      code: 'hashtags',
      severity: hashtags.length === 0 ? 'bad' : 'warn',
      value: hashtags.length,
    });
  }

  return {
    score: report.description.score,
    checks,
    keyword,
    wordCount,
    charCount,
    hasKeywordFirstLines,
    keywordOccurrences,
    hashtags,
    links,
    timestamps,
    hasCta,
    missingTags,
    issues: dedupeIssues(issues),
  };
}

export function buildDescriptionProposal(
  input: DescriptionInput,
  options: DescriptionProposalOptions = {},
): DescriptionProposal {
  const keyword = resolveKeyword(input);
  const mode = options.mode ?? 'basic';
  const language = detectContentLanguage(
    [input.title, input.description, input.tags.join(' '), keyword].join(' '),
  );
  const keywordFold = fold(keyword);
  const tags = normalizeTags(input.tags)
    .filter((tag) => tag.trim().length > 1 && fold(tag) !== keywordFold)
    .slice(0, 12);
  const hashtags = deriveHashtags(
    keyword,
    tags,
    options.competition?.commonHashtags ?? [],
    3,
  );
  const preserved = extractPreservedBlocks(input.description);
  const firstLine = buildFirstLine(input.title, keyword, language);
  const summary = buildSummary(keyword, tags, language);
  const bullets = buildBullets(keyword, tags, language);
  const related = buildRelated(
    keyword,
    tags,
    options.competition?.commonTerms ?? [],
    language,
  );

  const bodyLines = [firstLine, '', summary];
  if (related) bodyLines.push('', related);
  bodyLines.push('', bullets.heading, ...bullets.items);
  bodyLines.push('', buildCta(language));
  if (preserved) bodyLines.push('', preserved);

  const hashtagLine = hashtags.join(' ');
  const reserve = hashtagLine ? Array.from(hashtagLine).length + 2 : 0;
  const body = trimToLimit(
    bodyLines.join('\n').replace(/\n{3,}/g, '\n\n').trim(),
    5000 - reserve,
  );
  const text = [body, hashtagLine].filter(Boolean).join('\n\n').trim();

  const before = analyzeDescription(input);
  const after = analyzeDescription({ ...input, keyword, description: text });

  return {
    text,
    hashtags,
    before,
    after,
    mode,
    changes: describeChanges(before, after, mode, preserved),
  };
}

export function deriveHashtags(
  keyword: string,
  tags: string[],
  competitorHashtags: string[] = [],
  limit = 3,
): string[] {
  const candidates: string[] = [];
  const push = (value: string) => {
    const tag = toHashtag(value);
    if (tag) candidates.push(tag);
  };

  push(keyword);
  for (const tag of competitorHashtags) push(tag);
  for (const tag of tags) push(tag);

  const byKey = new Map<string, string>();
  const order: string[] = [];
  const add = (tag: string) => {
    const key = compactHashtagKey(tag);
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, tag);
      order.push(key);
      return;
    }
    if (uppercaseCount(tag) > uppercaseCount(existing)) {
      byKey.set(key, tag);
    }
  };

  for (const tag of candidates) add(tag);

  if (order.length < limit) {
    const base = toHashtag(keyword)?.replace(/^#/, '') ?? '';
    if (base) {
      for (const suffix of ['Tips', 'Guia', '2026']) {
        const tag = toHashtag(`${base}${suffix}`);
        if (tag) add(tag);
        if (order.length >= limit) break;
      }
    }
  }

  return order
    .map((key) => byKey.get(key))
    .filter((tag): tag is string => Boolean(tag))
    .slice(0, limit);
}

export function diffLines(before: string, after: string): DiffLine[] {
  const beforeLines = before
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const afterLines = after
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const beforeSet = new Set(beforeLines.map((line) => fold(line)));
  const afterSet = new Set(afterLines.map((line) => fold(line)));
  const result: DiffLine[] = [];

  for (const line of beforeLines) {
    if (!afterSet.has(fold(line))) result.push({ type: 'removed', text: line });
  }
  for (const line of afterLines) {
    if (!beforeSet.has(fold(line))) result.push({ type: 'added', text: line });
  }

  return result;
}

export function extractPreservedBlocks(description: string): string {
  const lines = description.split(/\r?\n/);
  const preserved: string[] = [];
  const seen = new Set<string>();
  let preserveNext = 0;

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) {
      preserveNext = 0;
      continue;
    }

    if (/^#[\p{L}\p{N}_]+(?:\s+#[\p{L}\p{N}_]+)*$/u.test(line)) continue;

    const hasLink = /https?:\/\/\S+/i.test(line);
    const hasTimestamp = /(?:^|\s)\d{1,2}:\d{2}(?::\d{2})?(?=\s|$)/.test(line);
    const isHeading = PRESERVE_HEADING.test(line);

    if (!hasLink && !hasTimestamp && !isHeading && preserveNext <= 0) continue;

    const key = fold(line);
    if (!seen.has(key)) {
      seen.add(key);
      preserved.push(line);
    }

    if (isHeading) preserveNext = 6;
    else if (preserveNext > 0) preserveNext -= 1;
  }

  return preserved.join('\n').trim();
}

function resolveKeyword(input: DescriptionInput): string {
  const provided = input.keyword?.trim() ?? '';
  if (provided) return provided;
  return detectKeyword(input.title, input.tags).keyword.trim();
}

function countOccurrences(text: string, keyword: string): number {
  if (!keyword) return 0;
  const needle = escapeRegExp(fold(keyword));
  if (!needle) return 0;
  return (fold(text).match(new RegExp(needle, 'g')) ?? []).length;
}

function extractHashtags(text: string): string[] {
  return text.match(/#[\p{L}\p{N}_]+/gu) ?? [];
}

function toHashtag(value: string): string | null {
  const raw = value.replace(/^#+/, '').trim();
  if (!raw) return null;

  const spaced = raw.replace(/([a-z0-9])([A-Z])/g, '$1 $2');
  const words = spaced
    .split(/[^\p{L}\p{N}]+/u)
    .map((word) => word.trim())
    .filter(Boolean);

  if (words.length === 0) return null;

  const folded = words.map((word) => fold(word));
  const compactKey = folded.join('');
  if (compactKey.length < 3 || compactKey.length > 30) return null;
  if (GENERIC_HASHTAGS.has(compactKey)) return null;

  if (
    words.length === 1 &&
    words[0] === words[0].toLocaleUpperCase() &&
    words[0].length <= 5
  ) {
    return `#${words[0]}`;
  }

  const camel = folded
    .map((word) => word.charAt(0).toLocaleUpperCase() + word.slice(1))
    .join('');

  return camel ? `#${camel}` : null;
}

function compactHashtagKey(value: string): string {
  return fold(value).replace(/[^\p{L}\p{N}]/gu, '');
}

function uppercaseCount(value: string): number {
  return (value.match(/[A-Z]/g) ?? []).length;
}

function buildFirstLine(
  title: string,
  keyword: string,
  language: ContentLanguage,
): string {
  const cleanTitle = title.replace(/\s+/g, ' ').trim();
  const keywordFold = fold(keyword).trim();
  const titleFold = fold(cleanTitle);

  let line: string;
  if (!cleanTitle) {
    line = keyword || (language === 'en' ? 'Video' : 'Vídeo');
  } else if (keywordFold && titleFold.includes(keywordFold)) {
    line = cleanTitle;
  } else if (keyword) {
    line = `${capitalize(keyword)}: ${cleanTitle}`;
  } else {
    line = cleanTitle;
  }

  return Array.from(line).slice(0, 120).join('').trim();
}

function buildSummary(
  keyword: string,
  tags: string[],
  language: ContentLanguage,
): string {
  const tagList = tags.slice(0, 3).join(', ');
  if (language === 'en') {
    return tagList
      ? `In this video we cover ${keyword}: ${tagList}.`
      : `In this video we cover ${keyword}.`;
  }
  return tagList
    ? `En este vídeo hablamos de ${keyword}: ${tagList}.`
    : `En este vídeo hablamos de ${keyword}.`;
}

function buildBullets(
  keyword: string,
  tags: string[],
  language: ContentLanguage,
): { heading: string; items: string[] } {
  const items = (tags.length > 0 ? tags.slice(0, 3) : [keyword]).map(
    (item) => `- ${item}`,
  );
  return {
    heading: language === 'en' ? 'In this video:' : 'En este vídeo:',
    items,
  };
}

function buildRelated(
  keyword: string,
  tags: string[],
  terms: string[],
  language: ContentLanguage,
): string {
  const known = fold([keyword, ...tags].join(' '));
  const related = terms
    .filter((term) => term.length > 2 && !known.includes(fold(term)))
    .slice(0, 5);

  if (related.length < 2) return '';

  return language === 'en'
    ? `Related topics: ${related.join(', ')}.`
    : `Temas relacionados: ${related.join(', ')}.`;
}

function buildCta(language: ContentLanguage): string {
  return language === 'en'
    ? 'If this helped, subscribe and leave a comment.'
    : 'Si te ha servido, suscríbete y déjame un comentario.';
}

function describeChanges(
  before: DescriptionAnalysis,
  after: DescriptionAnalysis,
  mode: 'basic' | 'advanced',
  preserved: string,
): DescriptionChange[] {
  const changes: DescriptionChange[] = [];
  if (!before.hasKeywordFirstLines && after.hasKeywordFirstLines) {
    changes.push('keyword-first');
  }
  if (after.missingTags.length < before.missingTags.length) changes.push('tags');
  if (after.hashtags.length === 3 && before.hashtags.length !== 3) {
    changes.push('hashtags');
  }
  if (!before.hasCta && after.hasCta) changes.push('cta');
  if (preserved && /https?:\/\//i.test(preserved)) changes.push('links');
  if (preserved && /\d{1,2}:\d{2}/.test(preserved)) changes.push('chapters');
  if (preserved) changes.push('structure');
  if (mode === 'advanced') changes.push('competition');
  return [...new Set(changes)];
}

function dedupeIssues(issues: DescriptionIssue[]): DescriptionIssue[] {
  const rank = { warn: 1, bad: 2 } as const;
  const unique = new Map<DescriptionIssueCode, DescriptionIssue>();

  for (const issue of issues) {
    const current = unique.get(issue.code);
    if (!current || rank[issue.severity] > rank[current.severity]) {
      unique.set(issue.code, issue);
    }
  }

  return [...unique.values()];
}

function trimToLimit(text: string, limit: number): string {
  const characters = Array.from(text);
  if (characters.length <= limit) return text;
  let cut = characters.slice(0, Math.max(0, limit)).join('');
  const lastBreak = cut.lastIndexOf('\n');
  if (lastBreak > 0) cut = cut.slice(0, lastBreak);
  return cut.trim();
}

function capitalize(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return '';
  return trimmed.charAt(0).toLocaleUpperCase() + trimmed.slice(1);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
