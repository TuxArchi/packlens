import { fold, STOPWORDS } from './seo';
import { tagCharacters } from './tags';
import type { KeywordRecommendations, KeywordVideo } from './types';

function tokenize(title: string): string[] {
  return title
    .split(/[^\p{L}\p{N}]+/u)
    .map((word) => fold(word))
    .filter((word) => word.length > 2 && !STOPWORDS.has(word));
}

/**
 * Turns the top results into actionable patterns: repeated phrases in titles,
 * title structure and a grounded set of suggested tags.
 */
export function analyzeCompetition(
  keyword: string,
  videos: KeywordVideo[],
): KeywordRecommendations {
  const phraseStats = new Map<string, { count: number; views: number }>();

  for (const video of videos) {
    const words = tokenize(video.title);
    const candidates = new Set<string>();

    for (let index = 0; index < words.length; index += 1) {
      candidates.add(words[index]);
      if (index + 1 < words.length) {
        candidates.add(`${words[index]} ${words[index + 1]}`);
      }
    }

    for (const phrase of candidates) {
      const entry = phraseStats.get(phrase) ?? { count: 0, views: 0 };
      entry.count += 1;
      entry.views += video.views;
      phraseStats.set(phrase, entry);
    }
  }

  const phrases = [...phraseStats.entries()]
    .filter(([, stats]) => stats.count >= 2)
    .sort((a, b) => b[1].count - a[1].count || b[1].views - a[1].views)
    .slice(0, 6)
    .map(([text, stats]) => ({ text, count: stats.count }));

  const foldedKeyword = fold(keyword).trim();
  const withNumber = videos.filter((video) => /\d/.test(video.title)).length;
  const keywordAtStart = foldedKeyword
    ? videos.filter((video) => fold(video.title).trim().startsWith(foldedKeyword)).length
    : 0;
  const withYear = videos.filter((video) => /20\d{2}/.test(video.title)).length;
  const averageLength =
    videos.length > 0
      ? Math.round(
          videos.reduce((sum, video) => sum + Array.from(video.title).length, 0) /
            videos.length,
        )
      : 0;

  const suggestedTags: string[] = [];
  const seen = new Set<string>();

  for (const candidate of [keyword, ...phrases.map((phrase) => phrase.text)]) {
    const tag = candidate.replace(/\s+/g, ' ').trim();
    if (!tag) continue;

    const key = fold(tag);
    if (seen.has(key)) continue;
    seen.add(key);

    if (tagCharacters([...suggestedTags, tag]) > 480) break;
    suggestedTags.push(tag);
    if (suggestedTags.length >= 15) break;
  }

  return {
    phrases,
    patterns: { withNumber, keywordAtStart, withYear, averageLength },
    suggestedTags,
  };
}
