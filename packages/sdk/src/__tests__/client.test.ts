import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { SpectraClient } from '../client.js';

function findProjectRoot(): string {
  let dir = process.cwd();
  while (!fs.existsSync(path.join(dir, 'pnpm-workspace.yaml'))) {
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return dir;
}

describe('@spectra/sdk - SpectraClient Offline Unit Tests', () => {
  const root = findProjectRoot();
  const client = new SpectraClient();

  it('verifies canvas_000_v1 (0% clean clip) offline using cached SAM masks', async () => {
    const res = await client.verifyClip({
      clipId: 'canvas_000_v1',
      t0FramePath: path.join(root, 'benchmark/clips/canvas_000_v1_t0.png'),
      tkFramePath: path.join(root, 'benchmark/clips/canvas_000_v1_tk.png'),
      targetLabel: 'Revenue Series Legend',
      targetBBox: { x: 820, y: 240, width: 220, height: 48 },
      cachedSamResponsePath: path.join(
        root,
        'benchmark/responses/phase2-smoke/canvas_000_v1_sam.json',
      ),
    });

    expect(res.combinedVerdict).toBe('pass');
    expect(res.instrumentA.score).toBeGreaterThan(0.98);
    expect(res.instrumentB.score).toBe(1.0);
    expect(res.instrumentA.passed).toBe(true);
    expect(res.instrumentB.passed).toBe(true);
    expect(res.calibrated).toBe(true);
  });

  it('catches dom_catch_010_v1 (10% occlusion) offline using cached SAM masks', async () => {
    const res = await client.verifyClip({
      clipId: 'dom_catch_010_v1',
      t0FramePath: path.join(root, 'benchmark/clips/dom_catch_010_v1_t0.png'),
      tkFramePath: path.join(root, 'benchmark/clips/dom_catch_010_v1_tk.png'),
      targetLabel: 'Complete Checkout',
      targetBBox: { x: 910, y: 600, width: 340, height: 50 },
      cachedSamResponsePath: path.join(
        root,
        'benchmark/responses/phase2-smoke/dom_catch_010_v1_sam.json',
      ),
    });

    expect(res.combinedVerdict).toBe('fail');
    expect(res.instrumentA.passed).toBe(false);
    expect(res.instrumentB.passed).toBe(false);
    expect(res.instrumentA.score).toBeCloseTo(0.908, 2);
    expect(res.instrumentB.score).toBe(0.9);
  });

  it('catches dom_catch_040_v1 (40% occlusion) offline using cached SAM masks', async () => {
    const res = await client.verifyClip({
      clipId: 'dom_catch_040_v1',
      t0FramePath: path.join(root, 'benchmark/clips/dom_catch_040_v1_t0.png'),
      tkFramePath: path.join(root, 'benchmark/clips/dom_catch_040_v1_tk.png'),
      targetLabel: 'Complete Checkout',
      targetBBox: { x: 910, y: 600, width: 340, height: 50 },
      cachedSamResponsePath: path.join(
        root,
        'benchmark/responses/phase2-smoke/dom_catch_040_v1_sam.json',
      ),
    });

    expect(res.combinedVerdict).toBe('fail');
    expect(res.instrumentA.passed).toBe(false);
    expect(res.instrumentB.passed).toBe(false);
    expect(res.instrumentA.score).toBeCloseTo(0.62, 2);
    expect(res.instrumentB.score).toBe(0.6);
  });

  it('runs checkInvariants offline on .spectra/invariants.json', async () => {
    const invariantsPath = path.join(root, '.spectra/invariants.json');
    expect(fs.existsSync(invariantsPath)).toBe(true);

    const report = await client.checkInvariants({
      invariantsPath,
      clipOrFrames: {
        t0FramePath: path.join(root, 'benchmark/clips/canvas_000_v1_t0.png'),
        tkFramePath: path.join(root, 'benchmark/clips/canvas_000_v1_tk.png'),
        cachedSamResponsePath: path.join(
          root,
          'benchmark/responses/phase2-smoke/canvas_000_v1_sam.json',
        ),
        targetBBox: { x: 820, y: 240, width: 220, height: 48 },
        targetLabel: 'Revenue Series Legend',
      },
    });

    expect(report.results.length).toBeGreaterThanOrEqual(1);
    expect(report.results[0].combinedVerdict).toBe('pass');
    expect(report.calibration.sigma_noise).toBe(0.0045);
    expect(report.calibration.delta).toBe(0.041);
  });
});
