import { describe, expect, it } from 'vitest';
import {
  parseDurationText,
  parseRelativeAgeDays,
  parseSearchPage,
} from '../src/core/search-page';

const PAGE = `<!doctype html><html><head><script>var ytInitialData = ${JSON.stringify({
  contents: {
    twoColumnSearchResultsRenderer: {
      primaryContents: {
        sectionListRenderer: {
          contents: [
            {
              itemSectionRenderer: {
                contents: [
                  {
                    videoRenderer: {
                      videoId: 'vid1',
                      title: { runs: [{ text: 'Cómo editar videos en 2026' }] },
                      ownerText: { runs: [{ text: 'Canal Uno' }] },
                      viewCountText: { simpleText: '619,847 views' },
                      publishedTimeText: { simpleText: '1y ago' },
                      lengthText: { simpleText: '10:15' },
                    },
                  },
                  {
                    videoRenderer: {
                      videoId: 'vid2',
                      title: { runs: [{ text: 'Editar videos rápido' }] },
                      ownerText: { runs: [{ text: 'Canal Dos' }] },
                      viewCountText: { simpleText: '1.2M views' },
                      publishedTimeText: { simpleText: '2mo ago' },
                      lengthText: { simpleText: '0:45' },
                    },
                  },
                ],
              },
            },
          ],
        },
      },
    },
  },
})};</script></head><body></body></html>`;

describe('parseSearchPage', () => {
  it('extracts the top video results', () => {
    const videos = parseSearchPage(PAGE);
    expect(videos).toHaveLength(2);
    expect(videos?.[0]).toEqual({
      videoId: 'vid1',
      title: 'Cómo editar videos en 2026',
      channelTitle: 'Canal Uno',
      views: 619_847,
      publishedText: '1y ago',
      durationSeconds: 615,
    });
    expect(videos?.[1].views).toBe(1_200_000);
    expect(videos?.[1].durationSeconds).toBe(45);
  });

  it('returns null when the page has no results', () => {
    expect(parseSearchPage('<html></html>')).toBeNull();
    expect(
      parseSearchPage(
        '<script>var ytInitialData = {"contents":{"twoColumnSearchResultsRenderer":{}}};</script>',
      ),
    ).toBeNull();
  });
});

describe('parseDurationText', () => {
  it('parses mm:ss and hh:mm:ss', () => {
    expect(parseDurationText('10:15')).toBe(615);
    expect(parseDurationText('1:02:03')).toBe(3723);
    expect(parseDurationText('0:45')).toBe(45);
    expect(parseDurationText('')).toBe(0);
  });
});

describe('parseRelativeAgeDays', () => {
  it('parses YouTube abbreviations', () => {
    expect(parseRelativeAgeDays('1y ago')).toBe(365);
    expect(parseRelativeAgeDays('2mo ago')).toBe(60);
    expect(parseRelativeAgeDays('3w ago')).toBe(21);
    expect(parseRelativeAgeDays('5d ago')).toBe(5);
    expect(parseRelativeAgeDays('10h ago')).toBeCloseTo(10 / 24);
  });

  it('parses words and Spanish', () => {
    expect(parseRelativeAgeDays('2 months ago')).toBe(60);
    expect(parseRelativeAgeDays('hace 3 semanas')).toBe(21);
    expect(parseRelativeAgeDays('ayer')).toBe(1);
    expect(parseRelativeAgeDays('no date')).toBeNull();
  });
});
