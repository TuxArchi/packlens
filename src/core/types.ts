import type { ThumbMetrics } from './image-metrics';

export type DataSource = 'watch' | 'studio';

export interface VideoData {
  source: DataSource;
  videoId: string | null;
  title: string;
  thumbnailUrl: string | null;
  thumbnailFallbackUrl?: string | null;
  thumbnailMetrics?: ThumbMetrics | null;
  visibility?: 'public' | 'unlisted' | 'scheduled' | 'private' | 'unknown';
  channel: string | null;
  channelId?: string | null;
  views: number | null;
  publishedAt: string | null;
  lengthSeconds: number | null;
  tags: string[];
  description: string;
  category: string | null;
}

export interface QuotaState {
  date: string;
  searchesUsed: number;
  searchLimit: number;
  searchesLeft: number;
  unitsUsed: number;
  unitLimit: number;
  unitsLeft: number;
}

export interface KeywordVideo {
  videoId: string;
  title: string;
  channelId: string;
  channelTitle: string;
  views: number;
  subs: number;
  publishedAt: string;
  publishedText?: string;
  publishedDaysAgo?: number | null;
  durationSeconds: number;
}

export interface KeywordPhrase {
  text: string;
  count: number;
}

export interface KeywordPatterns {
  withNumber: number;
  keywordAtStart: number;
  withYear: number;
  averageLength: number;
}

export interface KeywordRecommendations {
  phrases: KeywordPhrase[];
  patterns: KeywordPatterns;
  suggestedTags: string[];
}

export type KeywordLabel = 'easy' | 'medium' | 'hard';
export type KeywordMode = 'api' | 'session';

export interface KeywordSearchResult {
  keyword: string;
  difficulty: number;
  label: KeywordLabel;
  interest: number;
  medianViews: number;
  medianSubs: number;
  recentRatio: number;
  titleMatchRatio: number;
  top: KeywordVideo[];
  cached: boolean;
  quota: QuotaState;
  mode: KeywordMode;
  subsAvailable: boolean;
  recommendations: KeywordRecommendations;
}

export interface OutlierVideo {
  videoId: string;
  title: string;
  views: number;
  outlier: number;
}

export interface ChannelOutliers {
  channelId: string;
  channelName: string;
  medianViews: number;
  sampleSize: number;
  videos: OutlierVideo[];
  cached: boolean;
}

export type CheckStatus = 'good' | 'warn' | 'bad';

export type CheckUnit = 'range' | 'ratio' | 'chars' | 'words' | 'count' | 'score';

export interface CheckResult {
  id: string;
  weight: number;
  /** Normalised 0..100 score for this single rule. */
  score: number;
  status: CheckStatus;
  /** Raw measurement used by the UI. */
  value: number;
  unit: CheckUnit;
}
