import { describe, expect, it } from 'vitest';
import { extractPublishedVideo } from '../src/core/watch-page';

const HTML = `<!doctype html><html><head>
<script>var ytInitialPlayerResponse = {"videoDetails":{"videoId":"dQw4w9WgXcQ","title":"A title","keywords":["uno"," dos ","",null,42]}};</script>
</head><body></body></html>`;

describe('extractPublishedVideo', () => {
  it('extracts the video id, title and tags', () => {
    expect(extractPublishedVideo(HTML)).toEqual({
      videoId: 'dQw4w9WgXcQ',
      title: 'A title',
      tags: ['uno', 'dos'],
    });
  });

  it('returns null when the bootstrap state is missing', () => {
    expect(extractPublishedVideo('<html><body>nope</body></html>')).toBeNull();
  });

  it('returns null when videoDetails is missing', () => {
    const html = '<script>var ytInitialPlayerResponse = {"playabilityStatus":{}};</script>';
    expect(extractPublishedVideo(html)).toBeNull();
  });

  it('returns an empty tag list when the video has no keywords', () => {
    const html =
      '<script>var ytInitialPlayerResponse = {"videoDetails":{"videoId":"abcdefghijk","title":"T"}};</script>';
    expect(extractPublishedVideo(html)).toEqual({
      videoId: 'abcdefghijk',
      title: 'T',
      tags: [],
    });
  });
});
