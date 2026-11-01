import { describe, expect, it } from 'vitest';
import { computeThumbMetrics } from '../src/core/image-metrics';
import type { PixelSource } from '../src/core/image-metrics';

function solid(width: number, height: number, rgb: [number, number, number]): PixelSource {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < width * height; i += 1) {
    const offset = i * 4;
    data[offset] = rgb[0];
    data[offset + 1] = rgb[1];
    data[offset + 2] = rgb[2];
    data[offset + 3] = 255;
  }
  return { data, width, height };
}

function checkerboard(width: number, height: number, cell: number): PixelSource {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const value = (Math.floor(x / cell) + Math.floor(y / cell)) % 2 === 0 ? 245 : 10;
      const offset = (y * width + x) * 4;
      data[offset] = value;
      data[offset + 1] = value;
      data[offset + 2] = value;
      data[offset + 3] = 255;
    }
  }
  return { data, width, height };
}

describe('computeThumbMetrics', () => {
  it('detects a flat image', () => {
    const metrics = computeThumbMetrics(solid(320, 180, [128, 128, 128]));
    expect(metrics.tonalRange).toBe(0);
    expect(metrics.edgeDensity).toBeLessThan(0.001);
    expect(metrics.mobileRetention).toBe(0);
    expect(metrics.colorfulness).toBeLessThan(1);
  });

  it('detects high contrast and edges', () => {
    const metrics = computeThumbMetrics(checkerboard(320, 180, 10));
    expect(metrics.tonalRange).toBeGreaterThan(200);
    expect(metrics.edgeDensity).toBeGreaterThan(0.05);
    expect(metrics.mobileRetention).toBeGreaterThan(0.7);
    expect(metrics.colorfulness).toBeLessThan(5);
  });

  it('detects colourfulness', () => {
    const metrics = computeThumbMetrics(solid(320, 180, [220, 30, 30]));
    expect(metrics.colorfulness).toBeGreaterThan(30);
    expect(metrics.saturationMean).toBeGreaterThan(0.5);
  });
});
