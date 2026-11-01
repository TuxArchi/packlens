import { describe, expect, it } from 'vitest';
import { analyzePackaging } from '../src/core/packaging';
import type { ThumbMetrics } from '../src/core/image-metrics';

const goodMetrics: ThumbMetrics = {
  width: 480,
  height: 270,
  luminanceMean: 120,
  luminanceStd: 55,
  tonalRange: 200,
  edgeDensity: 0.12,
  colorfulness: 60,
  saturationMean: 0.5,
  mobileRange: 180,
  mobileRetention: 0.9,
  mobileSharpness: 120,
};

const flatMetrics: ThumbMetrics = {
  ...goodMetrics,
  luminanceStd: 5,
  tonalRange: 20,
  edgeDensity: 0.01,
  colorfulness: 4,
  mobileRange: 10,
  mobileRetention: 0.4,
};

describe('analyzePackaging', () => {
  it('combines thumbnail and title into a single score', () => {
    const report = analyzePackaging('Cómo editar videos en 2026: 7 ajustes clave', goodMetrics);
    expect(report.partial).toBe(false);
    expect(report.thumbnail).not.toBeNull();
    expect(report.score).toBeGreaterThan(85);
  });

  it('punishes a flat thumbnail', () => {
    const good = analyzePackaging('Cómo editar videos en 2026: 7 ajustes clave', goodMetrics);
    const flat = analyzePackaging('Cómo editar videos en 2026: 7 ajustes clave', flatMetrics);
    expect(flat.score).toBeLessThan(good.score);
    expect(flat.thumbnail?.checks.every((check) => check.status !== 'good')).toBe(true);
  });

  it('falls back to the title score when the thumbnail is missing', () => {
    const report = analyzePackaging('Título de prueba con 2026', null);
    expect(report.partial).toBe(true);
    expect(report.score).toBe(Math.round(report.title.score));
  });
});
