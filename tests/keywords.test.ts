import { describe, expect, it } from 'vitest';
import { computeKeywordResult, keywordLabel } from '../src/core/keywords';
import type { KeywordVideo } from '../src/core/types';

function video(overrides: Partial<KeywordVideo> = {}): KeywordVideo {
  return {
    videoId: 'vid',
    title: 'Video sobre editar videos',
    channelId: 'UC123',
    channelTitle: 'Canal',
    views: 10_000,
    subs: 10_000,
    publishedAt: new Date().toISOString(),
    durationSeconds: 300,
    ...overrides,
  };
}

describe('keywordLabel', () => {
  it('maps difficulty to a label', () => {
    expect(keywordLabel(10)).toBe('easy');
    expect(keywordLabel(45)).toBe('medium');
    expect(keywordLabel(80)).toBe('hard');
  });
});

describe('computeKeywordResult', () => {
  it('computes medians, ratios and a difficulty score', () => {
    const videos = [
      video({ videoId: 'a', views: 1000, subs: 1000 }),
      video({ videoId: 'b', views: 3000, subs: 3000 }),
      video({ videoId: 'c', views: 2000, subs: 2000 }),
    ];

    const result = computeKeywordResult('editar videos', videos);

    expect(result.medianViews).toBe(2000);
    expect(result.medianSubs).toBe(2000);
    expect(result.titleMatchRatio).toBe(1);
    expect(result.recentRatio).toBe(1);
    expect(result.difficulty).toBeGreaterThan(0);
    expect(result.top.map((item) => item.videoId)).toEqual(['a', 'b', 'c']);
  });

  it('scores big channels and big videos as hard', () => {
    const videos = Array.from({ length: 5 }, (_, index) =>
      video({
        videoId: `v${index}`,
        views: 10_000_000,
        subs: 1_000_000,
      }),
    );

    const result = computeKeywordResult('editar videos', videos);
    expect(result.label).toBe('hard');
    expect(result.difficulty).toBeGreaterThan(60);
  });

  it('handles an empty result set', () => {
    const result = computeKeywordResult('nada', []);
    expect(result.medianViews).toBe(0);
    expect(result.difficulty).toBe(0);
    expect(result.interest).toBe(0);
    expect(result.top).toEqual([]);
    expect(result.mode).toBe('api');
    expect(result.subsAvailable).toBe(true);
  });

  it('uses a view-based difficulty when subscriber data is unavailable', () => {
    const videos = Array.from({ length: 5 }, (_, index) =>
      video({
        videoId: `s${index}`,
        views: 1_000_000,
        subs: 0,
      }),
    );

    const result = computeKeywordResult('editar videos', videos, {
      mode: 'session',
      subsAvailable: false,
    });

    expect(result.mode).toBe('session');
    expect(result.subsAvailable).toBe(false);
    expect(result.medianSubs).toBe(0);
    expect(result.difficulty).toBeGreaterThan(60);
    expect(result.recommendations.suggestedTags.length).toBeGreaterThan(0);
  });
});
