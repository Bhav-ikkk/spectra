import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { runClosedLoopReferee, runAllClosedLoopScenarios } from '../closed-loop.js';

function findProjectRoot(): string {
  let dir = process.cwd();
  while (!fs.existsSync(path.join(dir, 'pnpm-workspace.yaml'))) {
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return dir;
}

describe('@spectra/sdk - Closed-Loop Scenarios (S1, S2, S3) Offline Tests ($0.00 Spend)', () => {
  const root = findProjectRoot();
  const s1Dir = path.join(root, 'benchmark/responses/closed-loop-s1');
  const s2Dir = path.join(root, 'benchmark/responses/closed-loop-s2');
  const s3Dir = path.join(root, 'benchmark/responses/closed-loop-s3');

  describe('Scenario S1: HTML5 Canvas Chart Collision', () => {
    it('validates that all 4 S1 artifacts exist and are populated', () => {
      const pass1Path = path.join(s1Dir, 'pass1_verdict.json');
      const patchPath = path.join(s1Dir, 'agent_repair_patch.json');
      const pass2Path = path.join(s1Dir, 'pass2_verdict.json');
      const summaryPath = path.join(s1Dir, 'closed_loop_summary.json');

      expect(fs.existsSync(pass1Path)).toBe(true);
      expect(fs.existsSync(patchPath)).toBe(true);
      expect(fs.existsSync(pass2Path)).toBe(true);
      expect(fs.existsSync(summaryPath)).toBe(true);

      const summary = JSON.parse(fs.readFileSync(summaryPath, 'utf-8'));
      expect(summary.scenarioId).toBe('S1-canvas-chart-collision');
      expect(summary.environment).toBe('canvas');
      expect(summary.pass1Verdict).toBe('fail');
      expect(summary.pass2Verdict).toBe('pass');
      expect(summary.closedLoopSuccess).toBe(true);
      expect(summary.naiveBaseline.strategy).toBe('playwright_dom_node_count');
    });

    it('verifies Pass #1 catches 15% canvas collision where DOM locators false-pass', () => {
      const pass1 = JSON.parse(fs.readFileSync(path.join(s1Dir, 'pass1_verdict.json'), 'utf-8'));
      expect(pass1.clipId).toBe('canvas_015_v1');
      expect(pass1.combinedVerdict).toBe('fail');
      expect(pass1.instrumentA.passed).toBe(false);
      expect(pass1.instrumentB.passed).toBe(false);
      expect(pass1.instrumentB.score).toBe(0.85); // 15% visibility loss
    });

    it('verifies S1 repair patch eliminates canvas tooltip overlap', () => {
      const patch = JSON.parse(
        fs.readFileSync(path.join(s1Dir, 'agent_repair_patch.json'), 'utf-8'),
      );
      expect(patch.model).toBe('meta-models/muse-spark-open-1026');
      expect(patch.newOverlapPx).toBe(0);
      expect(patch.patch || patch.codePatch).toContain('660');
    });

    it('replays runClosedLoopReferee({ scenario: "s1" }) offline', async () => {
      const res = await runClosedLoopReferee({ scenario: 's1' });
      expect(res.success).toBe(true);
      expect(res.scenarioId).toBe('S1-canvas-chart-collision');
      expect(res.pass1.combinedVerdict).toBe('fail');
      expect(res.pass2.combinedVerdict).toBe('pass');
    });
  });

  describe('Scenario S2: Mobile Promo Bottom-Sheet Overlap (Raw MP4, No DOM)', () => {
    it('validates that all 4 S2 artifacts exist and are populated', () => {
      const pass1Path = path.join(s2Dir, 'pass1_verdict.json');
      const patchPath = path.join(s2Dir, 'agent_repair_patch.json');
      const pass2Path = path.join(s2Dir, 'pass2_verdict.json');
      const summaryPath = path.join(s2Dir, 'closed_loop_summary.json');

      expect(fs.existsSync(pass1Path)).toBe(true);
      expect(fs.existsSync(patchPath)).toBe(true);
      expect(fs.existsSync(pass2Path)).toBe(true);
      expect(fs.existsSync(summaryPath)).toBe(true);

      const summary = JSON.parse(fs.readFileSync(summaryPath, 'utf-8'));
      expect(summary.scenarioId).toBe('S2-mobile-bottom-sheet-snap');
      expect(summary.environment).toBe('mobile_mp4');
      expect(summary.pass1Verdict).toBe('fail');
      expect(summary.pass2Verdict).toBe('pass');
      expect(summary.closedLoopSuccess).toBe(true);
      expect(summary.naiveBaseline.strategy).toBe('raw_video_stream_no_dom');
    });

    it('verifies Pass #1 catches 15% bottom-sheet occlusion on Pay button', () => {
      const pass1 = JSON.parse(fs.readFileSync(path.join(s2Dir, 'pass1_verdict.json'), 'utf-8'));
      expect(pass1.clipId).toBe('mobile_mp4_015_v1');
      expect(pass1.combinedVerdict).toBe('fail');
      expect(pass1.instrumentA.passed).toBe(false);
      expect(pass1.instrumentB.passed).toBe(false);
      expect(pass1.instrumentB.score).toBe(0.85); // 15% visibility loss
    });

    it('verifies S2 repair patch adjusts snap points from 65% to 50%', () => {
      const patch = JSON.parse(
        fs.readFileSync(path.join(s2Dir, 'agent_repair_patch.json'), 'utf-8'),
      );
      expect(patch.model).toBe('meta-models/muse-spark-open-1026');
      expect(patch.newOverlapPx).toBe(0);
      expect(patch.patch || patch.codePatch).toContain('50%');
    });

    it('replays runClosedLoopReferee({ scenario: "s2" }) offline', async () => {
      const res = await runClosedLoopReferee({ scenario: 's2' });
      expect(res.success).toBe(true);
      expect(res.scenarioId).toBe('S2-mobile-bottom-sheet-snap');
      expect(res.pass1.combinedVerdict).toBe('fail');
      expect(res.pass2.combinedVerdict).toBe('pass');
    });
  });

  describe('Scenario S3: Sticky Cart Drawer Edge Occlusion ("The Catch")', () => {
    it('validates that all 4 S3 artifacts exist and are populated', () => {
      const pass1Path = path.join(s3Dir, 'pass1_verdict.json');
      const patchPath = path.join(s3Dir, 'agent_repair_patch.json');
      const pass2Path = path.join(s3Dir, 'pass2_verdict.json');
      const summaryPath = path.join(s3Dir, 'closed_loop_summary.json');

      expect(fs.existsSync(pass1Path)).toBe(true);
      expect(fs.existsSync(patchPath)).toBe(true);
      expect(fs.existsSync(pass2Path)).toBe(true);
      expect(fs.existsSync(summaryPath)).toBe(true);

      const summary = JSON.parse(fs.readFileSync(summaryPath, 'utf-8'));
      expect(summary.scenarioId).toBe('S3-the-catch');
      expect(summary.pass1Verdict).toBe('fail');
      expect(summary.pass2Verdict).toBe('pass');
      expect(summary.closedLoopSuccess).toBe(true);
    });

    it('verifies Pass #1 rejection telemetry matches "The Catch" (10% occlusion)', () => {
      const pass1 = JSON.parse(fs.readFileSync(path.join(s3Dir, 'pass1_verdict.json'), 'utf-8'));
      expect(pass1.clipId).toBe('dom_catch_010_v1');
      expect(pass1.combinedVerdict).toBe('fail');
      expect(pass1.instrumentA.passed).toBe(false);
      expect(pass1.instrumentB.passed).toBe(false);
      expect(pass1.instrumentA.score).toBeCloseTo(0.908, 2);
      expect(pass1.instrumentB.score).toBe(0.9);
      expect(pass1.instrumentB.raw.pixelLossCount).toBe(1700);
      expect(pass1.instrumentB.raw.totalPixels).toBe(17000);
    });

    it('verifies Agent Repair Patch synthesized for S3', () => {
      const patch = JSON.parse(
        fs.readFileSync(path.join(s3Dir, 'agent_repair_patch.json'), 'utf-8'),
      );
      expect(patch.model).toBe('meta-models/muse-spark-open-1026');
      expect(patch.newFooterOverlapPx).toBe(0);
      expect(patch.cssPatch || patch.patch).toContain('.cart-drawer-footer');
    });

    it('replays runClosedLoopReferee({ scenario: "s3" }) offline', async () => {
      const res = await runClosedLoopReferee({ scenario: 's3' });
      expect(res.success).toBe(true);
      expect(res.scenarioId).toBe('S3-the-catch');
      expect(res.pass1.combinedVerdict).toBe('fail');
      expect(res.pass2.combinedVerdict).toBe('pass');
    });
  });

  describe('Multi-Scenario Execution (runAllClosedLoopScenarios)', () => {
    it('executes all 3 scenarios (S1, S2, S3) in a single run', async () => {
      const all = await runAllClosedLoopScenarios();
      expect(all.s1.success).toBe(true);
      expect(all.s2.success).toBe(true);
      expect(all.s3.success).toBe(true);

      expect(all.s1.scenarioId).toBe('S1-canvas-chart-collision');
      expect(all.s2.scenarioId).toBe('S2-mobile-bottom-sheet-snap');
      expect(all.s3.scenarioId).toBe('S3-the-catch');
    });

    it('runClosedLoopReferee({ scenario: "all" }) returns composite result with allScenarios', async () => {
      const result = await runClosedLoopReferee({ scenario: 'all' });
      expect(result.success).toBe(true);
      expect(result.allScenarios).toBeDefined();
      expect(result.allScenarios?.s1.success).toBe(true);
      expect(result.allScenarios?.s2.success).toBe(true);
      expect(result.allScenarios?.s3.success).toBe(true);
    });
  });
});
