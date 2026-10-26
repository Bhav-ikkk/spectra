import { CalibrationData, CalibrationDataSchema } from './schemas/verdict.js';
import defaultCalibration from './calibration.json' with { type: 'json' };

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
 * Method per .agent/skills/calibrating-noise-floor.md:
 * - Run measurements on at least 10 clips, 5 repetitions each.
 * - Compute per-clip standard deviation of the metric.
 * - sigma_noise = median of per-clip standard deviations.
 * - delta = 2 * sigma_noise (differences below this are within noise floor).
 */
export function calculateCalibrationFromRepetitions(
  clipScores: Record<string, number[]>,
  runId: string,
  citation: string,
): CalibrationData {
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
  const delta = 2 * sigma_noise;

  return CalibrationDataSchema.parse({
    sigma_noise,
    delta,
    measured_at: new Date().toISOString(),
    run_id: runId,
    sample_count: stdDevs.length,
    citation,
  });
}
