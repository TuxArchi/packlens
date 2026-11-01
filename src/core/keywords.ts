import { analyzeCompetition } from './recommendations';
import { clamp } from './score';
import { fold } from './seo';
import { median } from './stats';
import type {
  KeywordLabel,
  KeywordMode,
  KeywordSearchResult,
  KeywordVideo,
} from './types';

const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;

export function keywordLabel(difficulty: number): KeywordLabel {
  if (difficulty <= 30) return 'easy';
  if (difficulty <= 60) return 'medium';
  return 'hard';
}

export type KeywordMetrics = Omit<KeywordSearchResult, 'cached' | 'quota'>;

export function computeKeywordResult(
  keyword: string,
  videos: KeywordVideo[],
  options: { mode?: KeywordMode; subsAvailable?: boolean } = {},
): KeywordMetrics {
  const mode = options.mode ?? 'api';
  const subsAvailable = options.subsAvailable ?? true;

  const medianViews = median(videos.map((video) => video.views));
  const medianSubs = subsAvailable ? median(videos.map((video) => video.subs)) : 0;

  const now = Date.now();
  const recent = videos.filter((video) => {
    if (
      typeof video.publishedDaysAgo === 'number' &&
      Number.isFinite(video.publishedDaysAgo)
    ) {
      return video.publishedDaysAgo <= 30;
    }
    const time = Date.parse(video.publishedAt);
    return Number.isFinite(time) && time >= now - THIRTY_DAYS;
  }).length;
  const recentRatio = videos.length > 0 ? recent / videos.length : 0;

  const titleMatches = videos.filter((video) =>
    fold(video.title).includes(fold(keyword)),
  ).length;
  const titleMatchRatio = videos.length > 0 ? titleMatches / videos.length : 0;

  const subScore = subsAvailable
    ? clamp(((Math.log10(Math.max(medianSubs, 1)) - 3) / 3) * 100, 0, 100)
    : 0;
  const viewScore = clamp(((Math.log10(Math.max(medianViews, 1)) - 3) / 4) * 100, 0, 100);

  const difficulty = subsAvailable
    ? Math.round(
        clamp(subScore * 0.55 + viewScore * 0.3 + titleMatchRatio * 100 * 0.15, 0, 100),
      )
    : Math.round(
        clamp(viewScore * 0.7 + titleMatchRatio * 100 * 0.2 + recentRatio * 100 * 0.1, 0, 100),
      );

  const interestView = clamp(((Math.log10(Math.max(medianViews, 1)) - 2) / 5) * 100, 0, 100);
  const interest = Math.round(
    clamp(interestView * 0.85 + recentRatio * 100 * 0.15, 0, 100),
  );

  return {
    keyword,
    difficulty,
    label: keywordLabel(difficulty),
    interest,
    medianViews,
    medianSubs,
    recentRatio,
    titleMatchRatio,
    top: videos,
    mode,
    subsAvailable,
    recommendations: analyzeCompetition(keyword, videos),
  };
}
