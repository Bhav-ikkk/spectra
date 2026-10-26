import { describe, it, expect } from 'vitest';
import { BenchmarkManifest, BenchmarkManifestSchema } from '../schemas/manifest.js';
import { VerdictSchema, MeasurementResultSchema } from '../schemas/verdict.js';

describe('Manifest and Verdict Schemas', () => {
  it('validates a benchmark manifest with clean, edge-case, and adversarial variants', () => {
    const manifest: BenchmarkManifest = {
      version: '1.0',
      generatedAt: '2026-10-26T20:30:00.000Z',
      clips: [
        {
          clipId: 'scenario-01-clean',
          scenario: 'contrast-ratio',
          variant: 'clean',
          expectedVerdicts: {
            samDecode: 'pass',
            vlmBlindSpot: 'pass',
            noiseFloor: 'pass',
            invariantViolation: 'pass',
          },
          sourceParams: { fps: 30, durationSec: 4.5 },
        },
        {
          clipId: 'scenario-01-adversarial',
          scenario: 'contrast-ratio',
          variant: 'adversarial',
          expectedVerdicts: {
            samDecode: 'pass',
            vlmBlindSpot: 'fail',
            noiseFloor: 'fail',
            invariantViolation: 'fail',
          },
          sourceParams: { fps: 30, durationSec: 4.5, perturbation: 'gaussian_noise' },
        },
      ],
    };

    const validated = BenchmarkManifestSchema.parse(manifest);
    expect(validated.clips).toHaveLength(2);
    expect(validated).toEqual(manifest);
  });

  it('validates individual verdicts and measurement results', () => {
    expect(VerdictSchema.parse('pass')).toBe('pass');
    expect(VerdictSchema.parse('fail')).toBe('fail');
    expect(VerdictSchema.parse('inconclusive')).toBe('inconclusive');
    expect(() => VerdictSchema.parse('unknown')).toThrow();

    const measurement = {
      clipId: 'clip-001',
      instrumentA: {
        instrument: 'sam_decode',
        score: 0.98,
        passed: true,
        details: 'Mask coverage 98% matching target element',
      },
      instrumentB: {
        instrument: 'vlm_evaluator',
        score: 0.95,
        passed: true,
        details: 'Visual verification confirmed element alignment',
      },
      combinedVerdict: 'pass',
      confidence: 0.965,
      noiseDelta: 0.03,
      calibrated: true,
    };

    const validated = MeasurementResultSchema.parse(measurement);
    expect(validated.clipId).toBe('clip-001');
    expect(validated.combinedVerdict).toBe('pass');
  });
});
