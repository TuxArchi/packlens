import { describe, expect, it } from 'vitest';
import { normalizeRawVideo, toVideoData } from '../src/core/player';

describe('normalizeRawVideo', () => {
  it('rejects payloads without a videoId', () => {
    expect(normalizeRawVideo(null)).toBeNull();
    expect(normalizeRawVideo({ title: 'x' })).toBeNull();
    expect(normalizeRawVideo({ videoId: '' })).toBeNull();
  });

  it('coerces numeric strings and drops invalid tags', () => {
    const raw = normalizeRawVideo({
      videoId: 'abc12345678',
      title: '  A title  ',
      keywords: ['uno', 42, ' dos ', ''],
      viewCount: '1234',
      lengthSeconds: 90,
      thumbnails: ['https://example.com/a.jpg', 7],
    });

    expect(raw).not.toBeNull();
    expect(raw?.viewCount).toBe(1234);
    expect(raw?.lengthSeconds).toBe(90);
    expect(raw?.keywords).toEqual(['uno', 'dos']);
    expect(raw?.thumbnails).toEqual(['https://example.com/a.jpg']);
  });
});

describe('toVideoData', () => {
  it('prefers the high resolution thumbnail built from the id', () => {
    const raw = normalizeRawVideo({
      videoId: 'abc12345678',
      title: 'A title',
      thumbnails: ['https://i.ytimg.com/vi/abc12345678/hqdefault.jpg'],
    });

    const data = toVideoData(raw!, 'watch');
    expect(data.thumbnailUrl).toBe('https://i.ytimg.com/vi/abc12345678/maxresdefault.jpg');
    expect(data.source).toBe('watch');
  });
});
