/**
 * Instrument A: SAM Visibility Ratio
 *
 * Given decoded raster masks M(t0) (baseline frame t0) and M(tk) (evaluation frame tk)
 * cropped or intersected with the target region, computes:
 *   R_SAM = min(1.0, Area(M(tk)) / Area(M(t0)))
 *   Estimated occlusion = 1.0 - R_SAM
 */

export interface SamVisibilityRatioResult {
  rSam: number;
  estimatedOcclusion: number;
  baselineArea: number;
  evalArea: number;
}

function countMaskArea(mask: Uint8Array | number[]): number {
  let count = 0;
  for (let i = 0; i < mask.length; i++) {
    if ((mask[i] ?? 0) > 0) {
      count++;
    }
  }
  return count;
}

export function computeSamVisibilityRatio(
  baseline: Uint8Array | number[] | number,
  evaluation: Uint8Array | number[] | number,
): SamVisibilityRatioResult {
  const areaT0 = typeof baseline === 'number' ? baseline : countMaskArea(baseline);
  const areaTk = typeof evaluation === 'number' ? evaluation : countMaskArea(evaluation);

  if (areaT0 <= 0) {
    throw new Error('Baseline SAM mask area must be greater than zero');
  }

  const rawRatio = areaTk / areaT0;
  const rSam = Math.min(1.0, Math.max(0.0, rawRatio));
  const estimatedOcclusion = 1.0 - rSam;

  return {
    rSam,
    estimatedOcclusion,
    baselineArea: areaT0,
    evalArea: areaTk,
  };
}
