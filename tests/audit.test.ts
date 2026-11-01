import { describe, expect, it } from 'vitest';
import { auditCsvRows, computeChannelAudit } from '../src/core/audit';

const audit = computeChannelAudit({
  channelId: 'UC123',
  channelName: 'Canal de prueba',
  videos: [
    {
      videoId: 'a',
      title: 'Video A',
      views: 1000,
      likes: 100,
      comments: 20,
      publishedAt: '2026-01-01',
      durationSeconds: 600,
    },
    {
      videoId: 'b',
      title: 'Video B',
      views: 2000,
      likes: 100,
      comments: 50,
      publishedAt: '2026-02-01',
      durationSeconds: 700,
    },
    {
      videoId: 'c',
      title: 'Video C',
      views: 3000,
      likes: 300,
      comments: 100,
      publishedAt: '2026-03-01',
      durationSeconds: 800,
    },
  ],
  unitsUsed: 21,
});

describe('computeChannelAudit', () => {
  it('computes medians, totals and outlier ratios', () => {
    expect(audit.totalVideos).toBe(3);
    expect(audit.medianViews).toBe(2000);
    expect(audit.averageViews).toBe(2000);
    expect(audit.totalViews).toBe(6000);
    expect(audit.unitsUsed).toBe(21);
    expect(audit.videos[0].videoId).toBe('c');
    expect(audit.videos[0].outlier).toBe(1.5);
    expect(audit.videos[2].outlier).toBe(0.5);
    expect(audit.topOutliers).toHaveLength(3);
    expect(audit.bottomVideos[0].videoId).toBe('a');
  });

  it('computes engagement rate', () => {
    const video = audit.videos.find((item) => item.videoId === 'a');
    expect(video?.engagementRate).toBeCloseTo(0.12, 3);
  });

  it('handles a channel with no views', () => {
    const empty = computeChannelAudit({
      channelId: 'UC0',
      channelName: 'Empty',
      videos: [],
    });
    expect(empty.medianViews).toBe(0);
    expect(empty.averageViews).toBe(0);
    expect(empty.totalViews).toBe(0);
    expect(empty.videos).toEqual([]);
  });

  it('exports a CSV with one row per video', () => {
    const rows = auditCsvRows(audit);
    expect(rows[0]).toContain('channel');
    expect(rows[0]).toContain('outlier');
    expect(rows).toHaveLength(4);
    expect(rows[1][0]).toBe('Canal de prueba');
    expect(rows[1][2]).toBe('Video C');
  });
});
