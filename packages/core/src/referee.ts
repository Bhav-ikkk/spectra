import { getCalibration, assertCalibrated } from './calibration.js';
import type {
  CalibrationData,
  Verdict,
  RefereeDecisionExplanation,
} from './schemas/verdict.js';
import type { BoundingBox } from './schemas/manifest.js';

export type { RefereeDecisionExplanation };

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
  decisionExplanation?: RefereeDecisionExplanation;
}

/**
 * Dual-Instrument Referee Verdict Engine (Blueprint Pillar 1)
 *
 * 1. Calls assertCalibrated() first (enforces Rule 2).
 * 2. Checks finite range bounds on measurements ([0, 1]).
 * 3. Checks gross instrument agreement: if |R_SAM - visRatio| > delta -> "inconclusive".
 * 4. Checks directional agreement across decision boundary:
 *    If one instrument measures loss > threshold and the other measures loss <= threshold
 *    with |R_SAM - visRatio| > 2 * sigma_noise -> "inconclusive" ("Instruments disagree across decision boundary").
 * 5. Otherwise, computes combined visibility loss L = 1.0 - (R_SAM + visRatio) / 2.
 * 6. If L > 3 * sigma_noise -> "fail" (REJECTED) with measured visibility %, pixel loss, and bounding coordinates.
 * 7. If L <= 3 * sigma_noise -> "pass" (VERIFIED).
 */
export function evaluateDualInstrument(input: DualInstrumentInput): DualInstrumentVerdict {
  const cal = input.calibration ?? getCalibration();
  assertCalibrated(cal);

  const visRatio = input.visRatio !== undefined ? input.visRatio : input.rNcc;

  if (
    !Number.isFinite(input.rSam) ||
    !Number.isFinite(visRatio) ||
    input.rSam < 0 ||
    input.rSam > 1 ||
    visRatio < 0 ||
    visRatio > 1
  ) {
    throw new Error(
      'Invalid instrument measurement: rSam and visRatio must be finite numbers in [0, 1]',
    );
  }

  const sigma = cal.sigma_noise!;
  const delta = cal.delta!;
  const threshold = 3 * sigma;

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

  const lossA = 1.0 - input.rSam;
  const lossB = 1.0 - visRatio;
  const voteA = lossA > threshold;
  const voteB = lossB > threshold;

  const combinedVisibility = (input.rSam + visRatio) / 2;
  const visibilityLoss = 1.0 - combinedVisibility;
  const visibilityPercentage = Math.max(0.0, Math.min(100.0, combinedVisibility * 100));

  const buildDecisionExplanation = (
    ruleFired: RefereeDecisionExplanation['ruleFired'],
    formulaSummary: string,
  ): RefereeDecisionExplanation => ({
    ruleFired,
    instrumentAVote: voteA ? 'fail' : 'pass',
    instrumentBVote: voteB ? 'fail' : 'pass',
    instrumentALoss: lossA,
    instrumentBLoss: lossB,
    combinedLoss: visibilityLoss,
    threeSigmaThreshold: threshold,
    marginToThreshold: visibilityLoss - threshold,
    observedDelta: instrumentAgreementDelta,
    deltaLimit: delta,
    deltaMargin: delta - instrumentAgreementDelta,
    formulaSummary,
  });

  // 1. Check gross instrument agreement against empirical cross-instrument delta
  if (instrumentAgreementDelta > delta) {
    return {
      ...baseResult,
      verdict: 'inconclusive',
      reason: `Instrument disagreement (${(instrumentAgreementDelta * 100).toFixed(2)}%) exceeds delta (${(delta * 100).toFixed(2)}%)`,
      visibilityLoss,
      visibilityPercentage,
      instrumentAgreementDelta,
      decisionExplanation: buildDecisionExplanation(
        'RULE_1_GROSS_DELTA_INCONCLUSIVE',
        `Gross instrument residual |rSam - visRatio| = ${(instrumentAgreementDelta * 100).toFixed(2)}% exceeds delta limit ${(delta * 100).toFixed(2)}%`,
      ),
    };
  }

  // 2. Check directional agreement across decision boundary
  if (voteA !== voteB && instrumentAgreementDelta > 2 * sigma) {
    return {
      ...baseResult,
      verdict: 'inconclusive',
      reason: `Instruments disagree across decision boundary (Instrument A: ${(lossA * 100).toFixed(2)}% loss, Instrument B: ${(lossB * 100).toFixed(2)}% loss; delta ${(instrumentAgreementDelta * 100).toFixed(2)}% > 2*sigma ${(2 * sigma * 100).toFixed(2)}%)`,
      visibilityLoss,
      visibilityPercentage,
      instrumentAgreementDelta,
      decisionExplanation: buildDecisionExplanation(
        'RULE_2_BOUNDARY_SPLIT_INCONCLUSIVE',
        `Instruments split across 3σ boundary (lossA=${(lossA * 100).toFixed(2)}%, lossB=${(lossB * 100).toFixed(2)}%) and residual ${(instrumentAgreementDelta * 100).toFixed(2)}% exceeds 2σ ${(2 * sigma * 100).toFixed(2)}%`,
      ),
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
      decisionExplanation: buildDecisionExplanation(
        'RULE_3_THREE_SIGMA_OCCLUSION_REJECT',
        `Combined visibility loss ${(visibilityLoss * 100).toFixed(2)}% exceeds 3σ noise floor ${(threshold * 100).toFixed(2)}% by +${((visibilityLoss - threshold) * 100).toFixed(2)}%`,
      ),
    };
  }

  return {
    ...baseResult,
    verdict: 'pass',
    reason: `VERIFIED: Visibility ${visibilityPercentage.toFixed(2)}% within noise tolerance (${(threshold * 100).toFixed(2)}%)`,
    visibilityLoss,
    visibilityPercentage,
    instrumentAgreementDelta,
    decisionExplanation: buildDecisionExplanation(
      'RULE_4_THREE_SIGMA_CLEAN_PASS',
      `Combined visibility loss ${(visibilityLoss * 100).toFixed(2)}% within 3σ noise floor ${(threshold * 100).toFixed(2)}% (margin: ${((threshold - visibilityLoss) * 100).toFixed(2)}%)`,
    ),
  };
}
