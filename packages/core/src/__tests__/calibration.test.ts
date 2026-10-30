import { describe, it, expect } from 'vitest';
import {
  getCalibration,
  isCalibrated,
  assertCalibrated,
  UncalibratedError,
  calculateCalibrationFromRepetitions,
} from '../calibration.js';

describe('Calibration & Noise-Floor (Rule 2 enforcement)', () => {
  it('loads valid measured calibration data from Spike 1', () => {
    const cal = getCalibration();
    expect(cal.sigma_noise).toBe(0.0045);
    expect(cal.delta).toBe(0.041);
    expect(cal.sample_count).toBe(6);
    expect(isCalibrated(cal)).toBe(true);
    expect(() => assertCalibrated(cal)).not.toThrow();
  });

  it('refuses to emit verdicts when uncalibrated (throws UncalibratedError per Rule 2)', () => {
    const uncalibratedFixture = {
      sigma_noise: null,
      delta: null,
      measured_at: null,
      run_id: null,
      sample_count: 0,
      citation: 'Uncalibrated',
    };
    expect(isCalibrated(uncalibratedFixture)).toBe(false);
    expect(() => assertCalibrated(uncalibratedFixture)).toThrowError(UncalibratedError);
    expect(() => assertCalibrated(uncalibratedFixture)).toThrowError(/Rule 2/);
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

  it('calculates delta = 2 * maxCrossInstrumentResidual (0.041) when maxCrossInstrumentResidual is supplied', () => {
    const clipScores: Record<string, number[]> = {
      clip_01: [0.95, 0.94, 0.96, 0.95, 0.95],
      clip_02: [0.8, 0.82, 0.79, 0.81, 0.8],
      clip_03: [0.9, 0.91, 0.89, 0.9, 0.9],
    };

    const calibrated = calculateCalibrationFromRepetitions(
      clipScores,
      'resp_6ae03ef78bd3db0853c642af',
      'Phase 2 smoke calibration with empirical residual bound',
      0.0205,
    );

    expect(calibrated.sigma_noise).toBeGreaterThan(0);
    expect(calibrated.delta).toBe(0.041);
    expect(isCalibrated(calibrated)).toBe(true);
    expect(() => assertCalibrated(calibrated)).not.toThrow();
  });

  it('rejects NaN, Infinity, negative, zero, and out-of-range values as uncalibrated', () => {
    const invalidValues = [NaN, Infinity, -Infinity, 0, -0.01, 1.5];
    for (const val of invalidValues) {
      const badCal = {
        sigma_noise: val,
        delta: 0.041,
        measured_at: null,
        run_id: null,
        sample_count: 1,
        citation: 'Invalid',
      };
      expect(isCalibrated(badCal)).toBe(false);
      expect(() => assertCalibrated(badCal)).toThrowError(UncalibratedError);
    }
  });
});
