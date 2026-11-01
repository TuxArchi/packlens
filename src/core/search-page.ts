import { extractJsonObject } from './json-extract';
import { parseViewCount } from './view-count';

export interface SearchPageVideo {
  videoId: string;
  title: string;
  channelTitle: string;
  views: number;
  publishedText: string;
  durationSeconds: number;
}

function runsText(value: any): string {
  if (!value) return '';
  if (typeof value.simpleText === 'string') return value.simpleText;
  if (Array.isArray(value.runs)) {
    return value.runs
      .map((run: any) => (typeof run?.text === 'string' ? run.text : ''))
      .join('');
  }
  return '';
}

export function parseDurationText(text: string): number {
  const parts = text.trim().split(':').map((part) => Number(part));
  if (parts.length === 0 || parts.some((part) => !Number.isFinite(part))) return 0;
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return 0;
}

const UNIT_DAYS: Record<string, number> = {
  second: 0,
  s: 0,
  minute: 1 / 1440,
  m: 1 / 1440,
  hour: 1 / 24,
  h: 1 / 24,
  day: 1,
  d: 1,
  week: 7,
  w: 7,
  month: 30,
  mo: 30,
  year: 365,
  y: 365,
};

/**
 * YouTube shows relative dates ("yesterday", "2mo ago", "hace 3 semanas").
 * We only need an approximate age to compute how recent the top results are.
 */
export function parseRelativeAgeDays(text: string): number | null {
  const value = text.trim().toLocaleLowerCase();
  if (!value) return null;
  if (/just now|right now|ahora mismo/.test(value)) return 0;
  if (/yesterday|ayer/.test(value)) return 1;

  const english = value.match(
    /(\d+)\s*(second|minute|hour|day|week|month|year|mo|s|m|h|d|w|y)s?\s+ago/,
  );
  if (english) {
    return Number(english[1]) * (UNIT_DAYS[english[2]] ?? 0);
  }

  const spanish = value.match(
    /hace\s+(\d+)\s+(segundo|minuto|hora|día|dia|semana|mes|año|ano)s?/,
  );
  if (spanish) {
    const unit = spanish[2];
    if (unit.startsWith('segundo')) return 0;
    if (unit.startsWith('minuto')) return Number(spanish[1]) / 1440;
    if (unit.startsWith('hora')) return Number(spanish[1]) / 24;
    if (unit.startsWith('día') || unit.startsWith('dia')) return Number(spanish[1]);
    if (unit.startsWith('semana')) return Number(spanish[1]) * 7;
    if (unit.startsWith('mes')) return Number(spanish[1]) * 30;
    return Number(spanish[1]) * 365;
  }

  return null;
}

/**
 * Parses the public search results page. YouTube's 2026 search still uses
 * `videoRenderer`; `lockupViewModel` is handled as a fallback for newer UIs.
 */
export function parseSearchPage(html: string): SearchPageVideo[] | null {
  if (!html || !html.includes('ytInitialData')) return null;

  const parsed = extractJsonObject(html, 'ytInitialData');
  if (!parsed || typeof parsed !== 'object') return null;

  const data = parsed as Record<string, any>;
  const videos = new Map<string, SearchPageVideo>();

  const visit = (node: any, depth = 0): void => {
    if (!node || typeof node !== 'object' || depth > 30) return;

    if (Array.isArray(node)) {
      for (const item of node) visit(item, depth + 1);
      return;
    }

    if (node.videoRenderer) {
      const video = node.videoRenderer;
      const videoId = typeof video.videoId === 'string' ? video.videoId : '';
      const title = runsText(video.title);
      const views = parseViewCount(runsText(video.viewCountText));

      if (videoId && title && views > 0) {
        videos.set(videoId, {
          videoId,
          title,
          channelTitle: runsText(video.ownerText) || runsText(video.longBylineText),
          views,
          publishedText: runsText(video.publishedTimeText),
          durationSeconds: parseDurationText(runsText(video.lengthText)),
        });
      }
    }

    if (node.lockupViewModel) {
      const lockup = node.lockupViewModel;
      const videoId = typeof lockup.contentId === 'string' ? lockup.contentId : '';
      const title = lockup.metadata?.lockupMetadataViewModel?.title?.content;
      const rows =
        lockup.metadata?.lockupMetadataViewModel?.metadata?.contentMetadataViewModel
          ?.metadataRows;
      const parts =
        Array.isArray(rows) && rows[0] && Array.isArray(rows[0].metadataParts)
          ? rows[0].metadataParts
          : [];

      let viewsText = '';
      let channelTitle = '';
      let publishedText = '';

      for (const part of parts) {
        const text = typeof part?.text?.content === 'string' ? part.text.content : '';
        const label = typeof part?.accessibilityLabel === 'string' ? part.accessibilityLabel : '';
        if (part?.leadingIcon?.name === 'PLAY_ARROW_OUTLINED' || /views|visualizaciones/i.test(label)) {
          viewsText = text || label;
        } else if (/ago|hace|yesterday|ayer/i.test(text)) {
          publishedText = text;
        } else if (!channelTitle && text) {
          channelTitle = text;
        }
      }

      const views = parseViewCount(viewsText);
      if (videoId && typeof title === 'string' && title && views > 0) {
        videos.set(videoId, {
          videoId,
          title,
          channelTitle,
          views,
          publishedText,
          durationSeconds: 0,
        });
      }
    }

    for (const key of Object.keys(node)) visit(node[key], depth + 1);
  };

  visit(data.contents);

  const result = [...videos.values()].slice(0, 10);
  return result.length > 0 ? result : null;
}
