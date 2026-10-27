import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { runClosedLoopReferee } from '../closed-loop.js';

function findProjectRoot(): string {
  let dir = process.cwd();
  while (!fs.existsSync(path.join(dir, 'pnpm-workspace.yaml'))) {
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return dir;
}

describe('@spectra/sdk - Closed-Loop Scenario S3 ("The Catch") Unit Tests ($0.00 Spend)', () => {
  const root = findProjectRoot();
  const closedLoopDir = path.join(root, 'benchmark/responses/closed-loop-s3');

  it('validates that all 4 closed-loop artifacts exist and are populated', () => {
    const pass1Path = path.join(closedLoopDir, 'pass1_verdict.json');
    const patchPath = path.join(closedLoopDir, 'agent_repair_patch.json');
    const pass2Path = path.join(closedLoopDir, 'pass2_verdict.json');
    const summaryPath = path.join(closedLoopDir, 'closed_loop_summary.json');

    expect(fs.existsSync(pass1Path)).toBe(true);
    expect(fs.existsSync(patchPath)).toBe(true);
    expect(fs.existsSync(pass2Path)).toBe(true);
    expect(fs.existsSync(summaryPath)).toBe(true);

    const summary = JSON.parse(fs.readFileSync(summaryPath, 'utf-8'));
    expect(summary.scenarioId).toBe('S3-the-catch');
    expect(summary.pass1Verdict).toBe('fail');
    expect(summary.pass2Verdict).toBe('pass');
    expect(summary.closedLoopSuccess).toBe(true);
    expect(summary.newFooterOverlapPx).toBe(0);
  });

  it('verifies Pass #1 rejection telemetry matches "The Catch" (10% occlusion)', () => {
    const pass1Path = path.join(closedLoopDir, 'pass1_verdict.json');
    const pass1 = JSON.parse(fs.readFileSync(pass1Path, 'utf-8'));

    expect(pass1.clipId).toBe('dom_catch_010_v1');
    expect(pass1.combinedVerdict).toBe('fail');
    expect(pass1.instrumentA.passed).toBe(false);
    expect(pass1.instrumentB.passed).toBe(false);

    // Instrument A: SAM 3.1 measured ~9.2% loss
    expect(pass1.instrumentA.score).toBeCloseTo(0.908, 2);
    // Instrument B: Deterministic template matching measured exactly 10.0% loss (1,700 / 17,000 px)
    expect(pass1.instrumentB.score).toBe(0.9);
    expect(pass1.instrumentB.raw.pixelLossCount).toBe(1700);
    expect(pass1.instrumentB.raw.totalPixels).toBe(17000);
    expect(pass1.notes).toContain('REJECTED');
  });

  it('verifies Agent Repair Patch synthesized by open-weight muse-spark-open-1026', () => {
    const patchPath = path.join(closedLoopDir, 'agent_repair_patch.json');
    const patch = JSON.parse(fs.readFileSync(patchPath, 'utf-8'));

    expect(patch.model).toBe('meta-models/muse-spark-open-1026');
    expect(patch.newFooterOverlapPx).toBe(0);
    expect(patch.cssPatch).toContain('.cart-drawer-footer');
    expect(patch.cssPatch).toContain('margin-top: 0px');
    expect(patch.explanation).toBeTruthy();
  });

  it('verifies Pass #2 re-verification proves 100% visibility after repair', () => {
    const pass2Path = path.join(closedLoopDir, 'pass2_verdict.json');
    const pass2 = JSON.parse(fs.readFileSync(pass2Path, 'utf-8'));

    expect(pass2.clipId).toBe('dom_catch_000_v1');
    expect(pass2.combinedVerdict).toBe('pass');
    expect(pass2.instrumentA.passed).toBe(true);
    expect(pass2.instrumentB.passed).toBe(true);
    expect(pass2.instrumentA.score).toBe(1.0);
    expect(pass2.instrumentB.score).toBe(1.0);
    expect(pass2.instrumentB.raw.pixelLossCount).toBe(0);
  });

  it('replays runClosedLoopReferee offline and validates Reject -> Patch -> Re-Verify telemetry', async () => {
    const result = await runClosedLoopReferee({
      cachedDir: closedLoopDir,
    });

    expect(result.success).toBe(true);
    expect(result.scenarioId).toBe('S3-the-catch');

    // Traditional hit-test missed the edge defect
    expect(result.naiveBaseline.strategy).toBe('center_pixel_hit_test');
    expect(result.naiveBaseline.centerPixelCovered).toBe(false);
    expect(result.naiveBaseline.verdict).toBe('pass');

    // Pass #1 caught by Spectra
    expect(result.pass1.combinedVerdict).toBe('fail');
    expect(result.summary.pass1LossPct).toBe(9.6);

    // Agent repair applied
    expect(result.repair.newFooterOverlapPx).toBe(0);
    expect(result.summary.repairPatchApplied).toBe(true);

    // Pass #2 verified by Spectra
    expect(result.pass2.combinedVerdict).toBe('pass');
    expect(result.summary.pass2LossPct).toBe(0.0);
  });
});
