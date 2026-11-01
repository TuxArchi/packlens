import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchVideoDescriptions, parseIsoDuration } from '../src/core/youtube-api';

afterEach(() => {
  vi.unstubAllGlobals();
});

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

describe('fetchVideoDescriptions', () => {
  it('parses descriptions and tags and restores the requested order', async () => {
    const fetchMock = vi.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) => ({
        ok: true,
        json: async () => ({
          items: [
            {
              id: 'second',
              snippet: { title: 'Second', description: 'Dos', tags: ['b'] },
            },
            {
              id: 'first',
              snippet: { title: 'First', description: 'Uno', tags: ['a', 3] },
            },
          ],
        }),
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await fetchVideoDescriptions(['first', 'second'], 'KEY');

    expect(result).toEqual([
      { videoId: 'first', title: 'First', description: 'Uno', tags: ['a'] },
      { videoId: 'second', title: 'Second', description: 'Dos', tags: ['b'] },
    ]);
    const url = String(fetchMock.mock.calls[0][0]);
    expect(url).toContain('part=snippet');
    expect(url).toContain('id=first%2Csecond');
    expect(url).toContain('key=KEY');
  });

  it('does not call the API without ids', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    expect(await fetchVideoDescriptions([], 'KEY')).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
