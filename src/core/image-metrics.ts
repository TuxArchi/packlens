export interface PixelSource {
  data: Uint8ClampedArray | Uint8Array;
  width: number;
  height: number;
}

export interface ThumbMetrics {
  width: number;
  height: number;
  luminanceMean: number;
  luminanceStd: number;
  /** Difference between the 95th and 5th luminance percentiles (0..255). */
  tonalRange: number;
  /** Share of pixels that sit on a strong Sobel edge (0..1). */
  edgeDensity: number;
  /** Hasler-Süsstrunk colourfulness metric. */
  colorfulness: number;
  saturationMean: number;
  /** Tonal range after downscaling, used as a mobile legibility proxy. */
  mobileRange: number;
  mobileRetention: number;
  mobileSharpness: number;
}

// Analysis is always normalised to this width so edge density is comparable
// between videos (a 1280px and a 480px source would otherwise disagree).
export const ANALYSIS_WIDTH = 480;
const MOBILE_WIDTH = 168;
const EDGE_MAGNITUDE = 160;

function percentile(sorted: Float32Array, ratio: number): number {
  if (sorted.length === 0) return 0;
  const index = Math.min(sorted.length - 1, Math.max(0, Math.round((sorted.length - 1) * ratio)));
  return sorted[index];
}

function downscale(lum: Float32Array, width: number, height: number, targetWidth: number) {
  const scale = Math.min(1, targetWidth / width);
  const outWidth = Math.max(1, Math.round(width * scale));
  const outHeight = Math.max(1, Math.round(height * scale));
  const out = new Float32Array(outWidth * outHeight);

  const xRatio = width / outWidth;
  const yRatio = height / outHeight;

  for (let y = 0; y < outHeight; y += 1) {
    const y0 = Math.floor(y * yRatio);
    const y1 = Math.min(height, Math.max(y0 + 1, Math.floor((y + 1) * yRatio)));
    for (let x = 0; x < outWidth; x += 1) {
      const x0 = Math.floor(x * xRatio);
      const x1 = Math.min(width, Math.max(x0 + 1, Math.floor((x + 1) * xRatio)));
      let sum = 0;
      let count = 0;
      for (let yy = y0; yy < y1; yy += 1) {
        for (let xx = x0; xx < x1; xx += 1) {
          sum += lum[yy * width + xx];
          count += 1;
        }
      }
      out[y * outWidth + x] = count > 0 ? sum / count : 0;
    }
  }

  return { lum: out, width: outWidth, height: outHeight };
}

function laplacianVariance(lum: Float32Array, width: number, height: number): number {
  let sum = 0;
  let squareSum = 0;
  let count = 0;

  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const i = y * width + x;
      const value = 4 * lum[i] - lum[i - 1] - lum[i + 1] - lum[i - width] - lum[i + width];
      sum += value;
      squareSum += value * value;
      count += 1;
    }
  }

  if (count === 0) return 0;
  const mean = sum / count;
  return Math.max(0, squareSum / count - mean * mean);
}

export function computeThumbMetrics(image: PixelSource): ThumbMetrics {
  const { data, width, height } = image;
  const pixelCount = width * height;
  if (pixelCount === 0) {
    return {
      width,
      height,
      luminanceMean: 0,
      luminanceStd: 0,
      tonalRange: 0,
      edgeDensity: 0,
      colorfulness: 0,
      saturationMean: 0,
      mobileRange: 0,
      mobileRetention: 0,
      mobileSharpness: 0,
    };
  }

  const lum = new Float32Array(pixelCount);
  let luminanceSum = 0;
  let saturationSum = 0;
  let rgSum = 0;
  let rgSquareSum = 0;
  let ybSum = 0;
  let ybSquareSum = 0;

  for (let i = 0, p = 0; i < pixelCount; i += 1, p += 4) {
    const r = data[p];
    const g = data[p + 1];
    const b = data[p + 2];
    const l = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    lum[i] = l;
    luminanceSum += l;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    saturationSum += max === 0 ? 0 : (max - min) / max;

    const rg = r - g;
    const yb = 0.5 * (r + g) - b;
    rgSum += rg;
    rgSquareSum += rg * rg;
    ybSum += yb;
    ybSquareSum += yb * yb;
  }

  const luminanceMean = luminanceSum / pixelCount;
  let varianceSum = 0;
  for (let i = 0; i < pixelCount; i += 1) {
    const delta = lum[i] - luminanceMean;
    varianceSum += delta * delta;
  }
  const luminanceStd = Math.sqrt(varianceSum / pixelCount);

  const sorted = Float32Array.from(lum).sort();
  const tonalRange = Math.max(0, percentile(sorted, 0.95) - percentile(sorted, 0.05));

  const rgMean = rgSum / pixelCount;
  const ybMean = ybSum / pixelCount;
  const rgVariance = Math.max(0, rgSquareSum / pixelCount - rgMean * rgMean);
  const ybVariance = Math.max(0, ybSquareSum / pixelCount - ybMean * ybMean);
  const colorfulness =
    Math.sqrt(rgVariance + ybVariance) + 0.3 * Math.sqrt(rgMean * rgMean + ybMean * ybMean);

  let edgePixels = 0;
  let edgeSamples = 0;
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const i = y * width + x;
      const gx =
        lum[i - width + 1] + 2 * lum[i + 1] + lum[i + width + 1] -
        (lum[i - width - 1] + 2 * lum[i - 1] + lum[i + width - 1]);
      const gy =
        lum[i + width - 1] + 2 * lum[i + width] + lum[i + width + 1] -
        (lum[i - width - 1] + 2 * lum[i - width] + lum[i - width + 1]);
      if (Math.abs(gx) + Math.abs(gy) > EDGE_MAGNITUDE) edgePixels += 1;
      edgeSamples += 1;
    }
  }
  const edgeDensity = edgeSamples > 0 ? edgePixels / edgeSamples : 0;

  const mobile = downscale(lum, width, height, MOBILE_WIDTH);
  const mobileSorted = Float32Array.from(mobile.lum).sort();
  const mobileRange = Math.max(
    0,
    percentile(mobileSorted, 0.95) - percentile(mobileSorted, 0.05),
  );
  const mobileRetention = tonalRange > 1 ? Math.min(1.5, mobileRange / tonalRange) : 0;

  return {
    width,
    height,
    luminanceMean,
    luminanceStd,
    tonalRange,
    edgeDensity,
    colorfulness,
    saturationMean: saturationSum / pixelCount,
    mobileRange,
    mobileRetention,
    mobileSharpness: laplacianVariance(mobile.lum, mobile.width, mobile.height),
  };
}
