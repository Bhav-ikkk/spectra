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
 * 2. Checks gross instrument agreement: if |R_SAM - visRatio| > delta -> "inconclusive".
 * 3. Checks directional agreement across decision boundary:
 *    If one instrument measures loss > threshold and the other measures loss <= threshold
 *    with |R_SAM - visRatio| > 2 * sigma_noise -> "inconclusive" ("Instruments disagree across decision boundary").
 * 4. Otherwise, computes combined visibility loss L = 1.0 - (R_SAM + visRatio) / 2.
 * 5. If L > 3 * sigma_noise -> "fail" (REJECTED) with measured visibility %, pixel loss, and bounding coordinates.
 * 6. If L <= 3 * sigma_noise -> "pass" (VERIFIED).
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

  const combinedVisibility = (input.rSam + visRatio) / 2;
  const visibilityLoss = 1.0 - combinedVisibility;
  const visibilityPercentage = Math.max(0.0, Math.min(100.0, combinedVisibility * 100));

  // 1. Check gross instrument agreement against empirical cross-instrument delta
  if (instrumentAgreementDelta > delta) {
    return {
      ...baseResult,
      verdict: 'inconclusive',
      reason: `Instrument disagreement (${(instrumentAgreementDelta * 100).toFixed(2)}%) exceeds delta (${(delta * 100).toFixed(2)}%)`,
      visibilityLoss,
      visibilityPercentage,
      instrumentAgreementDelta,
    };
  }

  // 2. Check directional agreement across decision boundary
  const lossA = 1.0 - input.rSam;
  const lossB = 1.0 - visRatio;
  const voteA = lossA > threshold;
  const voteB = lossB > threshold;

  if (voteA !== voteB && instrumentAgreementDelta > 2 * sigma) {
    return {
      ...baseResult,
      verdict: 'inconclusive',
      reason: `Instruments disagree across decision boundary (Instrument A: ${(lossA * 100).toFixed(2)}% loss, Instrument B: ${(lossB * 100).toFixed(2)}% loss; delta ${(instrumentAgreementDelta * 100).toFixed(2)}% > 2*sigma ${(2 * sigma * 100).toFixed(2)}%)`,
      visibilityLoss,
      visibilityPercentage,
      instrumentAgreementDelta,
    };
  }

  // 3. Compare combined visibility loss with 3 * sigma_noise threshold
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
