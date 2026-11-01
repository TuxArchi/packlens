import { extractJsonObject } from './json-extract';

export interface PublishedVideo {
  videoId: string;
  title: string;
  tags: string[];
  description?: string;
  views?: number | null;
  publishedAt?: string | null;
  lengthSeconds?: number | null;
  channel?: string;
  channelId?: string;
}

/**
 * Extracts the public metadata of a video from a watch page HTML document.
 * YouTube embeds `ytInitialPlayerResponse` in a script tag, so no browser DOM
 * is required and the same parser can run in the background.
 */
export function extractPublishedVideo(html: string): PublishedVideo | null {
  if (!html || !html.includes('ytInitialPlayerResponse')) return null;

  const parsed = extractJsonObject(html, 'ytInitialPlayerResponse');
  if (!parsed || typeof parsed !== 'object') return null;

  const details = (parsed as Record<string, any>).videoDetails;
  if (!details || typeof details !== 'object') return null;

  const videoId = typeof details.videoId === 'string' ? details.videoId : '';
  if (!videoId) return null;

  const tags = Array.isArray(details.keywords)
    ? details.keywords
        .filter((keyword: unknown): keyword is string => typeof keyword === 'string')
        .map((keyword: string) => keyword.trim())
        .filter(Boolean)
    : [];

  const result: PublishedVideo = {
    videoId,
    title: typeof details.title === 'string' ? details.title : '',
    tags,
  };

  if (typeof details.shortDescription === 'string') {
    result.description = details.shortDescription;
  }
  if (details.viewCount != null) {
    const views = Number(details.viewCount);
    if (Number.isFinite(views)) result.views = views;
  }
  if (details.lengthSeconds != null) {
    const length = Number(details.lengthSeconds);
    if (Number.isFinite(length)) result.lengthSeconds = length;
  }
  if (typeof details.author === 'string') result.channel = details.author;
  if (typeof details.channelId === 'string') result.channelId = details.channelId;

  const microformat = (parsed as Record<string, any>).microformat
    ?.playerMicroformatRenderer;
  const publishedAt = microformat?.publishDate ?? microformat?.uploadDate;
  if (typeof publishedAt === 'string') result.publishedAt = publishedAt;

  return result;
}
