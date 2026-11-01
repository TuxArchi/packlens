import { extractJsonObject } from './json-extract';
import { parseViewCount } from './view-count';

export { parseViewCount } from './view-count';

export interface ChannelPageVideo {
  videoId: string;
  title: string;
  views: number;
}

export interface ChannelPage {
  channelId: string;
  channelName: string;
  videos: ChannelPageVideo[];
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

function legacyVideo(node: any): ChannelPageVideo | null {
  const videoId = typeof node?.videoId === 'string' ? node.videoId : '';
  const title = runsText(node?.title);
  const viewsText = runsText(node?.viewCountText);
  const views = parseViewCount(viewsText);
  if (!videoId || !title || views <= 0) return null;
  return { videoId, title, views };
}

/**
 * Parses the channel's /videos page. YouTube's 2026 UI uses `lockupViewModel`
 * items; older layouts still use `videoRenderer` or `gridVideoRenderer`.
 * The page is fetched with `hl=en` so compact view counts share one format.
 */
export function parseChannelPage(html: string): ChannelPage | null {
  if (!html || !html.includes('ytInitialData')) return null;

  const parsed = extractJsonObject(html, 'ytInitialData');
  if (!parsed || typeof parsed !== 'object') return null;

  const data = parsed as Record<string, any>;
  const meta = data.metadata?.channelMetadataRenderer;
  const channelId = typeof meta?.externalId === 'string' ? meta.externalId : '';
  const channelName = typeof meta?.title === 'string' ? meta.title : '';

  const videos = new Map<string, ChannelPageVideo>();

  const visit = (node: any, depth = 0): void => {
    if (!node || typeof node !== 'object' || depth > 30) return;

    if (Array.isArray(node)) {
      for (const item of node) visit(item, depth + 1);
      return;
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
      for (const part of parts) {
        const label = typeof part?.accessibilityLabel === 'string' ? part.accessibilityLabel : '';
        const text = typeof part?.text?.content === 'string' ? part.text.content : '';
        if (
          part?.leadingIcon?.name === 'PLAY_ARROW_OUTLINED' ||
          /views|visualizaciones|vistas/i.test(label)
        ) {
          viewsText = text || label;
          break;
        }
      }

      const views = parseViewCount(viewsText);
      if (videoId && typeof title === 'string' && title && views > 0) {
        videos.set(videoId, { videoId, title, views });
      }
    }

    const legacy = node.videoRenderer ?? node.gridVideoRenderer;
    if (legacy) {
      const video = legacyVideo(legacy);
      if (video) videos.set(video.videoId, video);
    }

    for (const key of Object.keys(node)) visit(node[key], depth + 1);
  };

  visit(data.contents);

  return {
    channelId,
    channelName,
    videos: [...videos.values()],
  };
}
