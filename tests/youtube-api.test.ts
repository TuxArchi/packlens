import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  fetchChannelUploads,
  fetchVideoDescriptions,
  fetchVideoItems,
  parseIsoDuration,
} from '../src/core/youtube-api';

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

describe('fetchChannelUploads', () => {
  it('reads the uploads playlist and paginates', async () => {
    const calls: string[] = [];
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      calls.push(url);
      if (url.includes('/channels')) {
        return {
          ok: true,
          json: async () => ({
            items: [
              {
                snippet: { title: 'Canal' },
                contentDetails: { relatedPlaylists: { uploads: 'UU123' } },
              },
            ],
          }),
        };
      }
      return {
        ok: true,
        json: async () => ({
          items: [
            { contentDetails: { videoId: 'a' } },
            { contentDetails: { videoId: 'b' } },
          ],
        }),
      };
    });
    vi.stubGlobal('fetch', fetchMock);

    const uploads = await fetchChannelUploads('UC123', 'KEY');

    expect(uploads.channelName).toBe('Canal');
    expect(uploads.videoIds).toEqual(['a', 'b']);
    expect(uploads.truncated).toBe(false);
    expect(uploads.units).toBe(2);
    expect(calls[0]).toContain('/channels');
    expect(calls[1]).toContain('/playlistItems');
    expect(calls[1]).toContain('playlistId=UU123');
  });

  it('marks the audit as truncated at the page limit', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/channels')) {
        return {
          ok: true,
          json: async () => ({
            items: [
              {
                snippet: { title: 'Canal' },
                contentDetails: { relatedPlaylists: { uploads: 'UU123' } },
              },
            ],
          }),
        };
      }
      return {
        ok: true,
        json: async () => ({
          items: [{ contentDetails: { videoId: 'a' } }],
          nextPageToken: 'NEXT',
        }),
      };
    });
    vi.stubGlobal('fetch', fetchMock);

    const uploads = await fetchChannelUploads('UC123', 'KEY', 1);
    expect(uploads.truncated).toBe(true);
    expect(uploads.units).toBe(2);
  });
});

describe('fetchVideoItems', () => {
  it('parses likes and comments for the performance review', async () => {
    const fetchMock = vi.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) => ({
        ok: true,
        json: async () => ({
          items: [
            {
              id: 'video-1',
              snippet: {
                title: 'Video',
                channelId: 'UC123',
                channelTitle: 'Channel',
                publishedAt: '2026-01-01T00:00:00Z',
              },
              statistics: {
                viewCount: '1000',
                likeCount: '55',
                commentCount: '12',
              },
              contentDetails: { duration: 'PT1M' },
            },
          ],
        }),
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const [video] = await fetchVideoItems(['video-1'], 'KEY');
    expect(video.views).toBe(1000);
    expect(video.likes).toBe(55);
    expect(video.comments).toBe(12);
    expect(video.channelId).toBe('UC123');
  });
});
