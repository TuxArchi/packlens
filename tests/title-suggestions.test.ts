import { describe, expect, it } from 'vitest';
import { suggestTitles } from '../src/core/title-suggestions';
import type { KeywordRecommendations, KeywordVideo } from '../src/core/types';

const recommendations: KeywordRecommendations = {
  phrases: [
    { text: 'editar videos', count: 3 },
    { text: 'tutorial edicion', count: 2 },
    { text: 'para youtube', count: 2 },
  ],
  patterns: {
    withNumber: 2,
    keywordAtStart: 2,
    withYear: 1,
    averageLength: 40,
  },
  suggestedTags: ['editar videos'],
};

function video(overrides: Partial<KeywordVideo> = {}): KeywordVideo {
  return {
    videoId: 'vid',
    title: '5 trucos para editar videos',
    channelId: 'UC123',
    channelTitle: 'Canal',
    views: 1000,
    subs: 1000,
    publishedAt: '2026-01-01T00:00:00.000Z',
    durationSeconds: 300,
    ...overrides,
  };
}

describe('suggestTitles', () => {
  it('builds three drafts with the keyword first', () => {
    const titles = suggestTitles(
      'editar videos',
      recommendations,
      [video()],
      new Date(2026, 5, 1),
    );

    expect(titles).toHaveLength(3);
    expect(titles.map((item) => item.kind)).toEqual(['year', 'number', 'step']);

    for (const item of titles) {
      expect(item.title.toLowerCase()).toContain('editar videos');
    }

    expect(titles[0].title).toContain('2026');
    expect(titles[1].title).toMatch(/\b\d+\b/);
    expect(titles[2].title).toContain('paso a paso');
  });

  it('falls back to safe nouns when there are no phrases', () => {
    const titles = suggestTitles(
      'editar videos',
      { phrases: [], patterns: recommendations.patterns, suggestedTags: [] },
      [],
      new Date('2026-01-01T00:00:00.000Z'),
    );

    expect(titles).toHaveLength(3);
    expect(titles[0].title).toContain('guía completa');
    expect(titles[1].title).toContain('trucos');
    expect(titles[2].title).toContain('para principiantes');
  });

  it('returns nothing for an empty keyword', () => {
    expect(suggestTitles('', recommendations, [], new Date())).toEqual([]);
  });
});
