import { CalibrationData, CalibrationDataSchema } from './schemas/verdict.js';
import defaultCalibration from './calibration.json' with { type: 'json' };

/**
 * Calibration data contract representing measured noise floor and disagreement thresholds.
 *
 * In canonical calibration (calibration.json):
 * - `sigma_noise = 0.0045` (0.45%) is the measured relative standard deviation of SAM 3.1
 *   mask area across the 6 clean post-settlement frames (t_2..t_7) of canvas_000_v1
 *   (live run resp_6ae03ef78bd3db0853c642af on 2026-10-27).
 * - `delta = 0.041` (4.10%) is the empirical cross-instrument agreement bound set to
 *   `2 × max(|rSam - visRatio|)` (2 × 0.0205 = 0.041) observed across the 4 Phase-2
 *   live smoke calibration runs (canvas_000_v1, canvas_015_v1, mobile_mp4_015_v1,
 *   dom_catch_010_v1), whereas calculateCalibrationFromRepetitions provides a
 *   2 * sigma_noise lower-bound default when cross-instrument residuals are not supplied.
 */
export type { CalibrationData };

export class UncalibratedError extends Error {
  constructor(
    message = 'Noise-floor values (sigma_noise, delta) are null. Refusing to emit verdicts per Rule 2.',
  ) {
    super(message);
    this.name = 'UncalibratedError';
  }
}

/**
 * Loads current calibration data and validates it against schema.
 */
export function getCalibration(): CalibrationData {
  return CalibrationDataSchema.parse(defaultCalibration);
}

/**
 * Checks whether current calibration has valid measured sigma_noise and delta values.
 */
export function isCalibrated(cal: CalibrationData = getCalibration()): boolean {
  return cal.sigma_noise !== null && cal.delta !== null && cal.sigma_noise >= 0 && cal.delta >= 0;
}

/**
 * Asserts that calibration is active. If null, throws UncalibratedError per Rule 2.
 */
export function assertCalibrated(
  cal: CalibrationData = getCalibration(),
): asserts cal is CalibrationData & {
  sigma_noise: number;
  delta: number;
} {
  if (!isCalibrated(cal)) {
    throw new UncalibratedError();
  }
}

/**
 * Computes sigma_noise and delta from repeated clip measurements.
 *
 * In calibration.json:
 * - `sigma_noise = 0.0045` (0.45%) is the measured relative standard deviation of SAM 3.1
 *   mask area across the 6 clean post-settlement frames (t_2..t_7) of canvas_000_v1
 *   (live run resp_6ae03ef78bd3db0853c642af on 2026-10-27).
 * - `delta = 0.041` (4.10%) is the empirical cross-instrument agreement bound set to
 *   `2 × max(|rSam - visRatio|)` (2 × 0.0205 = 0.041) observed across the 4 Phase-2
 *   live smoke calibration runs (canvas_000_v1, canvas_015_v1, mobile_mp4_015_v1,
 *   dom_catch_010_v1), whereas calculateCalibrationFromRepetitions provides a
 *   2 * sigma_noise lower-bound default when cross-instrument residuals are not supplied.
 *
 * Method per .agent/skills/calibrating-noise-floor.md:
 * - Run measurements on at least 10 clips, 5 repetitions each.
 * - Compute per-clip standard deviation of the metric.
 * - sigma_noise = median of per-clip standard deviations.
 * - delta = when maxCrossInstrumentResidual is provided, Number((2 * maxCrossInstrumentResidual).toFixed(6));
 *   otherwise falls back to 2 * sigma_noise (lower-bound default).
 *
 * @param clipScores - Record mapping clip ID to array of repeated measurement scores
 * @param runId - Unique measurement run ID or citation identifier
 * @param citationOrResidual - Citation string, or maxCrossInstrumentResidual number
 * @param maxCrossInstrumentResidual - Optional maximum empirical cross-instrument residual (|rSam - visRatio|);
 *   when provided, delta is computed as 2 * maxCrossInstrumentResidual.
 */
export function calculateCalibrationFromRepetitions(
  clipScores: Record<string, number[]>,
  runId: string,
  citationOrResidual?: string | number,
  maxCrossInstrumentResidual?: number,
): CalibrationData {
  let citation =
    typeof citationOrResidual === 'string'
      ? citationOrResidual
      : `Calibrated from run ${runId}`;
  let residual =
    typeof citationOrResidual === 'number'
      ? citationOrResidual
      : maxCrossInstrumentResidual;

  const clipIds = Object.keys(clipScores);
  if (clipIds.length === 0) {
    throw new Error('Cannot compute calibration: no clip data provided.');
  }

  const stdDevs: number[] = [];

  for (const clipId of clipIds) {
    const scores = clipScores[clipId];
    if (scores.length < 2) {
      continue;
    }
    const mean = scores.reduce((sum, s) => sum + s, 0) / scores.length;
    const variance =
      scores.reduce((sum, s) => sum + Math.pow(s - mean, 2), 0) / (scores.length - 1);
    stdDevs.push(Math.sqrt(variance));
  }

  if (stdDevs.length === 0) {
    throw new Error('Cannot compute calibration: insufficient repetitions per clip.');
  }

  stdDevs.sort((a, b) => a - b);
  const mid = Math.floor(stdDevs.length / 2);
  const sigma_noise =
    stdDevs.length % 2 !== 0 ? stdDevs[mid] : (stdDevs[mid - 1] + stdDevs[mid]) / 2;
  const delta =
    residual !== undefined
      ? Number((2 * residual).toFixed(6))
      : 2 * sigma_noise;

  return CalibrationDataSchema.parse({
    sigma_noise,
    delta,
    measured_at: new Date().toISOString(),
    run_id: runId,
    sample_count: stdDevs.length,
    citation,
  });
}
