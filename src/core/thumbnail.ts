import type { PixelSource } from './image-metrics';
import { ANALYSIS_WIDTH } from './image-metrics';

const THUMBNAIL_HOST = 'https://i.ytimg.com/vi';
const QUALITY_FALLBACKS = ['maxresdefault', 'sddefault', 'hqdefault'];

async function drawToPixels(blob: Blob): Promise<PixelSource | null> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(blob);
  } catch {
    return null;
  }

  const width = Math.min(ANALYSIS_WIDTH, bitmap.width);
  const height = Math.max(1, Math.round((bitmap.height / bitmap.width) * width));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) {
    bitmap.close();
    return null;
  }

  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  try {
    const imageData = context.getImageData(0, 0, width, height);
    return { data: imageData.data, width, height };
  } catch {
    return null;
  }
}

/**
 * Fetches the highest quality thumbnail available and converts it to raw
 * pixels. Runs in the sidebar (an extension page), where host permissions
 * allow reading i.ytimg.com without CORS issues.
 */
export async function loadThumbnail(
  videoId: string | null,
  fallbackUrl: string | null,
): Promise<PixelSource | null> {
  const urls: string[] = [];
  if (videoId) {
    for (const quality of QUALITY_FALLBACKS) {
      urls.push(`${THUMBNAIL_HOST}/${videoId}/${quality}.jpg`);
    }
  }
  if (fallbackUrl) urls.push(fallbackUrl);

  for (const url of urls) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);

    try {
      const response = await fetch(url, {
        credentials: 'include',
        cache: 'force-cache',
        signal: controller.signal,
      });
      if (!response.ok) continue;
      const blob = await response.blob();
      const pixels = await drawToPixels(blob);
      if (pixels) return pixels;
    } catch {
      // Try the next quality level.
    } finally {
      clearTimeout(timer);
    }
  }

  return null;
}
