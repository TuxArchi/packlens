import { describe, expect, it } from 'vitest';
import { analyzeTitleInsights, detectContentLanguage } from '../src/core/insights';
import type { KeywordVideo } from '../src/core/types';

function video(title: string, views = 1000): KeywordVideo {
  return {
    videoId: title,
    title,
    channelId: 'UC123',
    channelTitle: 'Canal',
    views,
    subs: 1000,
    publishedAt: new Date().toISOString(),
    durationSeconds: 300,
  };
}

describe('detectContentLanguage', () => {
  it('detects Spanish and English from common content words', () => {
    expect(detectContentLanguage('cómo editar videos para principiantes')).toBe('es');
    expect(detectContentLanguage('how to edit videos for beginners')).toBe('en');
    expect(detectContentLanguage('editar videos')).toBe('es');
  });
});

describe('analyzeTitleInsights', () => {
  const videos = [
    video('Cómo editar videos en 2026 para principiantes', 10_000),
    video('Editar videos rápido: 5 trucos que funcionan', 8_000),
    video('Guía completa de editar videos desde cero', 5_000),
    video('Editar videos sin complicaciones', 3_000),
    video('7 errores al editar videos que debes evitar', 2_000),
  ];

  it('measures title patterns and keyword placement', () => {
    const insights = analyzeTitleInsights('editar videos', videos);

    expect(insights.sampleSize).toBe(5);
    expect(insights.language).toBe('es');
    expect(insights.averageLength).toBeGreaterThan(30);
    expect(insights.medianLength).toBeGreaterThan(30);
    expect(insights.keywordAtStart).toBe(2);
    expect(insights.withNumber).toBe(2);
    expect(insights.withYear).toBe(1);
    expect(insights.withColon).toBe(1);
    expect(insights.withQuestion).toBe(1);
    expect(insights.withPowerWord).toBeGreaterThan(0);
  });

  it('extracts angles, numbers and common nouns', () => {
    const insights = analyzeTitleInsights('editar videos', videos);

    expect(insights.angles).toContain('para principiantes');
    expect(insights.angles).toContain('desde cero');
    expect(insights.angles).toContain('sin complicaciones');
    expect(insights.numbers).toContain('5');
    expect(insights.numbers).toContain('7');
    expect(insights.nouns.length).toBeGreaterThan(0);
    expect(insights.powerWords.length).toBeGreaterThan(0);
  });

  it('detects English patterns', () => {
    const insights = analyzeTitleInsights('video editing', [
      video('How to edit videos step by step', 10_000),
      video('7 video editing tips for beginners', 5_000),
      video('Video editing from scratch', 3_000),
    ]);

    expect(insights.language).toBe('en');
    expect(insights.angles).toContain('step by step');
    expect(insights.angles).toContain('for beginners');
    expect(insights.angles).toContain('from scratch');
  });

  it('handles an empty list', () => {
    const insights = analyzeTitleInsights('editar videos', []);

    expect(insights.sampleSize).toBe(0);
    expect(insights.averageLength).toBe(0);
    expect(insights.medianLength).toBe(0);
    expect(insights.nouns).toEqual([]);
    expect(insights.angles).toEqual([]);
    expect(insights.numbers).toEqual([]);
    expect(insights.language).toBe('es');
  });
});
