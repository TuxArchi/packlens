import { median } from './stats';

export function computeOutliers<T extends { views: number }>(
  videos: T[],
): { medianViews: number; videos: Array<T & { outlier: number }> } {
  const medianViews = median(videos.map((video) => video.views));
  const enriched = videos.map((video) => ({
    ...video,
    outlier: medianViews > 0 ? video.views / medianViews : 0,
  }));

  enriched.sort((a, b) => b.outlier - a.outlier);
  return { medianViews, videos: enriched };
}
