import { detectKeyword, fold } from './seo';

export type BaselineUnit = 'per-day' | 'total' | 'none';
export type PerformanceVerdict = 'good' | 'fair' | 'poor' | 'pending';

export interface PerformanceStats {
  videoId: string;
  title: string;
  publishedAt: string | null;
  views: number | null;
  likes: number | null;
  comments: number | null;
  channelId: string | null;
  channelName: string | null;
  channelMedianViews: number | null;
  channelMedianViewsPerDay: number | null;
  channelSampleSize: number;
  baselineUnit: BaselineUnit;
  partial: boolean;
  fetchedAt: string;
}

export interface PerformanceSnapshot {
  videoId: string;
  title: string;
  description: string;
  tags: string[];
  views: number | null;
  likes: number | null;
  comments: number | null;
  publishedAt: string | null;
  capturedAt: string;
}

export interface ReviewItem {
  code: string;
  value?: number;
}

export interface PerformanceReview {
  ageHours: number;
  eligible: boolean;
  stats: PerformanceStats;
  snapshot: PerformanceSnapshot | null;
  engagementRate: number | null;
  viewsPerDay: number | null;
  ratio: number | null;
  verdict: PerformanceVerdict;
  strengths: ReviewItem[];
  improvements: ReviewItem[];
  changes: string[];
}

export interface PerformanceInput {
  videoId: string;
  title: string;
  description: string;
  tags: string[];
  publishedAt: string | null;
  views: number | null;
  keyword?: string | null;
  stats?: PerformanceStats | null;
  snapshot?: PerformanceSnapshot | null;
  now?: number;
}

export interface PerformanceStorage {
  get(key: string): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
}

const SNAPSHOT_PREFIX = 'performance-snapshot:';
const REVIEW_HOURS = 48;

export function analyzePerformance(input: PerformanceInput): PerformanceReview {
  const now = input.now ?? Date.now();
  const stats = input.stats ?? fallbackStats(input, now);
  const publishedAt = stats.publishedAt ?? input.publishedAt;
  const published = publishedAt ? Date.parse(publishedAt) : Number.NaN;
  const ageHours = Number.isFinite(published)
    ? Math.max(0, (now - published) / 3_600_000)
    : 0;
  const eligible = ageHours >= REVIEW_HOURS;
  const views = stats.views ?? input.views;
  const likes = stats.likes;
  const comments = stats.comments;
  const viewsPerDay =
    views != null && ageHours > 0 ? views / Math.max(ageHours / 24, 1) : null;
  const engagementRate =
    views != null && views > 0 && likes != null && comments != null
      ? (likes + comments) / views
      : null;

  let ratio: number | null = null;
  if (stats.baselineUnit === 'per-day' && stats.channelMedianViewsPerDay) {
    if (viewsPerDay != null) ratio = viewsPerDay / stats.channelMedianViewsPerDay;
  } else if (stats.baselineUnit === 'total' && stats.channelMedianViews) {
    if (views != null) ratio = views / stats.channelMedianViews;
  }

  const verdict: PerformanceVerdict = !eligible || views == null
    ? 'pending'
    : ratio == null
      ? 'fair'
      : ratio >= 1.5
        ? 'good'
        : ratio >= 0.7
          ? 'fair'
          : 'poor';

  const keyword = input.keyword?.trim() || detectKeyword(input.title, input.tags).keyword;
  const titleLength = Array.from(input.title.trim()).length;
  const descriptionWords = input.description.trim()
    ? input.description.trim().split(/\s+/).filter(Boolean).length
    : 0;
  const hasChapters =
    /(?:^|\s)\d{1,2}:\d{2}(?::\d{2})?(?=\s|$)/m.test(input.description) ||
    /https?:\/\//i.test(input.description);

  const strengths: ReviewItem[] = [];
  const improvements: ReviewItem[] = [];

  if (ratio != null && ratio >= 1.5) strengths.push({ code: 'above-median', value: ratio });
  if (engagementRate != null && engagementRate >= 0.05) {
    strengths.push({ code: 'engagement', value: engagementRate });
  }
  if (titleLength >= 30 && titleLength <= 60) {
    strengths.push({ code: 'title-length', value: titleLength });
  }
  if (keyword && fold(input.title).includes(fold(keyword))) {
    strengths.push({ code: 'keyword-title' });
  }
  if (input.tags.length >= 5) strengths.push({ code: 'tags', value: input.tags.length });
  if (descriptionWords >= 200) {
    strengths.push({ code: 'description', value: descriptionWords });
  }
  if (hasChapters) strengths.push({ code: 'chapters' });

  if (ratio != null && ratio < 0.7) improvements.push({ code: 'below-median', value: ratio });
  if (engagementRate != null && engagementRate < 0.03) {
    improvements.push({ code: 'engagement-low', value: engagementRate });
  }
  if (titleLength > 60) improvements.push({ code: 'title-long', value: titleLength });
  if (keyword && !fold(input.title).includes(fold(keyword))) {
    improvements.push({ code: 'keyword-missing' });
  }
  if (input.tags.length < 5) improvements.push({ code: 'tags-low', value: input.tags.length });
  if (descriptionWords < 200) {
    improvements.push({ code: 'description-short', value: descriptionWords });
  }
  if (!hasChapters) improvements.push({ code: 'no-chapters' });

  return {
    ageHours,
    eligible,
    stats,
    snapshot: input.snapshot ?? null,
    engagementRate,
    viewsPerDay,
    ratio,
    verdict,
    strengths,
    improvements,
    changes: snapshotChanges(input.snapshot ?? null, input, views),
  };
}

export function makePerformanceSnapshot(
  input: PerformanceInput,
  stats?: PerformanceStats | null,
): PerformanceSnapshot {
  const now = input.now ?? Date.now();
  return {
    videoId: input.videoId,
    title: input.title,
    description: input.description,
    tags: [...input.tags],
    views: stats?.views ?? input.views,
    likes: stats?.likes ?? null,
    comments: stats?.comments ?? null,
    publishedAt: stats?.publishedAt ?? input.publishedAt,
    capturedAt: new Date(now).toISOString(),
  };
}

export async function loadPerformanceSnapshot(
  videoId: string,
  storage: PerformanceStorage | null = defaultStorage(),
): Promise<PerformanceSnapshot | null> {
  if (!storage) return null;
  try {
    const key = `${SNAPSHOT_PREFIX}${videoId}`;
    const stored = await storage.get(key);
    return normalizeSnapshot(stored?.[key]);
  } catch {
    return null;
  }
}

export async function savePerformanceSnapshot(
  snapshot: PerformanceSnapshot,
  storage: PerformanceStorage | null = defaultStorage(),
): Promise<void> {
  if (!storage) return;
  try {
    await storage.set({
      [`${SNAPSHOT_PREFIX}${snapshot.videoId}`]: snapshot,
    });
  } catch {
    // A full storage quota should not break the review.
  }
}

function fallbackStats(input: PerformanceInput, now: number): PerformanceStats {
  return {
    videoId: input.videoId,
    title: input.title,
    publishedAt: input.publishedAt,
    views: input.views,
    likes: null,
    comments: null,
    channelId: null,
    channelName: null,
    channelMedianViews: null,
    channelMedianViewsPerDay: null,
    channelSampleSize: 0,
    baselineUnit: 'none',
    partial: true,
    fetchedAt: new Date(now).toISOString(),
  };
}

function snapshotChanges(
  snapshot: PerformanceSnapshot | null,
  input: PerformanceInput,
  views: number | null,
): string[] {
  if (!snapshot) return [];

  const changes: string[] = [];
  if (fold(snapshot.title) !== fold(input.title)) changes.push('title');
  if (fold(snapshot.tags.join('|')) !== fold(input.tags.join('|'))) changes.push('tags');
  if (fold(snapshot.description) !== fold(input.description)) changes.push('description');
  if (
    snapshot.views != null &&
    views != null &&
    views > snapshot.views
  ) {
    changes.push('views');
  }
  return changes;
}

function normalizeSnapshot(value: unknown): PerformanceSnapshot | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Record<string, unknown>;
  const videoId = typeof raw.videoId === 'string' ? raw.videoId : '';
  if (!videoId) return null;

  return {
    videoId,
    title: typeof raw.title === 'string' ? raw.title : '',
    description: typeof raw.description === 'string' ? raw.description : '',
    tags: Array.isArray(raw.tags)
      ? raw.tags.filter((tag): tag is string => typeof tag === 'string')
      : [],
    views: numberOrNull(raw.views),
    likes: numberOrNull(raw.likes),
    comments: numberOrNull(raw.comments),
    publishedAt: typeof raw.publishedAt === 'string' ? raw.publishedAt : null,
    capturedAt:
      typeof raw.capturedAt === 'string' ? raw.capturedAt : new Date(0).toISOString(),
  };
}

function numberOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function defaultStorage(): PerformanceStorage | null {
  try {
    const global = globalThis as {
      browser?: { storage?: { local?: PerformanceStorage } };
    };
    return (global.browser?.storage?.local as PerformanceStorage | undefined) ?? null;
  } catch {
    return null;
  }
}
