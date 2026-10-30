import { describe, it, expect, vi } from 'vitest';
import * as core from '@spectra/core';
import { runRefereeBenchmark } from '../benchmark-runner.js';

describe('@spectra/sdk - Benchmark Runner Rule 2 Calibration Guardrails', () => {
  it('throws UncalibratedError when calibration has null sigma_noise or delta via options', async () => {
    const uncalibrated = {
      sigma_noise: null,
      delta: null,
      measured_at: null,
      run_id: null,
      sample_count: 0,
      citation: 'Uncalibrated test stub',
    };

    await expect(
      runRefereeBenchmark({ calibration: uncalibrated }),
    ).rejects.toThrowError(core.UncalibratedError);
    await expect(
      runRefereeBenchmark({ calibration: uncalibrated }),
    ).rejects.toThrowError(/Rule 2/);
  });

  it('throws UncalibratedError when getCalibration() returns uncalibrated data', async () => {
    const spy = vi.spyOn(core, 'getCalibration').mockReturnValue({
      sigma_noise: null,
      delta: null,
      measured_at: null,
      run_id: null,
      sample_count: 0,
      citation: 'Uncalibrated mock',
    });

    try {
      await expect(runRefereeBenchmark()).rejects.toThrowError(core.UncalibratedError);
      await expect(runRefereeBenchmark()).rejects.toThrowError(/Rule 2/);
    } finally {
      spy.mockRestore();
    }
  });

  it('throws UncalibratedError when sigma_noise is negative', async () => {
    const invalidCal = {
      sigma_noise: -0.01,
      delta: 0.04,
      measured_at: null,
      run_id: null,
      sample_count: 1,
      citation: 'Invalid sigma',
    };

    await expect(
      runRefereeBenchmark({ calibration: invalidCal }),
    ).rejects.toThrowError(core.UncalibratedError);
  });
});

