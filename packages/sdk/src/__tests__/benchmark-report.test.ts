import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { RefereeBenchmarkReportSchema, type RefereeBenchmarkReport } from '@spectra/core';
import { runRefereeBenchmark, formatBenchmarkSummary } from '../benchmark-runner.js';

function findProjectRoot(): string {
  let dir = process.cwd();
  while (!fs.existsSync(path.join(dir, 'pnpm-workspace.yaml'))) {
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return dir;
}

describe('@spectra/sdk - 4-Evaluator Referee Benchmark Offline Tests ($0.00 Spend)', () => {
  const root = findProjectRoot();
  const reportPath = path.join(root, 'benchmark/results/referee_benchmark_report.json');

  it('validates referee_benchmark_report.json matches RefereeBenchmarkReportSchema', () => {
    expect(fs.existsSync(reportPath)).toBe(true);
    const rawReport = JSON.parse(fs.readFileSync(reportPath, 'utf-8'));

    const parsed = RefereeBenchmarkReportSchema.safeParse(rawReport);
    expect(parsed.success).toBe(true);

    if (!parsed.success) {
      console.error(parsed.error);
      return;
    }

    const report: RefereeBenchmarkReport = parsed.data;
    expect(report.summary.canonicalV1Clips).toBe(21);
    expect(report.summary.fullClipsAnalyzed).toBe(45);
    expect(report.v1Results.length).toBe(21);
    expect(report.full45Results.length).toBe(45);
  });

  it('verifies empirical accuracy and false-pass rates across all 4 evaluators', () => {
    const rawReport = JSON.parse(fs.readFileSync(reportPath, 'utf-8'));
    const report: RefereeBenchmarkReport = RefereeBenchmarkReportSchema.parse(rawReport);
    const sum = report.summary.evaluatorSummaries;

    // 1. Spectra Referee: 100% detection, 0% false-pass, MAE < 1.35%
    expect(sum.spectra_referee.overallDetectionRate).toBe(1.0);
    expect(sum.spectra_referee.overallFalsePassRate).toBe(0.0);
    expect(sum.spectra_referee.falseAlarmRate).toBe(0.0);
    expect(report.summary.spectraMae).toBeLessThan(0.0135); // 1.11% MAE within 3-sigma noise floor

    // 2. DOM Hit-Test: blind to canvas and mobile, misses edge occlusion in DOM
    expect(sum.dom_hit_test.overallFalsePassRate).toBeGreaterThan(0.9); // 94.4% false-pass
    expect(sum.dom_hit_test.overallDetectionRate).toBeLessThan(0.1); // 5.6% detection

    // 3. VLM Open-Weight (meta-models/muse-spark-open-1026):
    expect(sum.vlm_open_weight.overallFalsePassRate).toBeGreaterThan(0.4); // 44.4% false-pass
    expect(sum.vlm_open_weight.overallDetectionRate).toBeCloseTo(0.556, 2);

    // 4. VLM Flagship (muse-spark-1.3):
    expect(sum.vlm_flagship.overallFalsePassRate).toBeGreaterThan(0.6); // 61.1% false-pass
    expect(sum.vlm_flagship.overallDetectionRate).toBeCloseTo(0.389, 2);
  });

  it('verifies occlusion detection curve properties', () => {
    const rawReport = JSON.parse(fs.readFileSync(reportPath, 'utf-8'));
    const report: RefereeBenchmarkReport = RefereeBenchmarkReportSchema.parse(rawReport);
    const curve = report.summary.occlusionCurve;

    expect(curve.length).toBe(7); // [0.00, 0.05, 0.10, 0.15, 0.25, 0.40, 0.60]

    // 0% Clean Control: 0% false alarms across all evaluators
    const cleanLevel = curve.find((c) => c.occlusionLevel === 0.0)!;
    expect(cleanLevel).toBeDefined();
    expect(cleanLevel.evaluators.spectra_referee.falseAlarmRate).toBe(0.0);
    expect(cleanLevel.evaluators.dom_hit_test.falseAlarmRate).toBe(0.0);

    // 5% Occlusion: DOM and VLMs have 100% false-pass rate; Spectra has 0% false-pass rate
    const occ05 = curve.find((c) => Math.abs(c.occlusionLevel - 0.05) < 0.001)!;
    expect(occ05).toBeDefined();
    expect(occ05.evaluators.dom_hit_test.falsePassRate).toBe(1.0);
    expect(occ05.evaluators.vlm_open_weight.falsePassRate).toBe(1.0);
    expect(occ05.evaluators.vlm_flagship.falsePassRate).toBe(1.0);
    expect(occ05.evaluators.spectra_referee.falsePassRate).toBe(0.0);
    expect(occ05.evaluators.spectra_referee.detectionRate).toBe(1.0);

    // 10% Occlusion ("The Catch"): Flagship VLM and DOM have 100% false-pass; Spectra has 100% detection
    const occ10 = curve.find((c) => Math.abs(c.occlusionLevel - 0.1) < 0.001)!;
    expect(occ10).toBeDefined();
    expect(occ10.evaluators.dom_hit_test.falsePassRate).toBe(1.0);
    expect(occ10.evaluators.vlm_flagship.falsePassRate).toBe(1.0);
    expect(occ10.evaluators.spectra_referee.detectionRate).toBe(1.0);
  });

  it('formats benchmark summary table with expected sections', () => {
    const rawReport = JSON.parse(fs.readFileSync(reportPath, 'utf-8'));
    const report: RefereeBenchmarkReport = RefereeBenchmarkReportSchema.parse(rawReport);
    const formatted = formatBenchmarkSummary(report);

    expect(formatted).toContain('SPECTRA 4-EVALUATOR REFEREE BENCHMARK REPORT');
    expect(formatted).toContain('Occlusion Level');
    expect(formatted).toContain('DOM Hit-Test');
    expect(formatted).toContain('VLM Open-Weight');
    expect(formatted).toContain('VLM Flagship');
    expect(formatted).toContain('Spectra Referee');
    expect(formatted).toContain('Overall Det Rate');
    expect(formatted).toContain('Overall FP Rate');
    expect(formatted).toContain('100.0%');
  });

  it('re-executes runRefereeBenchmark offline with skipLiveCalls ($0.00 spend)', async () => {
    const offlineReport = await runRefereeBenchmark({
      skipLiveCalls: true,
      outputReportPath: path.join(root, 'packages/sdk/src/__tests__/.tmp_benchmark_report.json'),
    });

    expect(offlineReport.summary.canonicalV1Clips).toBe(21);
    expect(offlineReport.summary.evaluatorSummaries.spectra_referee.overallDetectionRate).toBe(1.0);

    // Clean up temporary report
    const tmpPath = path.join(root, 'packages/sdk/src/__tests__/.tmp_benchmark_report.json');
    if (fs.existsSync(tmpPath)) {
      fs.unlinkSync(tmpPath);
    }
  });
});
