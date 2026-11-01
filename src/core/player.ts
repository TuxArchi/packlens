import { extractJsonObject } from './json-extract';
import type { DataSource, VideoData } from './types';

export interface RawVideo {
  videoId: string;
  title: string;
  keywords: string[];
  viewCount: number | null;
  lengthSeconds: number | null;
  channel: string;
  channelId: string;
  description: string;
  thumbnails: string[];
  publishedAt: string | null;
  category: string | null;
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function asNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

export function normalizeRawVideo(input: unknown): RawVideo | null {
  if (!input || typeof input !== 'object') return null;
  const raw = input as Record<string, unknown>;
  const videoId = asString(raw.videoId);
  if (!videoId) return null;

  const keywords = Array.isArray(raw.keywords)
    ? raw.keywords
        .filter((keyword): keyword is string => typeof keyword === 'string')
        .map((keyword) => keyword.trim())
        .filter(Boolean)
    : [];

  const thumbnails = Array.isArray(raw.thumbnails)
    ? raw.thumbnails
        .filter((url): url is string => typeof url === 'string')
        .map((url) => url.trim())
        .filter(Boolean)
    : [];

  return {
    videoId,
    title: asString(raw.title),
    keywords,
    viewCount: asNumber(raw.viewCount),
    lengthSeconds: asNumber(raw.lengthSeconds),
    channel: asString(raw.channel),
    channelId: asString(raw.channelId),
    description: asString(raw.description),
    thumbnails,
    publishedAt: typeof raw.publishedAt === 'string' ? raw.publishedAt : null,
    category: typeof raw.category === 'string' ? raw.category : null,
  };
}

export function toVideoData(raw: RawVideo, source: DataSource): VideoData {
  const byId = raw.videoId
    ? `https://i.ytimg.com/vi/${raw.videoId}/maxresdefault.jpg`
    : null;
  const lastThumbnail = raw.thumbnails.length > 0 ? raw.thumbnails[raw.thumbnails.length - 1] : null;

  return {
    source,
    videoId: raw.videoId || null,
    title: raw.title,
    thumbnailUrl: byId ?? lastThumbnail,
    channel: raw.channel || null,
    channelId: raw.channelId || null,
    views: raw.viewCount,
    publishedAt: raw.publishedAt,
    lengthSeconds: raw.lengthSeconds,
    tags: raw.keywords,
    description: raw.description,
    category: raw.category,
  };
}

/**
 * Fallback used by the content script: reads the bootstrap state straight from
 * the DOM. It works on first load, but on SPA navigation YouTube keeps the
 * original script tag, so callers must validate the returned videoId.
 */
export function readPlayerResponseFromScripts(): RawVideo | null {
  const scripts = document.querySelectorAll('script');
  for (let i = 0; i < scripts.length; i += 1) {
    const text = scripts[i].textContent ?? '';
    if (!text.includes('ytInitialPlayerResponse')) continue;

    const parsed = extractJsonObject(text, 'ytInitialPlayerResponse');
    if (!parsed || typeof parsed !== 'object') continue;

    const response = parsed as Record<string, any>;
    const details = response.videoDetails;
    if (!details) continue;

    const microformat = response.microformat?.playerMicroformatRenderer;
    const thumbnails: string[] = Array.isArray(details.thumbnail?.thumbnails)
      ? details.thumbnail.thumbnails
          .map((thumb: any) => (typeof thumb?.url === 'string' ? thumb.url : ''))
          .filter((url: string) => url.length > 0)
      : [];

    const raw = normalizeRawVideo({
      videoId: details.videoId,
      title: details.title,
      keywords: details.keywords,
      viewCount: details.viewCount,
      lengthSeconds: details.lengthSeconds,
      channel: details.author,
      channelId: details.channelId,
      description: details.shortDescription,
      thumbnails,
      publishedAt: microformat?.publishDate ?? microformat?.uploadDate ?? null,
      category: microformat?.category ?? null,
    });

    if (raw) return raw;
  }

  return null;
}
