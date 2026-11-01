import { describe, expect, it } from 'vitest';
import { parseIsoDuration } from '../src/core/youtube-api';

describe('parseIsoDuration', () => {
  it('parses hours, minutes and seconds', () => {
    expect(parseIsoDuration('PT1H2M3S')).toBe(3723);
    expect(parseIsoDuration('PT45S')).toBe(45);
    expect(parseIsoDuration('PT12M')).toBe(720);
  });

  it('parses days', () => {
    expect(parseIsoDuration('P1DT2H')).toBe(93_600);
  });

  it('returns 0 for invalid values', () => {
    expect(parseIsoDuration('')).toBe(0);
    expect(parseIsoDuration('nope')).toBe(0);
  });
});
