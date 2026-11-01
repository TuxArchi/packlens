import { describe, expect, it } from 'vitest';
import { analyzeCompetition } from '../src/core/recommendations';
import type { KeywordVideo } from '../src/core/types';

function video(overrides: Partial<KeywordVideo> = {}): KeywordVideo {
  return {
    videoId: 'vid',
    title: 'Video',
    channelId: 'UC123',
    channelTitle: 'Canal',
    views: 1000,
    subs: 1000,
    publishedAt: new Date().toISOString(),
    durationSeconds: 300,
    ...overrides,
  };
}

describe('analyzeCompetition', () => {
  it('finds repeated phrases and title patterns', () => {
    const report = analyzeCompetition('editar videos', [
      video({ videoId: 'a', title: 'Cómo editar videos en 2026', views: 1000 }),
      video({ videoId: 'b', title: 'Editar videos rápido: 5 trucos', views: 2000 }),
      video({ videoId: 'c', title: 'Editar videos para YouTube', views: 3000 }),
    ]);

    expect(report.phrases).toContainEqual({ text: 'editar videos', count: 3 });
    expect(report.patterns.withNumber).toBe(2);
    expect(report.patterns.keywordAtStart).toBe(2);
    expect(report.patterns.withYear).toBe(1);
    expect(report.patterns.averageLength).toBeGreaterThan(0);
    expect(report.suggestedTags).toContain('editar videos');
  });

  it('handles an empty top list', () => {
    const report = analyzeCompetition('editar videos', []);
    expect(report.phrases).toEqual([]);
    expect(report.patterns).toEqual({
      withNumber: 0,
      keywordAtStart: 0,
      withYear: 0,
      averageLength: 0,
    });
    expect(report.suggestedTags).toEqual(['editar videos']);
  });
});
