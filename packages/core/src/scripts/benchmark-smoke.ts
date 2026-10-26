import fs from 'node:fs';
import path from 'node:path';
import {
  ManifestSchema,
  computeTemplateMatchVisibility,
  computeSamVisibilityRatio,
  evaluateDualInstrument,
  getCalibration,
  assertCalibrated,
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

export function runBenchmarkSmoke() {
  console.log('=== Spectra Benchmark Smoke Test (Offline — $0.00 Spend) ===\n');

  const root = findProjectRoot();
  const manifestPath = path.join(root, 'benchmark/manifest.json');
  if (!fs.existsSync(manifestPath)) {
    throw new Error(`Manifest not found at: ${manifestPath}`);
  }

  // 1. Validate manifest against ManifestSchema
  console.log('Step 1: Validating benchmark/manifest.json against ManifestSchema...');
  const rawManifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
  const manifest: BenchmarkManifest = ManifestSchema.parse(rawManifest);
  console.log(`  ✓ Manifest validated: ${manifest.clips.length} total clips found.`);

  // 2. Enforce Rule 2 calibration
  console.log('\nStep 2: Enforcing Rule 2 calibration invariants...');
  const cal = getCalibration();
  assertCalibrated(cal);
  console.log(`  ✓ Calibration active: sigma_noise = ${cal.sigma_noise}, delta = ${cal.delta}`);
  console.log(`  ✓ Threshold (3 * sigma_noise) = ${(3 * cal.sigma_noise!).toFixed(4)}`);

  // 3. Select 3 representative clips: 0%, 15%, 40%
  const targetIds = ['canvas_000_v1', 'mobile_mp4_015_v1', 'dom_catch_040_v1'];
  console.log(
    `\nStep 3: Running Dual-Instrument Verification across 3 clips: [${targetIds.join(', ')}]...`,
  );

  let allPassed = true;

  for (const clipId of targetIds) {
    const clip = manifest.clips.find((c) => c.clipId === clipId);
    if (!clip) {
      throw new Error(`Clip ${clipId} not found in manifest.`);
    }

    const t0Path = path.join(root, clip.t0FramePath!);
    const tkPath = path.join(root, clip.tkFramePath!);

    // Instrument B: Pure deterministic pixel template matcher
    const resB = computeTemplateMatchVisibility(t0Path, tkPath, clip.targetBBox!);

    // Instrument A: SAM Visibility Ratio (Offline: computed from ground-truth mask area)
    const baselineArea = 10000;
    const evalArea = Math.round(baselineArea * (1.0 - clip.groundTruthOcclusion!));
    const resA = computeSamVisibilityRatio(baselineArea, evalArea);

    // Dual-Instrument Referee Verdict Engine
    const verdict = evaluateDualInstrument({
      clipId: clip.clipId,
      rSam: resA.rSam,
      rNcc: resB.pixelVisibilityRatio,
      targetBBox: clip.targetBBox,
      pixelLossCount: resB.pixelLossCount,
      totalPixels: resB.totalPixels,
      calibration: cal,
    });

    console.log(`\n  [Clip: ${clip.clipId}]`);
    console.log(`    Environment:        ${clip.environment}`);
    console.log(`    Ground Truth Occ:   ${clip.groundTruthOcclusion}`);
    console.log(`    Instrument A (SAM): rSam = ${resA.rSam.toFixed(4)}`);
    console.log(
      `    Instrument B (Pix): visRatio = ${resB.pixelVisibilityRatio.toFixed(4)}, loss = ${resB.measuredLoss.toFixed(4)}, rNcc = ${resB.rNcc.toFixed(4)}`,
    );
    console.log(`    Pixel Loss Count:   ${resB.pixelLossCount} / ${resB.totalPixels} px`);
    console.log(`    Verdict:            ${verdict.verdict.toUpperCase()}`);
    console.log(`    Reason:             ${verdict.reason}`);

    // Verify expected verdicts
    if (clip.groundTruthOcclusion === 0.0) {
      if (verdict.verdict !== 'pass') {
        console.error(`    ERROR: Expected 'pass' for 0% occlusion but got '${verdict.verdict}'`);
        allPassed = false;
      }
    } else {
      if (verdict.verdict !== 'fail') {
        console.error(
          `    ERROR: Expected 'fail' for ${clip.groundTruthOcclusion} occlusion but got '${verdict.verdict}'`,
        );
        allPassed = false;
      }
    }
  }

  if (!allPassed) {
    throw new Error('Benchmark smoke test failed one or more clip assertions.');
  }

  console.log('\n=== All 3 Smoke Test Clips Verified Successfully ($0.00 Spend) ===');
}

// Run directly if invoked as script
runBenchmarkSmoke();
