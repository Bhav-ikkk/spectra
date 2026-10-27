import { getCalibration, assertCalibrated } from './calibration.js';
import type { CalibrationData, Verdict } from './schemas/verdict.js';
import type { BoundingBox } from './schemas/manifest.js';

export interface DualInstrumentInput {
  clipId?: string;
  rSam: number;
  rNcc: number;
  visRatio?: number; // Fraction of target pixels within color tolerance
  targetBBox?: BoundingBox;
  pixelLossCount?: number;
  totalPixels?: number;
  calibration?: CalibrationData;
}

export interface DualInstrumentVerdict {
  verdict: Verdict;
  reason: string;
  visibilityLoss: number;
  visibilityPercentage: number;
  instrumentAgreementDelta: number;
  threshold: number; // 3 * sigma_noise
  disagreementThreshold: number; // delta
  rSam: number;
  visRatio: number;
  rNcc: number;
  pixelLossCount?: number;
  totalPixels?: number;
  targetBBox?: BoundingBox;
  calibration: CalibrationData;
}

/**
 * Dual-Instrument Referee Verdict Engine (Blueprint Pillar 1)
 *
 * 1. Calls assertCalibrated() first (enforces Rule 2).
 * 2. Checks instrument agreement: if |R_SAM - visRatio| > delta -> "inconclusive".
 * 3. Otherwise, computes visibility loss L = 1.0 - (R_SAM + visRatio) / 2.
 * 4. If L > 3 * sigma_noise -> "fail" (REJECTED) with measured visibility %, pixel loss, and bounding coordinates.
 * 5. If L <= 3 * sigma_noise -> "pass" (VERIFIED).
 */
export function evaluateDualInstrument(input: DualInstrumentInput): DualInstrumentVerdict {
  const cal = input.calibration ?? getCalibration();
  assertCalibrated(cal);

  const sigma = cal.sigma_noise!;
  const delta = cal.delta!;
  const threshold = 3 * sigma;

  const visRatio = input.visRatio !== undefined ? input.visRatio : input.rNcc;
  const instrumentAgreementDelta = Math.abs(input.rSam - visRatio);

  const baseResult = {
    rSam: input.rSam,
    visRatio,
    rNcc: input.rNcc,
    threshold,
    disagreementThreshold: delta,
    pixelLossCount: input.pixelLossCount,
    totalPixels: input.totalPixels,
    targetBBox: input.targetBBox,
    calibration: cal,
  };

  // 1. Check instrument agreement
  if (instrumentAgreementDelta > delta) {
    const combinedVisibility = (input.rSam + visRatio) / 2;
    return {
      ...baseResult,
      verdict: 'inconclusive',
      reason: `Instrument disagreement (${(instrumentAgreementDelta * 100).toFixed(2)}%) exceeds delta (${(delta * 100).toFixed(2)}%)`,
      visibilityLoss: 1.0 - combinedVisibility,
      visibilityPercentage: Math.max(0.0, Math.min(100.0, combinedVisibility * 100)),
      instrumentAgreementDelta,
    };
  }

  // 2. Compute combined visibility loss L = 1.0 - (R_SAM + visRatio) / 2
  const combinedVisibility = (input.rSam + visRatio) / 2;
  const visibilityLoss = 1.0 - combinedVisibility;
  const visibilityPercentage = Math.max(0.0, Math.min(100.0, combinedVisibility * 100));

  // 3. Compare with 3 * sigma_noise threshold
  if (visibilityLoss > threshold) {
    const bboxDesc = input.targetBBox
      ? ` at [x=${input.targetBBox.x}, y=${input.targetBBox.y}, w=${input.targetBBox.width}, h=${input.targetBBox.height}]`
      : '';
    const lossDesc =
      input.pixelLossCount != null && input.totalPixels != null
        ? ` (${input.pixelLossCount}/${input.totalPixels} px loss)`
        : '';

    return {
      ...baseResult,
      verdict: 'fail',
      reason: `REJECTED: Visibility loss ${(visibilityLoss * 100).toFixed(2)}% exceeds threshold ${(threshold * 100).toFixed(2)}%${lossDesc}${bboxDesc}`,
      visibilityLoss,
      visibilityPercentage,
      instrumentAgreementDelta,
    };
  }

  return {
    ...baseResult,
    verdict: 'pass',
    reason: `VERIFIED: Visibility ${visibilityPercentage.toFixed(2)}% within noise tolerance (${(threshold * 100).toFixed(2)}%)`,
    visibilityLoss,
    visibilityPercentage,
    instrumentAgreementDelta,
  };
}
