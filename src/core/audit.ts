import { median } from './stats';

export interface AuditVideoInput {
  videoId: string;
  title: string;
  views: number;
  likes?: number | null;
  comments?: number | null;
  publishedAt: string;
  durationSeconds?: number;
}

export interface AuditVideo {
  videoId: string;
  title: string;
  views: number;
  likes: number | null;
  comments: number | null;
  publishedAt: string;
  durationSeconds: number;
  outlier: number;
  engagementRate: number | null;
}

export interface ChannelAudit {
  channelId: string;
  channelName: string;
  totalVideos: number;
  sampleSize: number;
  medianViews: number;
  averageViews: number;
  totalViews: number;
  topOutliers: AuditVideo[];
  bottomVideos: AuditVideo[];
  videos: AuditVideo[];
  truncated: boolean;
  cached: boolean;
  unitsUsed: number;
}

export interface ChannelAuditInput {
  channelId: string;
  channelName: string;
  videos: AuditVideoInput[];
  truncated?: boolean;
  cached?: boolean;
  unitsUsed?: number;
}

export function computeChannelAudit(input: ChannelAuditInput): ChannelAudit {
  const views = input.videos.map((video) => video.views).filter((value) => value > 0);
  const medianViews = median(views);
  const totalViews = views.reduce((sum, value) => sum + value, 0);
  const averageViews =
    views.length > 0 ? Math.round(totalViews / views.length) : 0;

  const videos: AuditVideo[] = input.videos.map((video) => {
    const likes = video.likes ?? null;
    const comments = video.comments ?? null;
    return {
      videoId: video.videoId,
      title: video.title,
      views: video.views,
      likes,
      comments,
      publishedAt: video.publishedAt,
      durationSeconds: video.durationSeconds ?? 0,
      outlier: medianViews > 0 ? video.views / medianViews : 0,
      engagementRate:
        video.views > 0 && likes != null && comments != null
          ? (likes + comments) / video.views
          : null,
    };
  });

  const sorted = [...videos].sort((a, b) => b.outlier - a.outlier);
  const bottom = [...videos]
    .filter((video) => video.views > 0)
    .sort((a, b) => a.outlier - b.outlier);

  return {
    channelId: input.channelId,
    channelName: input.channelName,
    totalVideos: videos.length,
    sampleSize: videos.length,
    medianViews,
    averageViews,
    totalViews,
    topOutliers: sorted.slice(0, 10),
    bottomVideos: bottom.slice(0, 10),
    videos: sorted,
    truncated: input.truncated === true,
    cached: input.cached === true,
    unitsUsed: input.unitsUsed ?? 0,
  };
}

export function auditCsvRows(audit: ChannelAudit): Array<Array<string | number | null>> {
  const rows: Array<Array<string | number | null>> = [
    [
      'channel',
      'videoId',
      'title',
      'views',
      'outlier',
      'likes',
      'comments',
      'engagementRate',
      'publishedAt',
      'durationSeconds',
    ],
  ];

  for (const video of audit.videos) {
    rows.push([
      audit.channelName,
      video.videoId,
      video.title,
      video.views,
      Number(video.outlier.toFixed(3)),
      video.likes,
      video.comments,
      video.engagementRate == null
        ? null
        : Number((video.engagementRate * 100).toFixed(3)),
      video.publishedAt,
      video.durationSeconds,
    ]);
  }

  return rows;
}
