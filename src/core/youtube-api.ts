const API_BASE = 'https://www.googleapis.com/youtube/v3';

export class YouTubeApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly reason: string,
  ) {
    super(reason);
    this.name = 'YouTubeApiError';
  }
}

interface ApiErrorBody {
  error?: {
    errors?: Array<{ reason?: string }>;
    status?: string;
  };
}

export interface ApiVideo {
  videoId: string;
  title: string;
  channelId: string;
  channelTitle: string;
  views: number;
  likes: number | null;
  comments: number | null;
  publishedAt: string;
  durationSeconds: number;
}

export interface ApiVideoDescription {
  videoId: string;
  title: string;
  description: string;
  tags: string[];
}

export interface ChannelUploads {
  channelId: string;
  channelName: string;
  videoIds: string[];
  truncated: boolean;
  units: number;
}

async function getJson<T>(
  path: string,
  params: Record<string, string>,
  key: string,
): Promise<T> {
  const url = new URL(`${API_BASE}/${path}`);
  for (const [name, value] of Object.entries(params)) {
    if (value) url.searchParams.set(name, value);
  }
  url.searchParams.set('key', key);

  const response = await fetch(url.toString());
  if (!response.ok) {
    let reason = `http-${response.status}`;
    try {
      const body = (await response.json()) as ApiErrorBody;
      reason = body.error?.errors?.[0]?.reason ?? body.error?.status ?? reason;
    } catch {
      // Keep the HTTP status as the reason.
    }
    throw new YouTubeApiError(response.status, reason);
  }

  return (await response.json()) as T;
}

function numberOrNull(value: unknown): number | null {
  if (value == null || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function parseIsoDuration(value: string): number {
  const match = /^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(value);
  if (!match) return 0;

  const days = Number(match[1] ?? 0);
  const hours = Number(match[2] ?? 0);
  const minutes = Number(match[3] ?? 0);
  const seconds = Number(match[4] ?? 0);
  return days * 86_400 + hours * 3_600 + minutes * 60 + seconds;
}

export async function searchVideoIds(
  keyword: string,
  options: { regionCode?: string; relevanceLanguage?: string },
  key: string,
): Promise<string[]> {
  const params: Record<string, string> = {
    part: 'snippet',
    type: 'video',
    maxResults: '10',
    q: keyword,
  };
  if (options.regionCode) params.regionCode = options.regionCode;
  if (options.relevanceLanguage) params.relevanceLanguage = options.relevanceLanguage;

  const data = await getJson<{
    items?: Array<{ id?: { videoId?: string } }>;
  }>('search', params, key);

  const ids: string[] = [];
  const seen = new Set<string>();
  for (const item of data.items ?? []) {
    const id = item.id?.videoId;
    if (!id || seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
  }
  return ids.slice(0, 10);
}

export async function fetchVideoItems(ids: string[], key: string): Promise<ApiVideo[]> {
  if (ids.length === 0) return [];

  const data = await getJson<{
    items?: Array<{
      id?: string;
      snippet?: {
        title?: string;
        channelId?: string;
        channelTitle?: string;
        publishedAt?: string;
      };
      statistics?: {
        viewCount?: string;
        likeCount?: string;
        commentCount?: string;
      };
      contentDetails?: { duration?: string };
    }>;
  }>(
    'videos',
    {
      part: 'snippet,statistics,contentDetails',
      id: ids.join(','),
      maxResults: '50',
    },
    key,
  );

  const parsed: ApiVideo[] = [];
  for (const item of data.items ?? []) {
    const videoId = typeof item.id === 'string' ? item.id : '';
    if (!videoId) continue;

    parsed.push({
      videoId,
      title: item.snippet?.title ?? '',
      channelId: item.snippet?.channelId ?? '',
      channelTitle: item.snippet?.channelTitle ?? '',
      views: Number(item.statistics?.viewCount ?? 0) || 0,
      likes: numberOrNull(item.statistics?.likeCount),
      comments: numberOrNull(item.statistics?.commentCount),
      publishedAt: item.snippet?.publishedAt ?? '',
      durationSeconds: parseIsoDuration(item.contentDetails?.duration ?? ''),
    });
  }

  // videos.list does not guarantee the requested order; restore relevance order.
  const byId = new Map(parsed.map((video) => [video.videoId, video]));
  return ids
    .map((id) => byId.get(id))
    .filter((video): video is ApiVideo => Boolean(video));
}

export async function fetchVideoDescriptions(
  ids: string[],
  key: string,
): Promise<ApiVideoDescription[]> {
  if (ids.length === 0) return [];

  const data = await getJson<{
    items?: Array<{
      id?: string;
      snippet?: {
        title?: string;
        description?: string;
        tags?: string[];
      };
    }>;
  }>(
    'videos',
    {
      part: 'snippet',
      id: ids.join(','),
      maxResults: '50',
    },
    key,
  );

  const parsed: ApiVideoDescription[] = [];
  for (const item of data.items ?? []) {
    const videoId = typeof item.id === 'string' ? item.id : '';
    if (!videoId) continue;

    parsed.push({
      videoId,
      title: item.snippet?.title ?? '',
      description: item.snippet?.description ?? '',
      tags: Array.isArray(item.snippet?.tags)
        ? item.snippet.tags.filter((tag): tag is string => typeof tag === 'string')
        : [],
    });
  }

  const byId = new Map(parsed.map((video) => [video.videoId, video]));
  return ids
    .map((id) => byId.get(id))
    .filter((video): video is ApiVideoDescription => Boolean(video));
}

export async function fetchChannelUploads(
  channelId: string,
  key: string,
  maxPages = 10,
): Promise<ChannelUploads> {
  const channelData = await getJson<{
    items?: Array<{
      snippet?: { title?: string };
      contentDetails?: { relatedPlaylists?: { uploads?: string } };
    }>;
  }>(
    'channels',
    { part: 'snippet,contentDetails', id: channelId },
    key,
  );

  const item = channelData.items?.[0];
  const channelName = item?.snippet?.title ?? '';
  const uploads = item?.contentDetails?.relatedPlaylists?.uploads;
  if (!uploads) {
    return {
      channelId,
      channelName,
      videoIds: [],
      truncated: false,
      units: 1,
    };
  }

  const videoIds: string[] = [];
  let pageToken = '';
  let pages = 0;
  let truncated = false;

  do {
    const data = await getJson<{
      items?: Array<{ contentDetails?: { videoId?: string } }>;
      nextPageToken?: string;
    }>(
      'playlistItems',
      {
        part: 'contentDetails',
        playlistId: uploads,
        maxResults: '50',
        pageToken,
      },
      key,
    );

    pages += 1;
    for (const playlistItem of data.items ?? []) {
      const videoId = playlistItem.contentDetails?.videoId;
      if (videoId) videoIds.push(videoId);
    }

    pageToken = data.nextPageToken ?? '';
    if (pageToken && pages >= maxPages) {
      truncated = true;
      break;
    }
  } while (pageToken);

  return {
    channelId,
    channelName,
    videoIds: [...new Set(videoIds)],
    truncated,
    units: 1 + pages,
  };
}

export async function fetchChannelStats(ids: string[], key: string): Promise<Map<string, number>> {
  if (ids.length === 0) return new Map();

  const data = await getJson<{
    items?: Array<{
      id?: string;
      statistics?: { subscriberCount?: string; hiddenSubscriberCount?: boolean };
    }>;
  }>('channels', { part: 'statistics', id: ids.join(',') }, key);

  const stats = new Map<string, number>();
  for (const item of data.items ?? []) {
    const id = typeof item.id === 'string' ? item.id : '';
    if (!id) continue;
    const hidden = item.statistics?.hiddenSubscriberCount === true;
    stats.set(id, hidden ? 0 : Number(item.statistics?.subscriberCount ?? 0) || 0);
  }

  return stats;
}
