import { analyzeTitleInsights } from './insights';
import type { ContentLanguage, TitleInsights } from './insights';
import { fold } from './seo';
import { analyzeTitle } from './title-score';
import type { KeywordVideo } from './types';

export type TitleVariantReason =
  | 'keyword-start'
  | 'keyword'
  | 'length'
  | 'number'
  | 'year'
  | 'brackets'
  | 'pattern';

export interface TitleVariant {
  title: string;
  score: number;
  reasons: TitleVariantReason[];
}

export interface TitleVariantOptions {
  now?: Date;
  limit?: number;
}

interface ScoredCandidate {
  title: string;
  score: number;
  reasons: TitleVariantReason[];
  kind: string;
}

const KIND_ORDER = [
  'angle',
  'howto',
  'number',
  'year',
  'beginner',
  'scratch',
  'guide',
  'mistakes',
  'advanced',
  'curiosity',
  'pain',
  'versus',
];

const ES_NOUNS = new Set([
  'trucos', 'claves', 'consejos', 'errores', 'ajustes', 'pasos', 'secretos',
  'ideas', 'tips', 'tutoriales', 'guias', 'herramientas', 'ejemplos',
]);

const EN_NOUNS = new Set([
  'tips', 'tricks', 'mistakes', 'steps', 'secrets', 'ideas', 'tools', 'hacks',
  'strategies', 'examples', 'lessons',
]);

const EN_VERBS = new Set([
  'edit', 'learn', 'make', 'create', 'build', 'grow', 'start', 'use', 'get',
  'find', 'choose', 'write', 'design', 'code', 'play', 'cook', 'draw', 'paint',
  'sing', 'dance', 'study', 'improve', 'optimize', 'market', 'sell', 'invest',
  'travel', 'lose', 'gain', 'fix', 'install', 'setup', 'set', 'run', 'train',
  'teach', 'speak', 'read', 'watch', 'record', 'stream', 'publish', 'monetize',
  'rank', 'increase', 'reduce', 'save', 'earn', 'apply',
]);

const ES_NOUN_EXCEPTIONS = new Set([
  'lugar', 'mujer', 'mar', 'hogar', 'error', 'color', 'valor', 'amor', 'mayor',
  'mejor', 'peor', 'superior', 'inferior', 'interior', 'exterior', 'particular',
  'similar', 'popular', 'familiar', 'militar', 'polar', 'escolar', 'regular',
  'singular', 'plural', 'circular', 'solar', 'lunar', 'nuclear', 'lineal',
  'real', 'ideal', 'legal', 'local', 'global', 'total', 'final', 'normal',
  'formal', 'digital', 'social', 'especial', 'oficial', 'comercial',
  'artificial', 'financiero', 'extranjero', 'ligero', 'primero', 'tercero',
  'enero', 'febrero',
]);

export function generateTitleVariants(
  keyword: string,
  videos: KeywordVideo[],
  options: TitleVariantOptions = {},
): TitleVariant[] {
  const base = keyword.replace(/\s+/g, ' ').trim();
  if (!base) return [];

  const now = options.now ?? new Date();
  const limit = Math.max(1, options.limit ?? 10);
  const insights = analyzeTitleInsights(base, videos);
  const language = insights.language;
  const capitalized = capitalize(base);
  const lower = base.toLocaleLowerCase();
  const year = now.getFullYear();
  const number = insights.numbers[0] ?? '5';
  const noun = pickNoun(insights, language);
  const angle = pickAngle(insights, base, language);
  const secondaryAngle = pickSecondaryAngle(insights, base, angle);
  const yearAngle =
    /principiante|beginner|cero|scratch/i.test(angle) && secondaryAngle
      ? secondaryAngle
      : angle;
  const pain = pickPain(insights);
  const alternative = pickAlternative(base, videos);
  const verb =
    language === 'en' ? startsWithEnglishVerb(base) : startsWithSpanishVerb(base);

  const candidates: Array<{ title: string; kind: string }> = [];
  const push = (kind: string, title: string) => {
    if (title.trim()) candidates.push({ title, kind });
  };

  if (language === 'en') {
    if (!/complete guide/i.test(angle)) push('angle', joinWithAngle(capitalized, angle));
    push('howto', verb ? `How to ${lower} step by step` : `A step-by-step ${lower} guide`);
    if (!/20\d{2}/.test(yearAngle)) {
      push('year', joinWithAngle(`${capitalized} in ${year}`, yearAngle));
    }
    push('number', `${number} ${noun} for ${lower} that work`);
    if (/beginner/i.test(angle) && secondaryAngle) {
      push('beginner', joinWithAngle(`${capitalized} for beginners`, secondaryAngle));
    } else if (!/beginner/i.test(angle)) {
      push('beginner', joinWithAngle(`${capitalized} for beginners`, angle));
    }
    push('scratch', `${capitalized} from scratch`);
    if (pain) push('pain', `${capitalized} without ${pain}`);
    push('mistakes', `${number} ${lower} mistakes to avoid`);
    push('guide', `The complete ${lower} guide (${year})`);
    if (secondaryAngle && !/beginner/i.test(secondaryAngle)) {
      push('advanced', joinWithAngle(`${capitalized} advanced`, secondaryAngle));
    } else {
      push('advanced', `${capitalized}: advanced techniques`);
    }
    if (alternative) push('versus', `${capitalized} vs ${alternative}`);
    push('curiosity', `${capitalized}: what nobody tells you`);
  } else {
    if (!/guia completa/i.test(angle)) push('angle', joinWithAngle(capitalized, angle));
    push('howto', verb ? `Cómo ${lower} paso a paso` : `Guía de ${lower} paso a paso`);
    if (!/20\d{2}/.test(yearAngle)) {
      push('year', joinWithAngle(`${capitalized} en ${year}`, yearAngle));
    }
    push('number', `${number} ${noun} de ${lower} que funcionan`);
    if (/principiante/i.test(angle) && secondaryAngle) {
      push('beginner', joinWithAngle(`${capitalized} para principiantes`, secondaryAngle));
    } else if (!/principiante/i.test(angle)) {
      push('beginner', joinWithAngle(`${capitalized} para principiantes`, angle));
    }
    push('scratch', `${capitalized} desde cero`);
    if (pain) push('pain', `${capitalized} sin ${pain}`);
    push('mistakes', `${number} errores de ${lower} que debes evitar`);
    push('guide', `Guía completa de ${lower} (${year})`);
    if (secondaryAngle && !/principiante/i.test(secondaryAngle)) {
      push('advanced', joinWithAngle(`${capitalized} avanzado`, secondaryAngle));
    } else {
      push('advanced', `${capitalized}: técnicas avanzadas`);
    }
    if (alternative) push('versus', `${capitalized} vs ${alternative}`);
    push('curiosity', `${capitalized}: lo que nadie te cuenta`);
  }

  const seen = new Set<string>();
  const scored: ScoredCandidate[] = [];

  for (const candidate of candidates) {
    const title = normalizeTitle(candidate.title, year);
    if (!title) continue;

    const key = dedupeKey(title);
    if (seen.has(key)) continue;
    seen.add(key);

    const result = scoreVariant(title, base, insights);
    scored.push({ title, ...result, kind: candidate.kind });
  }

  const bestByKind = new Map<string, ScoredCandidate>();
  for (const candidate of scored) {
    const current = bestByKind.get(candidate.kind);
    if (!current || candidate.score > current.score) {
      bestByKind.set(candidate.kind, candidate);
    }
  }

  const selected: ScoredCandidate[] = [];
  const selectedKeys = new Set<string>();
  const add = (candidate: ScoredCandidate) => {
    if (selected.length >= limit) return;
    const key = dedupeKey(candidate.title);
    if (selectedKeys.has(key)) return;
    selectedKeys.add(key);
    selected.push(candidate);
  };

  const orderedKinds = [
    ...KIND_ORDER,
    ...bestByKind.keys(),
  ].filter((kind, index, all) => all.indexOf(kind) === index);

  for (const kind of orderedKinds) {
    const candidate = bestByKind.get(kind);
    if (candidate) add(candidate);
  }

  for (const candidate of [...scored].sort(
    (a, b) => b.score - a.score || a.title.length - b.title.length,
  )) {
    add(candidate);
  }

  return selected
    .sort((a, b) => b.score - a.score || a.title.length - b.title.length)
    .map(({ title, score, reasons }) => ({ title, score, reasons }));
}

function scoreVariant(
  title: string,
  keyword: string,
  insights: TitleInsights,
): { score: number; reasons: TitleVariantReason[] } {
  const titleFold = fold(title);
  const keywordFold = fold(keyword);
  const starts = titleFold.startsWith(keywordFold);
  const includes = titleFold.includes(keywordFold);

  const base = analyzeTitle(title).score;
  const keywordScore = starts ? 100 : includes ? 70 : 0;

  const sample = Math.max(1, insights.sampleSize);
  const hasNumber = /\d/.test(title.replace(/20\d{2}/g, ''));
  const hasYear = /20\d{2}/.test(title);
  const hasBrackets = /[[\](){}]/.test(title);
  const hasColon = /[:|]/.test(title);

  const patternChecks = [
    { ratio: insights.withNumber / sample, matches: hasNumber },
    { ratio: insights.withYear / sample, matches: hasYear },
    { ratio: insights.withBrackets / sample, matches: hasBrackets },
    { ratio: insights.withColon / sample, matches: hasColon },
  ].filter((check) => check.ratio >= 0.3);

  const patternScore =
    patternChecks.length > 0
      ? patternChecks.filter((check) => check.matches).length / patternChecks.length
      : 0.5;

  const reasons: TitleVariantReason[] = [];
  if (starts) reasons.push('keyword-start');
  else if (includes) reasons.push('keyword');
  if (patternScore >= 0.5) reasons.push('pattern');

  const length = Array.from(title).length;
  if (reasons.length < 3 && length >= 30 && length <= 60) reasons.push('length');
  if (reasons.length < 3 && hasNumber) reasons.push('number');
  if (reasons.length < 3 && hasYear) reasons.push('year');
  if (reasons.length < 3 && hasBrackets) reasons.push('brackets');

  const score = Math.round(
    base * 0.6 + keywordScore * 0.25 + patternScore * 100 * 0.15,
  );

  return {
    score: Math.max(0, Math.min(100, score)),
    reasons,
  };
}

function pickNoun(insights: TitleInsights, language: ContentLanguage): string {
  const nouns = language === 'en' ? EN_NOUNS : ES_NOUNS;
  const match = insights.nouns.find((noun) => nouns.has(fold(noun)));
  if (match) return match;
  return language === 'en' ? 'tips' : 'trucos';
}

function pickAngle(
  insights: TitleInsights,
  keyword: string,
  language: ContentLanguage,
): string {
  const keywordFold = fold(keyword);
  const candidates = insights.angles.filter((angle) => {
    const folded = fold(angle);
    if (!folded || folded === keywordFold) return false;
    if (/^(en|in)\s+20\d{2}$/i.test(angle)) return false;
    return true;
  });

  const preferred =
    candidates.find((angle) => /principiante|beginner/i.test(angle)) ??
    candidates.find((angle) => /paso a paso|step by step/i.test(angle)) ??
    candidates.find((angle) => /cero|scratch/i.test(angle)) ??
    candidates[0];

  return preferred ?? (language === 'en' ? 'complete guide' : 'guía completa');
}

function pickSecondaryAngle(
  insights: TitleInsights,
  keyword: string,
  primary: string,
): string | null {
  const keywordFold = fold(keyword);
  const primaryFold = fold(primary);
  const candidates = insights.angles.filter((angle) => {
    const folded = fold(angle);
    if (!folded || folded === keywordFold || folded === primaryFold) return false;
    if (/^(en|in)\s+20\d{2}$/i.test(angle)) return false;
    return true;
  });

  return (
    candidates.find((angle) => /sin|without|principiante|beginner/i.test(angle)) ??
    candidates[0] ??
    null
  );
}

function pickPain(insights: TitleInsights): string | null {
  const angle = insights.angles.find((item) => /^(sin|without)\s+/i.test(item));
  if (!angle) return null;
  return angle.replace(/^(sin|without)\s+/i, '').trim() || null;
}

function pickAlternative(keyword: string, videos: KeywordVideo[]): string | null {
  const keywordFold = fold(keyword);

  for (const video of videos) {
    const match = video.title.match(/\b(.{2,40}?)\s+(?:vs\.?|versus)\s+(.{2,40})/i);
    if (!match) continue;

    const left = cleanAlternative(match[1]);
    const right = cleanAlternative(match[2]);
    if (!left || !right) continue;

    const leftHas = fold(left).includes(keywordFold);
    const rightHas = fold(right).includes(keywordFold);

    if (leftHas && !rightHas) return right;
    if (rightHas && !leftHas) return left;
    if (!leftHas && !rightHas) return right;
  }

  return null;
}

function cleanAlternative(value: string): string {
  return value
    .replace(/\s+/g, ' ')
    .replace(/[.,;:!?¿¡|()[\]{}]+$/g, '')
    .trim()
    .split(/\s+/)
    .slice(0, 4)
    .join(' ');
}

function capitalize(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return '';
  return trimmed.charAt(0).toLocaleUpperCase() + trimmed.slice(1);
}

function dedupeKey(value: string): string {
  return fold(value)
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

function joinWithAngle(base: string, angle: string): string {
  return /^(para|sin|desde|for|without|from)\b/i.test(angle)
    ? `${base} ${angle}`
    : `${base}: ${angle}`;
}

function startsWithSpanishVerb(keyword: string): boolean {
  const words = fold(keyword).split(/\s+/).filter(Boolean);
  if (words.length < 2) return false;
  const first = words[0];
  if (!/(?:ar|er|ir)$/.test(first)) return false;
  return !ES_NOUN_EXCEPTIONS.has(first);
}

function startsWithEnglishVerb(keyword: string): boolean {
  const first = fold(keyword).split(/\s+/).filter(Boolean)[0] ?? '';
  return EN_VERBS.has(first);
}

function normalizeTitle(value: string, year: number): string {
  let title = value
    .replace(/\s+/g, ' ')
    .replace(/\s+([:;,.!?])/g, '$1')
    .trim();

  if (Array.from(title).length < 30 && !/20\d{2}/.test(title)) {
    title = `${title} (${year})`;
  }

  return Array.from(title).slice(0, 100).join('').trim();
}
