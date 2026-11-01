import { describe, expect, it } from 'vitest';
import { analyzeDescriptionInsights } from '../src/core/description-insights';

const samples = [
  {
    description:
      'En este video hablamos de editar videos con Premiere Pro. #editing #premierepro',
  },
  {
    description:
      'Tutorial de edición de video y editar videos rápido. #editing #video',
  },
  {
    description: 'Editar videos con CapCut. #capcut #editing',
  },
];

describe('analyzeDescriptionInsights', () => {
  it('measures sample size, length and keyword coverage', () => {
    const insights = analyzeDescriptionInsights('editar videos', samples);

    expect(insights.sampleSize).toBe(3);
    expect(insights.averageLength).toBeGreaterThan(0);
    expect(insights.medianLength).toBeGreaterThan(0);
    expect(insights.keywordCoverage).toBe(3);
  });

  it('extracts repeated terms from competitor descriptions', () => {
    const insights = analyzeDescriptionInsights('editar videos', samples);

    expect(insights.commonTerms).toContain('editar videos');
    expect(insights.commonTerms.length).toBeGreaterThan(0);
  });

  it('ranks hashtags and filters generic ones', () => {
    const insights = analyzeDescriptionInsights('editar videos', samples);

    expect(insights.commonHashtags[0]).toBe('#editing');
    expect(insights.commonHashtags).toContain('#premierepro');
    expect(insights.commonHashtags).not.toContain('#video');
  });

  it('ignores empty descriptions', () => {
    const insights = analyzeDescriptionInsights('editar videos', [
      { description: '' },
      { description: '   ' },
    ]);

    expect(insights.sampleSize).toBe(0);
    expect(insights.averageLength).toBe(0);
    expect(insights.medianLength).toBe(0);
    expect(insights.keywordCoverage).toBe(0);
    expect(insights.commonTerms).toEqual([]);
    expect(insights.commonHashtags).toEqual([]);
  });
});
