import fs from 'node:fs';
import { PNG } from 'pngjs';
import type { BoundingBox } from './schemas/manifest.js';

export interface TemplateMatchResult {
  pixelVisibilityRatio: number; // fraction of target pixels within Euclidean RGB tolerance <= 5
  measuredLoss: number; // 1.0 - pixelVisibilityRatio
  rNcc: number; // Normalized Cross-Correlation in [0.0, 1.0]
  unchangedPixelCount: number;
  pixelLossCount: number;
  totalPixels: number;
  targetBBox: BoundingBox;
}

/**
 * Instrument B: Pure TypeScript deterministic pixel-template matcher
 * Compares target bounding box patch at frame t0 vs frame tk.
 *
 * @param t0Input File path or Buffer/Uint8Array of frame t0 PNG
 * @param tkInput File path or Buffer/Uint8Array of frame tk PNG
 * @param targetBBox Target element bounding box { x, y, width, height }
 * @param tolerance Euclidean RGB distance tolerance (default 5.0 per spec)
 */
export function computeTemplateMatchVisibility(
  t0Input: string | Buffer | Uint8Array,
  tkInput: string | Buffer | Uint8Array,
  targetBBox: BoundingBox,
  tolerance = 5.0,
): TemplateMatchResult {
  const t0Buffer = typeof t0Input === 'string' ? fs.readFileSync(t0Input) : Buffer.from(t0Input);
  const tkBuffer = typeof tkInput === 'string' ? fs.readFileSync(tkInput) : Buffer.from(tkInput);

  if (
    !Number.isFinite(targetBBox.x) ||
    !Number.isFinite(targetBBox.y) ||
    !Number.isFinite(targetBBox.width) ||
    !Number.isFinite(targetBBox.height) ||
    targetBBox.width <= 0 ||
    targetBBox.height <= 0
  ) {
    throw new Error(
      `Invalid target bounding box: [x=${targetBBox.x}, y=${targetBBox.y}, width=${targetBBox.width}, height=${targetBBox.height}]. Coordinates must be finite numbers and dimensions positive.`,
    );
  }

  const png0 = PNG.sync.read(t0Buffer);
  const pngk = PNG.sync.read(tkBuffer);

  const imgW = Math.min(png0.width, pngk.width);
  const imgH = Math.min(png0.height, pngk.height);

  const startX = Math.max(0, Math.min(imgW, Math.floor(targetBBox.x)));
  const startY = Math.max(0, Math.min(imgH, Math.floor(targetBBox.y)));
  const endX = Math.max(0, Math.min(imgW, Math.floor(targetBBox.x + targetBBox.width)));
  const endY = Math.max(0, Math.min(imgH, Math.floor(targetBBox.y + targetBBox.height)));

  const totalPixels = (endX - startX) * (endY - startY);
  if (totalPixels <= 0) {
    throw new Error(
      `Target bounding box [x=${targetBBox.x}, y=${targetBBox.y}, width=${targetBBox.width}, height=${targetBBox.height}] is outside image bounds [${imgW}x${imgH}].`,
    );
  }

  let unchangedPixelCount = 0;
  const luminance0: number[] = new Array(totalPixels);
  const luminanceK: number[] = new Array(totalPixels);

  let sumA = 0;
  let sumB = 0;
  let idx = 0;

  for (let y = startY; y < endY; y++) {
    for (let x = startX; x < endX; x++) {
      const byteIdx = (y * png0.width + x) * 4;

      const r0 = png0.data[byteIdx];
      const g0 = png0.data[byteIdx + 1];
      const b0 = png0.data[byteIdx + 2];

      const rk = pngk.data[byteIdx];
      const gk = pngk.data[byteIdx + 1];
      const bk = pngk.data[byteIdx + 2];

      // Euclidean distance in RGB color space
      const dist = Math.sqrt((r0 - rk) ** 2 + (g0 - gk) ** 2 + (b0 - bk) ** 2);
      if (dist <= tolerance) {
        unchangedPixelCount++;
      }

      // Grayscale luminance (ITU-R BT.601)
      const lum0 = 0.299 * r0 + 0.587 * g0 + 0.114 * b0;
      const lumK = 0.299 * rk + 0.587 * gk + 0.114 * bk;

      luminance0[idx] = lum0;
      luminanceK[idx] = lumK;
      sumA += lum0;
      sumB += lumK;
      idx++;
    }
  }

  const pixelLossCount = totalPixels - unchangedPixelCount;
  const pixelVisibilityRatio = unchangedPixelCount / totalPixels;
  const measuredLoss = pixelLossCount / totalPixels;

  // Compute Normalized Cross-Correlation (R_NCC)
  const meanA = sumA / totalPixels;
  const meanB = sumB / totalPixels;

  let cov = 0;
  let varA = 0;
  let varB = 0;

  for (let i = 0; i < totalPixels; i++) {
    const da = luminance0[i] - meanA;
    const db = luminanceK[i] - meanB;
    cov += da * db;
    varA += da * da;
    varB += db * db;
  }

  let rNcc = 1.0;
  const denominator = Math.sqrt(varA * varB);
  if (denominator > 0) {
    const rawNcc = cov / denominator;
    rNcc = Math.max(0.0, Math.min(1.0, rawNcc));
  } else {
    // Zero variance in one or both patches (flat color):
    // Fall back to pixelVisibilityRatio instead of 0 or NaN
    rNcc = pixelVisibilityRatio;
  }

  return {
    pixelVisibilityRatio,
    measuredLoss,
    rNcc,
    unchangedPixelCount,
    pixelLossCount,
    totalPixels,
    targetBBox,
  };
}
