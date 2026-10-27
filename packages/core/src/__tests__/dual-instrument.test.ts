import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';
import {
  computeSamVisibilityRatio,
  computeTemplateMatchVisibility,
  evaluateDualInstrument,
  getCalibration,
  UncalibratedError,
  ManifestSchema,
  type BenchmarkManifest,
} from '../index.js';

function findProjectRoot(): string {
  let dir = process.cwd();
  while (!fs.existsSync(path.join(dir, 'pnpm-workspace.yaml'))) {
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return dir;
}

describe('Dual-Instrument Measurement Engine (Offline $0.00 Spend)', () => {
  const root = findProjectRoot();
  const manifestPath = path.join(root, 'benchmark/manifest.json');
  const manifestRaw = fs.readFileSync(manifestPath, 'utf-8');
  const manifest: BenchmarkManifest = ManifestSchema.parse(JSON.parse(manifestRaw));

  describe('Instrument A: computeSamVisibilityRatio', () => {
    it('computes exact SAM visibility ratio and estimated occlusion from area counts', () => {
      const res = computeSamVisibilityRatio(2500, 2000);
      expect(res.rSam).toBe(0.8);
      expect(res.estimatedOcclusion).toBeCloseTo(0.2, 5);
      expect(res.baselineArea).toBe(2500);
      expect(res.evalArea).toBe(2000);
    });

    it('caps ratio at 1.0 when evaluation area exceeds baseline', () => {
      const res = computeSamVisibilityRatio(2000, 2500);
      expect(res.rSam).toBe(1.0);
      expect(res.estimatedOcclusion).toBe(0.0);
    });

    it('computes ratio from binary mask arrays', () => {
      const maskT0 = new Uint8Array([1, 1, 1, 1, 0, 0]);
      const maskTk = new Uint8Array([1, 1, 0, 0, 0, 0]);
      const res = computeSamVisibilityRatio(maskT0, maskTk);
      expect(res.rSam).toBe(0.5);
      expect(res.estimatedOcclusion).toBe(0.5);
    });

    it('throws when baseline area is zero', () => {
      expect(() => computeSamVisibilityRatio(0, 100)).toThrow('greater than zero');
    });
  });

  describe('Instrument B: computeTemplateMatchVisibility across all 45 clips', () => {
    it(`verifies all ${manifest.clips.length} benchmark clips match ground truth occlusion within ±0.01`, () => {
      expect(manifest.clips.length).toBe(45);

      for (const clip of manifest.clips) {
        const t0Path = path.join(root, clip.t0FramePath!);
        const tkPath = path.join(root, clip.tkFramePath!);

        expect(fs.existsSync(t0Path)).toBe(true);
        expect(fs.existsSync(tkPath)).toBe(true);

        const result = computeTemplateMatchVisibility(t0Path, tkPath, clip.targetBBox!);

        // Conservation of pixels
        expect(result.pixelLossCount + result.unchangedPixelCount).toBe(result.totalPixels);

        // Measured pixel visibility loss = 1.0 - pixelVisibilityRatio
        const measuredLoss = result.measuredLoss;
        const groundTruth = clip.groundTruthOcclusion!;

        const lossDiff = Math.abs(measuredLoss - groundTruth);
        expect(
          lossDiff,
          `Clip ${clip.clipId} measured loss ${measuredLoss.toFixed(4)} vs GT ${groundTruth.toFixed(4)} (diff: ${lossDiff.toFixed(4)})`,
        ).toBeLessThanOrEqual(0.01);

        // For clean control clips (GT = 0.0), pixelVisibilityRatio must be 1.0 and rNcc must be 1.0
        if (groundTruth === 0.0) {
          expect(result.pixelVisibilityRatio).toBe(1.0);
          expect(result.rNcc).toBeCloseTo(1.0, 4);
        }
      }
    });
  });

  describe('Dual-Instrument Referee: evaluateDualInstrument', () => {
    const cal = getCalibration();

    it('refuses to emit verdicts when uncalibrated (enforcing Rule 2)', () => {
      const uncalibrated = {
        sigma_noise: null,
        delta: null,
        measured_at: null,
        run_id: null,
        sample_count: 0,
        citation: 'Uncalibrated',
      };
      expect(() =>
        evaluateDualInstrument({
          rSam: 1.0,
          rNcc: 1.0,
          calibration: uncalibrated,
        }),
      ).toThrow(UncalibratedError);
    });

    it('returns "inconclusive" when instrument disagreement exceeds delta', () => {
      // delta = 0.0886. Difference |0.95 - 0.70| = 0.25 > 0.0886
      const verdict = evaluateDualInstrument({
        rSam: 0.95,
        rNcc: 0.7,
        calibration: cal,
      });

      expect(verdict.verdict).toBe('inconclusive');
      expect(verdict.reason).toContain('Instrument disagreement');
      expect(verdict.instrumentAgreementDelta).toBeCloseTo(0.25, 4);
      expect(verdict.disagreementThreshold).toBe(cal.delta);
    });

    it('returns "pass" (VERIFIED) on clean 0% occlusion (loss <= 3 * sigma_noise)', () => {
      // 3 * 0.0443 = 0.1329. Loss 0.0 <= 0.1329
      const verdict = evaluateDualInstrument({
        clipId: 'canvas_000_v1',
        rSam: 1.0,
        rNcc: 1.0,
        targetBBox: { x: 820, y: 240, width: 220, height: 48 },
        pixelLossCount: 0,
        totalPixels: 10560,
        calibration: cal,
      });

      expect(verdict.verdict).toBe('pass');
      expect(verdict.visibilityPercentage).toBe(100.0);
      expect(verdict.reason).toContain('VERIFIED');
    });

    it('verifies true sigma_noise = 0.0045 and threshold = 0.0135 (1.35%)', () => {
      const verdict = evaluateDualInstrument({
        rSam: 1.0,
        rNcc: 1.0,
        calibration: cal,
      });

      expect(verdict.calibration.sigma_noise).toBe(0.0045);
      expect(verdict.calibration.delta).toBe(0.041);
      expect(verdict.threshold).toBeCloseTo(0.0135, 4);
      expect(verdict.disagreementThreshold).toBe(0.041);
    });

    it('returns "inconclusive" on decision boundary disagreement (one votes pass, one votes fail, gap > 2*sigma)', () => {
      // Instrument A: 0.5% loss (rSam = 0.995 <= threshold 1.35% -> PASS)
      // Instrument B: 2.5% loss (visRatio = 0.975 > threshold 1.35% -> FAIL)
      // Gap: |0.995 - 0.975| = 0.020 > 2 * 0.0045 (0.0090)
      const verdict = evaluateDualInstrument({
        rSam: 0.995,
        visRatio: 0.975,
        rNcc: 0.975,
        calibration: cal,
      });

      expect(verdict.verdict).toBe('inconclusive');
      expect(verdict.reason).toContain('Instruments disagree across decision boundary');
      expect(verdict.instrumentAgreementDelta).toBeCloseTo(0.02, 4);
    });

    it('returns "fail" (REJECTED) on high-occlusion agreement (SAM 58% loss, Pixel 60% loss)', () => {
      // Instrument A: 58% loss (rSam = 0.42)
      // Instrument B: 60% loss (visRatio = 0.40)
      // Residual: |0.42 - 0.40| = 0.020 <= delta (0.041)
      const verdict = evaluateDualInstrument({
        clipId: 'high_occlusion_test',
        rSam: 0.42,
        visRatio: 0.4,
        rNcc: 0.25,
        targetBBox: { x: 100, y: 100, width: 200, height: 50 },
        pixelLossCount: 6000,
        totalPixels: 10000,
        calibration: cal,
      });

      expect(verdict.verdict).toBe('fail');
      expect(verdict.reason).toContain('REJECTED');
      expect(verdict.visibilityLoss).toBeCloseTo(0.59, 2);
      expect(verdict.instrumentAgreementDelta).toBeCloseTo(0.02, 4);
    });

    it('returns "fail" (REJECTED) when visibility loss exceeds 3 * sigma_noise', () => {
      // At 15% occlusion (loss = 0.15 > 0.0135)
      const verdict = evaluateDualInstrument({
        clipId: 'mobile_mp4_015_v1',
        rSam: 0.85,
        rNcc: 0.85,
        targetBBox: { x: 475, y: 610, width: 330, height: 52 },
        pixelLossCount: 2574,
        totalPixels: 17160,
        calibration: cal,
      });

      expect(verdict.verdict).toBe('fail');
      expect(verdict.reason).toContain('REJECTED');
      expect(verdict.reason).toContain('[x=475, y=610, w=330, h=52]');
      expect(verdict.reason).toContain('2574/17160 px loss');
      expect(verdict.visibilityLoss).toBeCloseTo(0.15, 4);
    });
  });
});
