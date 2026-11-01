import { describe, expect, it } from 'vitest';
import { parseChannelPage, parseViewCount } from '../src/core/channel-page';
import { computeOutliers } from '../src/core/outliers';

const PAGE = `<!doctype html><html><head>
<script>var ytInitialData = ${JSON.stringify({
  metadata: {
    channelMetadataRenderer: {
      externalId: 'UCuAXFkgsw1L7xaCfnd5JJOw',
      title: 'Canal de prueba',
    },
  },
  contents: {
    twoColumnBrowseResultsRenderer: {
      tabs: [
        {
          tabRenderer: {
            content: {
              richGridRenderer: {
                contents: [
                  {
                    richItemRenderer: {
                      content: {
                        lockupViewModel: {
                          contentId: 'vid1',
                          metadata: {
                            lockupMetadataViewModel: {
                              title: { content: 'Video uno' },
                              metadata: {
                                contentMetadataViewModel: {
                                  metadataRows: [
                                    {
                                      metadataParts: [
                                        {
                                          text: { content: '114K' },
                                          accessibilityLabel: '114 thousand views',
                                          leadingIcon: { name: 'PLAY_ARROW_OUTLINED' },
                                        },
                                        {
                                          text: { content: '4mo ago' },
                                          accessibilityLabel: '4 months ago',
                                        },
                                      ],
                                    },
                                  ],
                                },
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                  {
                    richItemRenderer: {
                      content: {
                        videoRenderer: {
                          videoId: 'vid2',
                          title: { runs: [{ text: 'Video dos' }] },
                          viewCountText: { simpleText: '1.2M views' },
                        },
                      },
                    },
                  },
                ],
              },
            },
          },
        },
      ],
    },
  },
})};</script>
</head><body></body></html>`;

describe('parseViewCount', () => {
  it('parses compact and full English counts', () => {
    expect(parseViewCount('114K')).toBe(114_000);
    expect(parseViewCount('1.2M views')).toBe(1_200_000);
    expect(parseViewCount('2.3B views')).toBe(2_300_000_000);
    expect(parseViewCount('1,234 views')).toBe(1234);
    expect(parseViewCount('114 thousand views')).toBe(114_000);
  });

  it('parses Spanish compact counts as a fallback', () => {
    expect(parseViewCount('1,2 M de visualizaciones')).toBe(1_200_000);
    expect(parseViewCount('114 mil visualizaciones')).toBe(114_000);
  });

  it('returns 0 when there is no count', () => {
    expect(parseViewCount('No views')).toBe(0);
    expect(parseViewCount('')).toBe(0);
  });
});

describe('parseChannelPage', () => {
  it('reads the channel metadata and the new lockup items', () => {
    const page = parseChannelPage(PAGE);
    expect(page?.channelId).toBe('UCuAXFkgsw1L7xaCfnd5JJOw');
    expect(page?.channelName).toBe('Canal de prueba');
    expect(page?.videos).toEqual([
      { videoId: 'vid1', title: 'Video uno', views: 114_000 },
      { videoId: 'vid2', title: 'Video dos', views: 1_200_000 },
    ]);
  });

  it('returns null when the page has no bootstrap data', () => {
    expect(parseChannelPage('<html></html>')).toBeNull();
  });
});

describe('computeOutliers', () => {
  it('computes the median and sorts by outlier ratio', () => {
    const result = computeOutliers([
      { videoId: 'a', title: 'A', views: 1000 },
      { videoId: 'b', title: 'B', views: 3000 },
      { videoId: 'c', title: 'C', views: 2000 },
    ]);

    expect(result.medianViews).toBe(2000);
    expect(result.videos.map((video) => video.videoId)).toEqual(['b', 'c', 'a']);
    expect(result.videos[0].outlier).toBe(1.5);
    expect(result.videos[2].outlier).toBe(0.5);
  });

  it('handles an empty list', () => {
    expect(computeOutliers([])).toEqual({ medianViews: 0, videos: [] });
  });
});
