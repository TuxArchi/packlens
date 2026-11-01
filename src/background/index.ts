import { parseChannelPage } from '../core/channel-page';
import type { ChannelPage } from '../core/channel-page';
import { computeThumbMetrics } from '../core/image-metrics';
import type { ThumbMetrics } from '../core/image-metrics';
import { computeChannelAudit } from '../core/audit';
import type { ChannelAudit } from '../core/audit';
import { analyzeDescriptionInsights } from '../core/description-insights';
import type { DescriptionCompetitionInsights } from '../core/description-insights';
import { computeKeywordResult } from '../core/keywords';
import type { PerformanceStats } from '../core/performance';
import {
  activate as activateLicense,
  deactivate as deactivateLicense,
  getLicenseSnapshot,
  validateCurrent as validateCurrentLicense,
  validateIfDue as validateLicenseIfDue,
} from '../core/license';
import type {
  ChannelAuditResponse,
  ChannelOutliersResponse,
  DescriptionInsightsResponse,
  KeywordSearchResponse,
  LicenseResponse,
  OpenPanelResponse,
  PerformanceResponse,
  QuotaResponse,
  SimpleResponse,
  StudioWriteResponse,
  VideoDataResponse,
} from '../core/messages';
import { computeOutliers } from '../core/outliers';
import { normalizeRawVideo, toVideoData } from '../core/player';
import type { RawVideo } from '../core/player';
import { addSearch, addUnits, canSearch, getQuota } from '../core/quota';
import { parseRelativeAgeDays, parseSearchPage } from '../core/search-page';
import { getSettings } from '../core/settings';
import { loadThumbnail } from '../core/thumbnail';
import type {
  ChannelOutliers,
  KeywordSearchResult,
  KeywordVideo,
  VideoData,
} from '../core/types';
import { extractPublishedVideo } from '../core/watch-page';
import {
  fetchChannelStats,
  fetchChannelUploads,
  fetchVideoDescriptions,
  fetchVideoItems,
  searchVideoIds,
  YouTubeApiError,
} from '../core/youtube-api';
import type { ApiVideo } from '../core/youtube-api';

const WATCH_PREFIX = 'https://www.youtube.com/watch';
const STUDIO_PREFIX = 'https://studio.youtube.com/';
const PUBLISHED_TAGS_TTL = 10 * 60 * 1000;
const TAG_FETCH_TIMEOUT = 5000;
const CHANNEL_TTL = 15 * 60 * 1000;
const CHANNEL_TIMEOUT = 10_000;
const THUMB_METRICS_TTL = 10 * 60 * 1000;
const KEYWORD_CACHE_KEY = 'keyword-cache';
const KEYWORD_TTL = 24 * 60 * 60 * 1000;
const DESCRIPTION_INSIGHTS_KEY = 'description-insights-cache';
const DESCRIPTION_INSIGHTS_TTL = 24 * 60 * 60 * 1000;
const DESCRIPTION_INSIGHTS_MAX = 40;
const PERFORMANCE_TTL = 15 * 60 * 1000;
const CHANNEL_AUDIT_TTL = 24 * 60 * 60 * 1000;
const CHANNEL_AUDIT_MAX = 10;
const SESSION_TTL = 12 * 60 * 60 * 1000;
const SESSION_TIMEOUT = 10_000;
const SESSION_MIN_INTERVAL = 2000;
const KEYWORD_CACHE_MAX = 40;

let lastSessionSearchAt = 0;

const publishedTagsCache = new Map<string, { tags: string[]; fetchedAt: number }>();
const channelOutliersCache = new Map<string, { data: ChannelOutliers; fetchedAt: number }>();
const thumbnailMetricsCache = new Map<string, { metrics: ThumbMetrics; at: number }>();
const performanceCache = new Map<string, CachedPerformance>();
const channelAuditCache = new Map<string, CachedChannelAudit>();
const PANEL_WINDOW_KEY = 'panel-window-id';
let panelWindowId: number | null = null;

interface CachedKeyword {
  result: KeywordSearchResult;
  at: number;
}

interface CachedDescriptionInsights {
  data: DescriptionCompetitionInsights;
  at: number;
}

interface CachedPerformance {
  data: PerformanceStats;
  at: number;
}

interface CachedChannelAudit {
  data: ChannelAudit;
  at: number;
}

/**
 * Runs in the page's MAIN world so it can read `ytInitialPlayerResponse`.
 * It must stay self-contained: Firefox serialises this function and evaluates
 * it in the page, so it cannot close over anything from this module.
 */
function readPlayerResponseInPage(): RawVideo | null {
  const page = window as any;

  // `getPlayerResponse()` always reflects the video that is currently loaded,
  // including after SPA navigation. The global is only a bootstrap snapshot.
  let response = null;
  try {
    const player = document.getElementById('movie_player') as any;
    if (player && typeof player.getPlayerResponse === 'function') {
      response = player.getPlayerResponse();
    }
  } catch {
    response = null;
  }
  if (!response) response = page.ytInitialPlayerResponse;

  const details = response && response.videoDetails;
  if (!details) return null;

  const microformat = response.microformat && response.microformat.playerMicroformatRenderer;
  const thumbnails =
    details.thumbnail && Array.isArray(details.thumbnail.thumbnails)
      ? details.thumbnail.thumbnails
      : [];

  return {
    videoId: String(details.videoId ?? ''),
    title: String(details.title ?? ''),
    keywords: Array.isArray(details.keywords)
      ? details.keywords.map((keyword: unknown) => String(keyword))
      : [],
    viewCount: details.viewCount != null ? Number(details.viewCount) : null,
    lengthSeconds: details.lengthSeconds != null ? Number(details.lengthSeconds) : null,
    channel: String(details.author ?? ''),
    channelId: String(details.channelId ?? ''),
    description: String(details.shortDescription ?? ''),
    thumbnails: thumbnails
      .map((thumb: any) => String((thumb && thumb.url) ?? ''))
      .filter((url: string) => url.length > 0),
    publishedAt:
      microformat && microformat.publishDate
        ? String(microformat.publishDate)
        : microformat && microformat.uploadDate
          ? String(microformat.uploadDate)
          : null,
    category: microformat && microformat.category ? String(microformat.category) : null,
  };
}

async function readFromMainWorld(tabId: number): Promise<RawVideo | null> {
  try {
    const results = (await browser.scripting.executeScript({
      target: { tabId },
      func: readPlayerResponseInPage,
      world: 'MAIN',
    } as any)) as Array<{ result?: unknown }> | undefined;

    return normalizeRawVideo(results?.[0]?.result);
  } catch {
    return null;
  }
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function collectFromWatch(tabId: number, expectedId: string): Promise<VideoData | null> {
  let raw = await readFromMainWorld(tabId);

  // Right after a SPA navigation the player can still report the previous
  // video. Give it a moment and retry once before falling back.
  if (!raw || (raw.videoId && raw.videoId !== expectedId)) {
    await wait(350);
    raw = await readFromMainWorld(tabId);
  }

  if (raw && raw.videoId && raw.videoId !== expectedId) raw = null;

  if (!raw) {
    try {
      const fallback = await browser.tabs.sendMessage(tabId, { type: 'READ_PLAYER_RESPONSE' });
      const candidate = normalizeRawVideo(fallback);
      if (candidate && candidate.videoId === expectedId) raw = candidate;
    } catch {
      raw = null;
    }
  }

  if (!raw || !raw.title) return null;
  return toVideoData(raw, 'watch');
}

async function collectFromStudio(tabId: number): Promise<VideoData | null> {
  let data: VideoData | null = null;

  try {
    data = (await browser.tabs.sendMessage(tabId, {
      type: 'GET_STUDIO_DATA',
    })) as VideoData | null;
  } catch {
    return null;
  }

  if (!data) return null;

  let result = data;

  // Studio hides tags behind "Show more" and only renders them after it is
  // expanded. For published videos we can recover the saved tags straight from
  // the public watch page, with no API quota involved. Scheduled and private
  // videos have no public page, so skip the request entirely.
  const hasPublicPage = result.visibility !== 'scheduled' && result.visibility !== 'private';
  if (hasPublicPage && result.tags.length === 0 && result.videoId) {
    const tags = await fetchPublishedTags(result.videoId);
    if (tags.length > 0) result = { ...result, tags };
  }

  // The editor thumbnail is often the only one that exists for scheduled
  // videos. Analysing it here (event page + host permission) avoids the
  // cross-origin canvas problem and makes the score work before publishing.
  if (!result.thumbnailMetrics) {
    const urls = [result.thumbnailUrl, result.thumbnailFallbackUrl].filter(
      (url): url is string => typeof url === 'string' && url.length > 0,
    );

    for (const url of urls) {
      const cached = thumbnailMetricsCache.get(url);

      if (cached && Date.now() - cached.at < THUMB_METRICS_TTL) {
        result = { ...result, thumbnailMetrics: cached.metrics };
        break;
      }

      const pixels = await loadThumbnail(null, url);
      if (!pixels) continue;

      const metrics = computeThumbMetrics(pixels);
      thumbnailMetricsCache.set(url, { metrics, at: Date.now() });
      if (thumbnailMetricsCache.size > 50) {
        const oldest = thumbnailMetricsCache.keys().next().value;
        if (oldest) thumbnailMetricsCache.delete(oldest);
      }

      result = { ...result, thumbnailMetrics: metrics };
      break;
    }
  }

  return result;
}

async function fetchPublishedTags(videoId: string): Promise<string[]> {
  const cached = publishedTagsCache.get(videoId);
  if (cached && Date.now() - cached.fetchedAt < PUBLISHED_TAGS_TTL) {
    return cached.tags;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TAG_FETCH_TIMEOUT);

  try {
    const response = await fetch(
      `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`,
      {
        credentials: 'include',
        cache: 'no-store',
        signal: controller.signal,
      },
    );

    if (!response.ok) return [];

    const published = extractPublishedVideo(await response.text());
    const tags = published && published.videoId === videoId ? published.tags : [];

    publishedTagsCache.set(videoId, { tags, fetchedAt: Date.now() });
    if (publishedTagsCache.size > 50) {
      const oldest = publishedTagsCache.keys().next().value;
      if (oldest) publishedTagsCache.delete(oldest);
    }

    return tags;
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}

function isChannelUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.hostname !== 'www.youtube.com') return false;
    return /^\/(@[^/]+|channel\/UC[\w-]{22}|c\/[^/]+|user\/[^/]+)(\/|$)/.test(
      parsed.pathname,
    );
  } catch {
    return false;
  }
}

function normalizeChannelPath(path: string): string {
  const cleaned = path.replace(/\/+$/, '');
  const base = cleaned.replace(
    /\/(videos|shorts|streams|playlists|community|about|featured)$/i,
    '',
  );
  return base || '/';
}

async function fetchChannelPage(path: string): Promise<ChannelPage | null> {
  const base = normalizeChannelPath(path);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CHANNEL_TIMEOUT);

  try {
    const response = await fetch(
      `https://www.youtube.com${base}/videos?hl=en`,
      {
        credentials: 'include',
        cache: 'no-store',
        signal: controller.signal,
      },
    );

    if (!response.ok) return null;
    return parseChannelPage(await response.text());
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function getChannelOutliers(tabId?: number): Promise<ChannelOutliersResponse> {
  if (typeof tabId !== 'number') return { ok: false, error: 'no-tab' };

  let tab: browser.tabs.Tab;
  try {
    tab = await browser.tabs.get(tabId);
  } catch {
    return { ok: false, error: 'no-tab' };
  }

  const url = tab.url ?? '';
  if (!isChannelUrl(url)) return { ok: true, data: null };

  const path = new URL(url).pathname;
  const cacheKey = normalizeChannelPath(path);

  const cached = channelOutliersCache.get(cacheKey);
  if (cached && Date.now() - cached.fetchedAt < CHANNEL_TTL) {
    return { ok: true, data: { ...cached.data, cached: true } };
  }

  const page = await fetchChannelPage(path);
  if (!page) return { ok: false, error: 'channel' };

  const { medianViews, videos } = computeOutliers(page.videos);
  const data: ChannelOutliers = {
    channelId: page.channelId,
    channelName: page.channelName || cacheKey,
    medianViews,
    sampleSize: page.videos.length,
    videos,
    cached: false,
  };

  channelOutliersCache.set(cacheKey, { data, fetchedAt: Date.now() });
  if (channelOutliersCache.size > 30) {
    const oldest = channelOutliersCache.keys().next().value;
    if (oldest) channelOutliersCache.delete(oldest);
  }

  return { ok: true, data };
}

async function readKeywordCache(): Promise<Record<string, CachedKeyword>> {
  try {
    const stored = await browser.storage.local.get(KEYWORD_CACHE_KEY);
    const value = stored[KEYWORD_CACHE_KEY];
    return value && typeof value === 'object'
      ? (value as Record<string, CachedKeyword>)
      : {};
  } catch {
    return {};
  }
}

async function writeKeywordCache(cache: Record<string, CachedKeyword>): Promise<void> {
  const entries = Object.entries(cache)
    .filter(([, entry]) => Date.now() - entry.at < KEYWORD_TTL)
    .sort((a, b) => a[1].at - b[1].at)
    .slice(-KEYWORD_CACHE_MAX);

  try {
    await browser.storage.local.set({ [KEYWORD_CACHE_KEY]: Object.fromEntries(entries) });
  } catch {
    // A full local storage quota should not break the search.
  }
}

async function readDescriptionInsightsCache(): Promise<
  Record<string, CachedDescriptionInsights>
> {
  try {
    const stored = await browser.storage.local.get(DESCRIPTION_INSIGHTS_KEY);
    const value = stored[DESCRIPTION_INSIGHTS_KEY];
    return value && typeof value === 'object'
      ? (value as Record<string, CachedDescriptionInsights>)
      : {};
  } catch {
    return {};
  }
}

async function writeDescriptionInsightsCache(
  cache: Record<string, CachedDescriptionInsights>,
): Promise<void> {
  const entries = Object.entries(cache)
    .filter(([, entry]) => Date.now() - entry.at < DESCRIPTION_INSIGHTS_TTL)
    .sort((a, b) => a[1].at - b[1].at)
    .slice(-DESCRIPTION_INSIGHTS_MAX);

  try {
    await browser.storage.local.set({
      [DESCRIPTION_INSIGHTS_KEY]: Object.fromEntries(entries),
    });
  } catch {
    // A full local storage quota should not break the optimizer.
  }
}

async function getDescriptionInsights(
  rawVideoIds: string[],
  rawKeyword: string,
): Promise<DescriptionInsightsResponse> {
  const ids = [
    ...new Set(
      rawVideoIds
        .filter((id): id is string => typeof id === 'string')
        .map((id) => id.trim())
        .filter((id) => id.length > 0),
    ),
  ].slice(0, 10);
  if (ids.length === 0) {
    return { ok: false, error: 'no-videos', code: 'no-videos' };
  }

  const keyword = rawKeyword.trim().slice(0, 120);
  const cacheKey = `${keyword.toLocaleLowerCase()}|${ids.join(',')}`;
  const cache = await readDescriptionInsightsCache();
  const cached = cache[cacheKey];
  if (cached && Date.now() - cached.at < DESCRIPTION_INSIGHTS_TTL) {
    return { ok: true, data: { ...cached.data, cached: true } };
  }

  const settings = await getSettings();
  const apiKey = settings.apiKey.trim();
  if (!apiKey) return { ok: false, error: 'no-key', code: 'no-key' };

  const quota = await getQuota();
  if (quota.unitsLeft < 1) return { ok: false, error: 'quota', code: 'quota' };

  try {
    const videos = await fetchVideoDescriptions(ids, apiKey);
    await addUnits(1);

    const data = analyzeDescriptionInsights(keyword, videos);
    cache[cacheKey] = { data, at: Date.now() };
    await writeDescriptionInsightsCache(cache);

    return { ok: true, data: { ...data, cached: false } };
  } catch (error) {
    const code =
      error instanceof YouTubeApiError && error.reason === 'quotaExceeded'
        ? 'quota'
        : 'api';
    return { ok: false, error: String(error), code };
  }
}

async function getPerformance(input: {
  videoId: string;
  title?: string;
  publishedAt?: string | null;
  views?: number | null;
  channelId?: string | null;
}): Promise<PerformanceResponse> {
  const videoId = input.videoId.trim();
  if (!videoId) return { ok: false, error: 'no-video' };

  const cached = performanceCache.get(videoId);
  if (cached && Date.now() - cached.at < PERFORMANCE_TTL) {
    return { ok: true, data: { ...cached.data } };
  }

  const settings = await getSettings();
  const apiKey = settings.apiKey.trim();
  let video: ApiVideo | null = null;
  let partial = false;

  if (apiKey) {
    try {
      const fetched = await fetchVideoItems([videoId], apiKey);
      video = fetched[0] ?? null;
      if (video) await addUnits(1);
    } catch {
      partial = true;
    }
  } else {
    partial = true;
  }

  const channelId = video?.channelId || input.channelId || null;
  let channelName: string | null = null;
  let channelMedianViews: number | null = null;
  let channelMedianViewsPerDay: number | null = null;
  let channelSampleSize = 0;
  let baselineUnit: PerformanceStats['baselineUnit'] = 'none';

  if (channelId) {
    const page = await fetchChannelPage(`/channel/${channelId}`);
    if (page) {
      channelName = page.channelName || null;
      channelSampleSize = page.videos.length;
      channelMedianViews = median(
        page.videos.map((item) => item.views).filter((views) => views > 0),
      );

      const perDay = page.videos
        .filter(
          (item) =>
            typeof item.publishedDaysAgo === 'number' && item.publishedDaysAgo > 0,
        )
        .map((item) => item.views / Math.max(1, item.publishedDaysAgo as number));

      if (perDay.length >= 3) {
        channelMedianViewsPerDay = median(perDay);
        baselineUnit = 'per-day';
      } else if (channelMedianViews != null) {
        baselineUnit = 'total';
      }
    }
  }

  const data: PerformanceStats = {
    videoId,
    title: video?.title || input.title || '',
    publishedAt: video?.publishedAt || input.publishedAt || null,
    views: video?.views ?? input.views ?? null,
    likes: video?.likes ?? null,
    comments: video?.comments ?? null,
    channelId,
    channelName,
    channelMedianViews,
    channelMedianViewsPerDay,
    channelSampleSize,
    baselineUnit,
    partial: partial || !video,
    fetchedAt: new Date().toISOString(),
  };

  performanceCache.set(videoId, { data, at: Date.now() });
  if (performanceCache.size > 50) {
    const oldest = performanceCache.keys().next().value;
    if (oldest) performanceCache.delete(oldest);
  }

  return { ok: true, data };
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
}

async function getChannelAudit(rawChannelId: string): Promise<ChannelAuditResponse> {
  const channelId = rawChannelId.trim();
  if (!channelId) return { ok: false, error: 'no-channel', code: 'no-channel' };

  const cached = channelAuditCache.get(channelId);
  if (cached && Date.now() - cached.at < CHANNEL_AUDIT_TTL) {
    return { ok: true, data: { ...cached.data, cached: true } };
  }

  const settings = await getSettings();
  const apiKey = settings.apiKey.trim();
  if (!apiKey) return { ok: false, error: 'no-key', code: 'no-key' };

  const quota = await getQuota();
  if (quota.unitsLeft < 3) return { ok: false, error: 'quota', code: 'quota' };

  try {
    const uploads = await fetchChannelUploads(channelId, apiKey, 10);
    await addUnits(uploads.units);

    const videos = [];
    for (let index = 0; index < uploads.videoIds.length; index += 50) {
      const batch = uploads.videoIds.slice(index, index + 50);
      const items = await fetchVideoItems(batch, apiKey);
      await addUnits(1);
      videos.push(...items);
    }

    const data = computeChannelAudit({
      channelId,
      channelName: uploads.channelName,
      videos,
      truncated: uploads.truncated,
      unitsUsed:
        uploads.units + Math.ceil(uploads.videoIds.length / 50),
    });

    channelAuditCache.set(channelId, { data, at: Date.now() });
    if (channelAuditCache.size > CHANNEL_AUDIT_MAX) {
      const oldest = channelAuditCache.keys().next().value;
      if (oldest) channelAuditCache.delete(oldest);
    }

    return { ok: true, data };
  } catch (error) {
    const code =
      error instanceof YouTubeApiError && error.reason === 'quotaExceeded'
        ? 'quota'
        : 'api';
    return { ok: false, error: String(error), code };
  }
}

async function searchApiKeyword(rawKeyword: string): Promise<KeywordSearchResponse> {
  const keyword = typeof rawKeyword === 'string' ? rawKeyword.trim().slice(0, 120) : '';
  if (!keyword) return { ok: false, error: 'empty', code: 'bad-request' };

  const settings = await getSettings();
  const apiKey = settings.apiKey.trim();
  if (!apiKey) return { ok: false, error: 'no-key', code: 'no-key' };

  const locale = browser.i18n.getUILanguage() || 'en-US';
  const [language, region] = locale.split('-');
  const regionCode =
    region && /^[a-z]{2}$/i.test(region) ? region.toUpperCase() : undefined;
  const cacheKey = `${keyword.toLocaleLowerCase()}|${regionCode ?? ''}|${language ?? ''}`;

  const quota = await getQuota();
  const cache = await readKeywordCache();
  const hit = cache[cacheKey];
  if (
    hit &&
    hit.result &&
    Array.isArray(hit.result.top) &&
    Date.now() - hit.at < KEYWORD_TTL
  ) {
    return { ok: true, data: { ...hit.result, cached: true, quota } };
  }

  if (!canSearch(quota)) return { ok: false, error: 'quota', code: 'quota' };

  try {
    const ids = await searchVideoIds(
      keyword,
      { regionCode, relevanceLanguage: language },
      apiKey,
    );
    await addSearch();

    if (ids.length === 0) {
      const empty: KeywordSearchResult = {
        ...computeKeywordResult(keyword, []),
        cached: false,
        quota: await getQuota(),
      };
      cache[cacheKey] = { result: empty, at: Date.now() };
      await writeKeywordCache(cache);
      return { ok: true, data: empty };
    }

    const videos = await fetchVideoItems(ids, apiKey);
    await addUnits(1);

    const channelIds = [...new Set(videos.map((video) => video.channelId).filter(Boolean))];
    const channels = await fetchChannelStats(channelIds, apiKey);
    if (channelIds.length > 0) await addUnits(1);

    const merged: KeywordVideo[] = videos.map((video) => ({
      videoId: video.videoId,
      title: video.title,
      channelId: video.channelId,
      channelTitle: video.channelTitle,
      views: video.views,
      subs: channels.get(video.channelId) ?? 0,
      publishedAt: video.publishedAt,
      durationSeconds: video.durationSeconds,
    }));

    const result: KeywordSearchResult = {
      ...computeKeywordResult(keyword, merged),
      cached: false,
      quota: await getQuota(),
    };

    cache[cacheKey] = { result, at: Date.now() };
    await writeKeywordCache(cache);
    return { ok: true, data: result };
  } catch (error) {
    if (error instanceof YouTubeApiError) {
      if (error.status === 403 && /quota/i.test(error.reason)) {
        return { ok: false, error: error.reason, code: 'quota' };
      }
      if (error.status === 400 || error.status === 403) {
        return { ok: false, error: error.reason, code: 'invalid-key' };
      }
      return { ok: false, error: error.reason, code: 'api' };
    }
    return { ok: false, error: String(error), code: 'api' };
  }
}

async function searchSessionKeyword(rawKeyword: string): Promise<KeywordSearchResponse> {
  const keyword = typeof rawKeyword === 'string' ? rawKeyword.trim().slice(0, 120) : '';
  if (!keyword) return { ok: false, error: 'empty', code: 'bad-request' };

  const quota = await getQuota();
  const language = (browser.i18n.getUILanguage() || 'en').split('-')[0] || 'en';
  const cacheKey = `session|${keyword.toLocaleLowerCase()}|${language}`;
  const cache = await readKeywordCache();
  const hit = cache[cacheKey];

  if (
    hit &&
    hit.result &&
    Array.isArray(hit.result.top) &&
    Date.now() - hit.at < SESSION_TTL
  ) {
    return { ok: true, data: { ...hit.result, cached: true, quota } };
  }

  const since = Date.now() - lastSessionSearchAt;
  if (since < SESSION_MIN_INTERVAL) await wait(SESSION_MIN_INTERVAL - since);
  lastSessionSearchAt = Date.now();

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SESSION_TIMEOUT);

  try {
    const response = await fetch(
      `https://www.youtube.com/results?search_query=${encodeURIComponent(keyword)}&hl=en`,
      {
        credentials: 'include',
        cache: 'no-store',
        signal: controller.signal,
      },
    );

    if (!response.ok) {
      return { ok: false, error: `http-${response.status}`, code: 'session' };
    }

    const videos = parseSearchPage(await response.text());
    if (!videos || videos.length === 0) {
      return { ok: false, error: 'empty', code: 'session' };
    }

    const now = Date.now();
    const mapped: KeywordVideo[] = videos.map((video) => {
      const days = parseRelativeAgeDays(video.publishedText);
      return {
        videoId: video.videoId,
        title: video.title,
        channelId: '',
        channelTitle: video.channelTitle,
        views: video.views,
        subs: 0,
        publishedAt:
          typeof days === 'number'
            ? new Date(now - days * 86400000).toISOString()
            : '',
        publishedText: video.publishedText,
        publishedDaysAgo: days,
        durationSeconds: video.durationSeconds,
      };
    });

    const result: KeywordSearchResult = {
      ...computeKeywordResult(keyword, mapped, {
        mode: 'session',
        subsAvailable: false,
      }),
      cached: false,
      quota,
    };

    cache[cacheKey] = { result, at: Date.now() };
    await writeKeywordCache(cache);
    return { ok: true, data: result };
  } catch {
    return { ok: false, error: 'session', code: 'session' };
  } finally {
    clearTimeout(timer);
  }
}

async function getStudioTabId(): Promise<number | null> {
  try {
    const tabs = await browser.tabs.query({ active: true, currentWindow: true });
    const tab = tabs[0];
    if (tab?.id && (tab.url ?? '').startsWith(STUDIO_PREFIX)) return tab.id;
  } catch {
    // Ignore and report no tab below.
  }
  return null;
}

async function writeStudio(message: {
  type: string;
  [key: string]: unknown;
}): Promise<StudioWriteResponse> {
  const tabId = await getStudioTabId();
  if (typeof tabId !== 'number') return { ok: false, error: 'no-studio' };

  try {
    return (await browser.tabs.sendMessage(tabId, message)) as StudioWriteResponse;
  } catch (error) {
    return { ok: false, error: String(error) };
  }
}

async function expandStudioTags(tabId?: number): Promise<SimpleResponse> {
  let id = tabId;

  if (typeof id !== 'number') {
    id = (await getStudioTabId()) ?? undefined;
  }

  if (typeof id !== 'number') return { ok: false, error: 'no-tab' };

  try {
    await browser.tabs.sendMessage(id, { type: 'EXPAND_STUDIO_TAGS' });
    return { ok: true };
  } catch (error) {
    return { ok: false, error: String(error) };
  }
}

async function quotaResponse(): Promise<QuotaResponse> {
  try {
    return { ok: true, data: await getQuota() };
  } catch {
    return { ok: false };
  }
}

async function getVideoData(tabId?: number): Promise<VideoDataResponse> {
  if (typeof tabId !== 'number') return { ok: false, error: 'no-tab' };

  let tab: browser.tabs.Tab;
  try {
    tab = await browser.tabs.get(tabId);
  } catch {
    return { ok: false, error: 'no-tab' };
  }

  const url = tab.url ?? '';

  try {
    if (url.startsWith(WATCH_PREFIX)) {
      const videoId = new URL(url).searchParams.get('v');
      if (!videoId) return { ok: true, data: null };
      return { ok: true, data: await collectFromWatch(tabId, videoId) };
    }

    if (url.startsWith(STUDIO_PREFIX)) {
      return { ok: true, data: await collectFromStudio(tabId) };
    }
  } catch (error) {
    return { ok: false, error: String(error) };
  }

  return { ok: true, data: null };
}

async function getPanelWindowId(): Promise<number | null> {
  if (panelWindowId != null) {
    try {
      await browser.windows.get(panelWindowId);
      return panelWindowId;
    } catch {
      panelWindowId = null;
    }
  }

  try {
    const stored = await browser.storage.local.get(PANEL_WINDOW_KEY);
    const id = stored[PANEL_WINDOW_KEY];
    if (typeof id !== 'number') return null;

    const window = await browser.windows.get(id, { populate: true });
    const prefix = browser.runtime.getURL('sidebar/index.html');
    const isPanel = (window.tabs ?? []).some((tab) =>
      (tab.url ?? '').startsWith(prefix),
    );

    if (!isPanel) {
      await browser.storage.local.remove(PANEL_WINDOW_KEY);
      return null;
    }

    panelWindowId = id;
    return id;
  } catch {
    return null;
  }
}

async function storePanelWindow(id: number): Promise<void> {
  panelWindowId = id;
  try {
    await browser.storage.local.set({ [PANEL_WINDOW_KEY]: id });
  } catch {
    // The in-memory id still works for this session.
  }
}

async function clearPanelWindow(): Promise<void> {
  panelWindowId = null;
  try {
    await browser.storage.local.remove(PANEL_WINDOW_KEY);
  } catch {
    // Ignore.
  }
}

async function closeIntegratedSidebar(): Promise<void> {
  try {
    const action = browser.sidebarAction as unknown as {
      isOpen?: () => Promise<boolean>;
      close?: () => Promise<void>;
    };

    if (typeof action.isOpen === 'function' && (await action.isOpen())) {
      if (typeof action.close === 'function') await action.close();
    }
  } catch {
    // Ignore: the integrated sidebar may not support these methods.
  }
}

async function openPanel(
  tabId?: number,
  fromContentScript = false,
): Promise<OpenPanelResponse> {
  // A message from a content script does not preserve Firefox's user gesture,
  // so sidebarAction.open() throws there. Extension pages can still try it.
  if (!fromContentScript) {
    try {
      await browser.sidebarAction.open();
      return { ok: true, mode: 'sidebar' };
    } catch {
      // Fall back to a detached panel window.
    }
  }

  // Keep a single interface: if the old integrated sidebar is open, close it
  // before showing the panel window.
  await closeIntegratedSidebar();

  let targetTab = tabId;
  if (typeof targetTab !== 'number') {
    try {
      const tabs = await browser.tabs.query({ active: true, currentWindow: true });
      targetTab = tabs[0]?.id;
    } catch {
      targetTab = undefined;
    }
  }

  const query = typeof targetTab === 'number' ? `?tabId=${targetTab}` : '';
  const url = browser.runtime.getURL(`sidebar/index.html${query}`);

  try {
    const existing = await getPanelWindowId();
    if (existing != null) {
      await browser.windows.update(existing, { focused: true });
      return { ok: true, mode: 'window' };
    }

    const created = await browser.windows.create({
      url,
      type: 'popup',
      width: 380,
      height: 760,
    });

    if (created.id != null) await storePanelWindow(created.id);
    return { ok: true, mode: 'window' };
  } catch (error) {
    return { ok: false, error: String(error) };
  }
}

async function togglePanel(): Promise<void> {
  const existing = await getPanelWindowId();

  if (existing != null) {
    await clearPanelWindow();
    try {
      await browser.windows.remove(existing);
    } catch {
      // Already closed.
    }
    return;
  }

  await openPanel(undefined, true);
}

async function licenseResponse(): Promise<LicenseResponse> {
  try {
    return { ok: true, data: await getLicenseSnapshot() };
  } catch (error) {
    return { ok: false, error: String(error) };
  }
}

async function activateLicenseResponse(key: string): Promise<LicenseResponse> {
  const result = await activateLicense(key);
  if (!result.ok || !result.snapshot) {
    return { ok: false, error: result.error ?? 'activation-failed' };
  }
  return { ok: true, data: result.snapshot };
}

async function deactivateLicenseResponse(): Promise<LicenseResponse> {
  const result = await deactivateLicense();
  if (!result.ok || !result.snapshot) {
    return { ok: false, error: result.error ?? 'deactivation-failed' };
  }
  return { ok: true, data: result.snapshot };
}

async function validateLicenseResponse(): Promise<LicenseResponse> {
  const result = await validateCurrentLicense();
  if (!result.ok || !result.snapshot) {
    return { ok: false, error: result.error ?? 'validation-failed' };
  }
  return { ok: true, data: result.snapshot, offline: result.offline };
}

browser.runtime.onMessage.addListener(((message: unknown, sender: browser.runtime.MessageSender) => {
  if (!message || typeof message !== 'object') return undefined;

  const request = message as {
    type?: string;
    tabId?: number;
    keyword?: string;
    mode?: 'api' | 'session';
    tags?: unknown;
    title?: unknown;
    description?: unknown;
    videoId?: unknown;
    videoIds?: unknown;
    channelId?: unknown;
    publishedAt?: unknown;
    views?: unknown;
    key?: unknown;
  };
  switch (request.type) {
    case 'GET_VIDEO_DATA':
      return getVideoData(typeof request.tabId === 'number' ? request.tabId : sender.tab?.id);
    case 'GET_CHANNEL_OUTLIERS':
      return getChannelOutliers(
        typeof request.tabId === 'number' ? request.tabId : sender.tab?.id,
      );
    case 'GET_CHANNEL_AUDIT':
      return getChannelAudit(
        typeof request.channelId === 'string' ? request.channelId : '',
      );
    case 'SEARCH_KEYWORD': {
      const keyword = typeof request.keyword === 'string' ? request.keyword : '';
      return request.mode === 'session'
        ? searchSessionKeyword(keyword)
        : searchApiKeyword(keyword);
    }
    case 'EXPAND_STUDIO_TAGS':
      return expandStudioTags(sender.tab?.id);
    case 'ADD_STUDIO_TAGS': {
      const tags = Array.isArray(request.tags)
        ? request.tags.filter((tag): tag is string => typeof tag === 'string')
        : [];
      if (tags.length === 0) return { ok: false, error: 'empty' };

      return writeStudio({
        type: 'ADD_STUDIO_TAGS',
        tags,
        videoId: typeof request.videoId === 'string' ? request.videoId : null,
      });
    }
    case 'SET_STUDIO_TITLE': {
      const title = typeof request.title === 'string' ? request.title.trim().slice(0, 100) : '';
      if (!title) return { ok: false, error: 'empty' };

      return writeStudio({
        type: 'SET_STUDIO_TITLE',
        title,
        videoId: typeof request.videoId === 'string' ? request.videoId : null,
      });
    }
    case 'SET_STUDIO_DESCRIPTION': {
      const description =
        typeof request.description === 'string'
          ? request.description.slice(0, 5000)
          : '';
      if (!description.trim()) return { ok: false, error: 'empty' };

      return writeStudio({
        type: 'SET_STUDIO_DESCRIPTION',
        description,
        videoId: typeof request.videoId === 'string' ? request.videoId : null,
      });
    }
    case 'GET_DESCRIPTION_INSIGHTS': {
      const videoIds = Array.isArray(request.videoIds)
        ? request.videoIds.filter((id): id is string => typeof id === 'string')
        : [];
      const keyword = typeof request.keyword === 'string' ? request.keyword : '';
      return getDescriptionInsights(videoIds, keyword);
    }
    case 'GET_PERFORMANCE': {
      return getPerformance({
        videoId: typeof request.videoId === 'string' ? request.videoId : '',
        title: typeof request.title === 'string' ? request.title : undefined,
        publishedAt:
          typeof request.publishedAt === 'string' ? request.publishedAt : null,
        views: typeof request.views === 'number' ? request.views : null,
        channelId:
          typeof request.channelId === 'string' ? request.channelId : null,
      });
    }
    case 'GET_QUOTA':
      return quotaResponse();
    case 'GET_LICENSE':
      return licenseResponse();
    case 'ACTIVATE_LICENSE': {
      const key = typeof request.key === 'string' ? request.key : '';
      return activateLicenseResponse(key);
    }
    case 'DEACTIVATE_LICENSE':
      return deactivateLicenseResponse();
    case 'VALIDATE_LICENSE':
      return validateLicenseResponse();
    case 'OPEN_SIDEBAR':
      return openPanel(sender.tab?.id, Boolean(sender.tab));
    default:
      return undefined;
  }
}) as any);

browser.action.onClicked.addListener(() => {
  void togglePanel();
});

browser.commands.onCommand.addListener((command) => {
  if (command === 'toggle-panel') void togglePanel();
});

browser.windows.onRemoved.addListener((windowId) => {
  if (windowId === panelWindowId) void clearPanelWindow();
});

const LICENSE_ALARM = 'packlens-license';

void validateLicenseIfDue().catch(() => undefined);

try {
  browser.alarms.create(LICENSE_ALARM, { periodInMinutes: 24 * 60 });
  browser.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === LICENSE_ALARM) {
      void validateLicenseIfDue().catch(() => undefined);
    }
  });
} catch {
  // The alarms API is optional during development.
}

browser.runtime.onStartup.addListener(() => {
  void validateLicenseIfDue().catch(() => undefined);
});
