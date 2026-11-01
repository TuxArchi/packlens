import { fold, STOPWORDS } from './seo';

export interface DescriptionSample {
  description: string;
}

export interface DescriptionCompetitionInsights {
  sampleSize: number;
  averageLength: number;
  medianLength: number;
  keywordCoverage: number;
  commonTerms: string[];
  commonHashtags: string[];
  cached?: boolean;
}

export const GENERIC_HASHTAGS = new Set([
  'video', 'videos', 'youtube', 'youtuber', 'viral', 'shorts', 'short',
  'subscribe', 'suscripcion', 'like', 'follow', 'fyp', 'parati', 'trending',
  'new', 'nuevo', 'music', 'musica', '2024', '2025', '2026', '2027',
]);

export function analyzeDescriptionInsights(
  keyword: string,
  samples: DescriptionSample[],
): DescriptionCompetitionInsights {
  const descriptions = samples
    .map((sample) => sample.description.trim())
    .filter((description) => description.length > 0);
  const sampleSize = descriptions.length;
  const lengths = descriptions.map((description) => Array.from(description).length);
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

  const keywordFold = fold(keyword).trim();
  const keywordCoverage = keywordFold
    ? descriptions.filter((description) => fold(description).includes(keywordFold)).length
    : 0;

  const termStats = new Map<string, { count: number; views: number }>();
  const hashtagStats = new Map<string, number>();

  for (const description of descriptions) {
    const stripped = description
      .replace(/https?:\/\/\S+/gi, ' ')
      .replace(/#[\p{L}\p{N}_]+/gu, ' ')
      .replace(/\b\d{1,2}:\d{2}(?::\d{2})?\b/g, ' ');

    const tokens = stripped
      .split(/[^\p{L}\p{N}]+/u)
      .map((token) => fold(token))
      .filter(
        (token) =>
          token.length > 2 &&
          !STOPWORDS.has(token) &&
          !/^\d+$/.test(token),
      );

    const candidates = new Set<string>();
    for (let index = 0; index < tokens.length; index += 1) {
      candidates.add(tokens[index]);
      if (index + 1 < tokens.length) {
        candidates.add(`${tokens[index]} ${tokens[index + 1]}`);
      }
    }

    for (const term of candidates) {
      const entry = termStats.get(term) ?? { count: 0, views: 0 };
      entry.count += 1;
      termStats.set(term, entry);
    }

    for (const tag of description.match(/#[\p{L}\p{N}_]+/gu) ?? []) {
      const normalized = tag.toLocaleLowerCase();
      hashtagStats.set(normalized, (hashtagStats.get(normalized) ?? 0) + 1);
    }
  }

  const sortedTerms = [...termStats.entries()]
    .sort((a, b) => b[1].count - a[1].count || a[0].localeCompare(b[0]));
  const repeatedTerms = sortedTerms.filter(([, stats]) => stats.count >= 2);
  const commonTerms = (repeatedTerms.length > 0 ? repeatedTerms : sortedTerms)
    .slice(0, 12)
    .map(([term]) => term);

  const commonHashtags = [...hashtagStats.entries()]
    .filter(([tag]) => {
      const key = fold(tag).replace(/^#/, '');
      return key.length >= 3 && !GENERIC_HASHTAGS.has(key);
    })
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 8)
    .map(([tag]) => tag);

  return {
    sampleSize,
    averageLength,
    medianLength,
    keywordCoverage,
    commonTerms,
    commonHashtags,
  };
}
