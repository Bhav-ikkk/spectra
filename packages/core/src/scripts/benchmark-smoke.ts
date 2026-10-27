import fs from 'node:fs';
import path from 'node:path';
import {
  parseVideoStream,
  recordsOfKind,
  frameIndexOf,
  decodeMaskToRaster,
  type ResponsesEvent,
} from '@spectra/sam-client';
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

async function decodeCachedSamMasks(
  responsePath: string,
): Promise<{ t0Area: number; tkArea: number; frameAreas: { frame: number; area: number }[] }> {
  const rawJson = JSON.parse(fs.readFileSync(responsePath, 'utf-8'));
  const outputMsg = rawJson.output?.[0]?.content?.[0];
  const outputText = outputMsg?.text || '';
  if (!outputText) {
    throw new Error(`No output_text in cached SAM response at ${responsePath}`);
  }

  async function* makeEvents(): AsyncIterable<ResponsesEvent> {
    yield {
      type: 'response.output_text.done',
      item_id: 'cached-sam',
      output_index: 0,
      content_index: 0,
      text: outputText,
    };
    yield { type: 'response.completed' };
  }

  const parsedStream = parseVideoStream(makeEvents());
  const parseResult = await parsedStream.finalResult;
  const maskRecords = recordsOfKind(parseResult.records, 'mask');

  const frameAreas: { frame: number; area: number }[] = [];
  for (const record of maskRecords) {
    const frame = frameIndexOf(record) ?? 0;
    const raster = decodeMaskToRaster(record.mask);
    let area = 0;
    for (let i = 0; i < raster.length; i++) {
      if (raster[i] === 1) area++;
    }
    frameAreas.push({ frame, area });
  }

  frameAreas.sort((a, b) => a.frame - b.frame);
  const t0Area = frameAreas[0]?.area ?? 0;
  const tkArea = frameAreas[frameAreas.length - 1]?.area ?? 0;

  return { t0Area, tkArea, frameAreas };
}

export async function runBenchmarkSmoke() {
  console.log(
    '=== Spectra Benchmark Smoke Test (Offline with Cached SAM UI Masks — $0.00 Spend) ===\n',
  );

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
  console.log(`  ✓ Run ID citation: ${cal.citation}`);

  // 3. Select 4 representative UI smoke clips: 0%, 10%, 15%, 40%
  const targetIds = ['canvas_000_v1', 'dom_catch_010_v1', 'mobile_mp4_015_v1', 'dom_catch_040_v1'];
  console.log(
    `\nStep 3: Running Dual-Instrument Verification across 4 UI clips: [${targetIds.join(', ')}]...`,
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

    // Instrument A: Decoded from real cached SAM 3.1 masks
    const samResponsePath = path.join(
      root,
      `benchmark/responses/phase2-smoke/${clip.clipId}_sam.json`,
    );
    if (!fs.existsSync(samResponsePath)) {
      throw new Error(`Cached SAM response not found: ${samResponsePath}`);
    }

    const samData = await decodeCachedSamMasks(samResponsePath);
    const resA = computeSamVisibilityRatio(samData.t0Area, samData.tkArea);

    // Dual-Instrument Referee Verdict Engine
    const verdict = evaluateDualInstrument({
      clipId: clip.clipId,
      rSam: resA.rSam,
      visRatio: resB.pixelVisibilityRatio,
      rNcc: resB.rNcc,
      targetBBox: clip.targetBBox,
      pixelLossCount: resB.pixelLossCount,
      totalPixels: resB.totalPixels,
      calibration: cal,
    });

    console.log(`\n  [Clip: ${clip.clipId}]`);
    console.log(`    Environment:        ${clip.environment}`);
    console.log(`    Ground Truth Occ:   ${(clip.groundTruthOcclusion! * 100).toFixed(1)}%`);
    console.log(
      `    Instrument A (SAM): t0=${samData.t0Area}px, tk=${samData.tkArea}px, rSam=${resA.rSam.toFixed(4)} (loss=${(resA.estimatedOcclusion * 100).toFixed(2)}%)`,
    );
    console.log(
      `    Instrument B (Pix): visRatio=${resB.pixelVisibilityRatio.toFixed(4)}, loss=${(resB.measuredLoss * 100).toFixed(2)}%, rNcc=${resB.rNcc.toFixed(4)}`,
    );
    console.log(
      `    Agreement Delta:    ${(verdict.instrumentAgreementDelta * 100).toFixed(2)}% (limit delta=${((cal.delta ?? 0) * 100).toFixed(2)}%)`,
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

  console.log('\n=== All 4 Smoke Test Clips Verified Successfully ($0.00 Spend) ===');
}

// Run directly if invoked as script
runBenchmarkSmoke().catch((err) => {
  console.error(err);
  process.exit(1);
});
