import { describe, it, expect } from 'vitest';
import {
  getCalibration,
  isCalibrated,
  assertCalibrated,
  UncalibratedError,
  calculateCalibrationFromRepetitions,
} from '../calibration.js';

describe('Calibration & Noise-Floor (Rule 2 enforcement)', () => {
  it('loads initial uncalibrated state with null values', () => {
    const cal = getCalibration();
    expect(cal.sigma_noise).toBeNull();
    expect(cal.delta).toBeNull();
    expect(cal.sample_count).toBe(0);
    expect(isCalibrated(cal)).toBe(false);
  });

  it('refuses to emit verdicts when uncalibrated (throws UncalibratedError)', () => {
    expect(() => assertCalibrated()).toThrowError(UncalibratedError);
    expect(() => assertCalibrated()).toThrowError(/Rule 2/);
  });

  it('calculates sigma_noise and delta = 2 * sigma_noise from repeated measurements', () => {
    // 3 clips, 5 repetitions each with known variations
    const clipScores: Record<string, number[]> = {
      clip_01: [0.95, 0.94, 0.96, 0.95, 0.95], // low variance
      clip_02: [0.8, 0.82, 0.79, 0.81, 0.8], // low variance
      clip_03: [0.9, 0.91, 0.89, 0.9, 0.9], // low variance
    };

    const calibrated = calculateCalibrationFromRepetitions(
      clipScores,
      'test-run-20261026',
      'Test run for noise-floor calibration',
    );

    expect(calibrated.sigma_noise).toBeGreaterThan(0);
    expect(calibrated.delta).toBeCloseTo(2 * (calibrated.sigma_noise ?? 0), 6);
    expect(calibrated.sample_count).toBe(3);
    expect(calibrated.run_id).toBe('test-run-20261026');
    expect(isCalibrated(calibrated)).toBe(true);
    expect(() => assertCalibrated(calibrated)).not.toThrow();
  });
});
