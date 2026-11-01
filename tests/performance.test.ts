import { describe, expect, it } from 'vitest';
import {
  analyzePerformance,
  loadPerformanceSnapshot,
  makePerformanceSnapshot,
  savePerformanceSnapshot,
} from '../src/core/performance';
import type {
  PerformanceInput,
  PerformanceSnapshot,
  PerformanceStats,
  PerformanceStorage,
} from '../src/core/performance';

const NOW = Date.parse('2026-11-01T12:00:00.000Z');

function hoursAgo(hours: number): string {
  return new Date(NOW - hours * 3_600_000).toISOString();
}

function stats(overrides: Partial<PerformanceStats> = {}): PerformanceStats {
  return {
    videoId: 'video-1',
    title: 'Cómo editar videos rápido',
    publishedAt: hoursAgo(72),
    views: 3000,
    likes: 200,
    comments: 50,
    channelId: 'UC123',
    channelName: 'Canal',
    channelMedianViews: 10_000,
    channelMedianViewsPerDay: 500,
    channelSampleSize: 20,
    baselineUnit: 'per-day',
    partial: false,
    fetchedAt: new Date(NOW).toISOString(),
    ...overrides,
  };
}

function input(overrides: Partial<PerformanceInput> = {}): PerformanceInput {
  return {
    videoId: 'video-1',
    title: 'Cómo editar videos rápido',
    description: 'Descripción con https://example.com y 00:00 Intro 01:20 Edición',
    tags: ['editar videos', 'youtube seo', 'premiere pro', 'tutorial', 'capcut'],
    publishedAt: hoursAgo(72),
    views: 3000,
    keyword: 'editar videos',
    stats: stats(),
    now: NOW,
    ...overrides,
  };
}

describe('analyzePerformance', () => {
  it('marks an above-average video as good', () => {
    const review = analyzePerformance(input());

    expect(review.eligible).toBe(true);
    expect(review.verdict).toBe('good');
    expect(review.viewsPerDay).toBeCloseTo(1000, 0);
    expect(review.ratio).toBeCloseTo(2, 1);
    expect(review.engagementRate).toBeCloseTo(250 / 3000, 3);
    expect(review.strengths.map((item) => item.code)).toContain('above-median');
    expect(review.strengths.map((item) => item.code)).toContain('engagement');
    expect(review.strengths.map((item) => item.code)).toContain('keyword-title');
  });

  it('marks a video below the channel pace as poor', () => {
    const review = analyzePerformance(
      input({
        title: 'Un título demasiado largo que no debería superar los sesenta caracteres ni de lejos',
        views: 300,
        tags: ['uno', 'dos'],
        description: 'Corto',
        stats: stats({
          views: 300,
          likes: 2,
          comments: 1,
        }),
      }),
    );

    expect(review.verdict).toBe('poor');
    const improvements = review.improvements.map((item) => item.code);
    expect(improvements).toContain('below-median');
    expect(improvements).toContain('engagement-low');
    expect(improvements).toContain('title-long');
    expect(improvements).toContain('tags-low');
    expect(improvements).toContain('description-short');
    expect(improvements).toContain('no-chapters');
  });

  it('waits until 48 hours have passed', () => {
    const review = analyzePerformance(
      input({
        publishedAt: hoursAgo(24),
        stats: stats({ publishedAt: hoursAgo(24) }),
      }),
    );

    expect(review.eligible).toBe(false);
    expect(review.verdict).toBe('pending');
  });

  it('uses total views when a per-day baseline is not available', () => {
    const review = analyzePerformance(
      input({
        views: 5000,
        stats: stats({
          views: 5000,
          baselineUnit: 'total',
          channelMedianViews: 10_000,
          channelMedianViewsPerDay: null,
        }),
      }),
    );

    expect(review.ratio).toBeCloseTo(0.5, 2);
    expect(review.verdict).toBe('poor');
  });

  it('detects metadata changes since the first snapshot', () => {
    const snapshot: PerformanceSnapshot = {
      videoId: 'video-1',
      title: 'Título anterior',
      description: 'Descripción anterior',
      tags: ['viejo'],
      views: 1000,
      likes: 10,
      comments: 2,
      publishedAt: hoursAgo(72),
      capturedAt: hoursAgo(48),
    };

    const review = analyzePerformance(
      input({
        snapshot,
        views: 3000,
        stats: stats({ views: 3000 }),
      }),
    );

    expect(review.changes).toContain('title');
    expect(review.changes).toContain('tags');
    expect(review.changes).toContain('description');
    expect(review.changes).toContain('views');
  });
});

describe('performance snapshots', () => {
  it('stores and loads a snapshot in local storage', async () => {
    const data: Record<string, unknown> = {};
    const storage: PerformanceStorage = {
      get: async (key) => ({ [key]: data[key] }),
      set: async (items) => {
        Object.assign(data, items);
      },
    };

    const snapshot = makePerformanceSnapshot(input(), stats());
    await savePerformanceSnapshot(snapshot, storage);
    const loaded = await loadPerformanceSnapshot('video-1', storage);

    expect(loaded).toEqual(snapshot);
    expect(loaded?.title).toBe('Cómo editar videos rápido');
    expect(loaded?.views).toBe(3000);
  });

  it('returns null for a missing snapshot', async () => {
    const storage: PerformanceStorage = {
      get: async () => ({}),
      set: async () => undefined,
    };
    expect(await loadPerformanceSnapshot('missing', storage)).toBeNull();
  });
});
