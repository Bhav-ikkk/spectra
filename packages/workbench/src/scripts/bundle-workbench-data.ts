import fs from 'node:fs';
import path from 'node:path';
import {
  parseVideoStream,
  recordsOfKind,
  frameIndexOf,
  decodeMaskToSVGPath,
  decodeMaskToRaster,
  getCalibration,
  type ResponsesEvent,
} from '@spectra/sdk';
import type {
  WorkbenchDataBundle,
  WorkbenchClipAsset,
  WorkbenchScenarioBundle,
  DecodedMaskFrame,
} from '../types.js';

function findWorkspaceRoot(startDir: string = process.cwd()): string {
  let dir = path.resolve(startDir);
  while (!fs.existsSync(path.join(dir, 'pnpm-workspace.yaml'))) {
    const parent = path.dirname(dir);
    if (parent === dir) {
      throw new Error('Could not find workspace root (pnpm-workspace.yaml)');
    }
    dir = parent;
  }
  return dir;
}

async function decodeSamResponseToSvg(
  samResponseJson: Record<string, unknown>,
): Promise<DecodedMaskFrame[]> {
  const output = samResponseJson.output as
    | Array<{ content?: Array<{ type?: string; text?: string }> }>
    | undefined;
  const textStr = output?.[0]?.content?.[0]?.text;
  if (typeof textStr !== 'string' || !textStr) {
    return [];
  }
  const safeText: string = textStr;

  async function* createStream(): AsyncIterable<ResponsesEvent> {
    yield {
      type: 'response.output_text.done',
      item_id: 'bundle-01',
      output_index: 0,
      content_index: 0,
      text: safeText,
    };
    yield { type: 'response.completed' };
  }

  const parsed = parseVideoStream(createStream());
  const result = await parsed.finalResult;

  const maskRecords = recordsOfKind(result.records, 'mask');
  const boxRecords = recordsOfKind(result.records, 'box');

  const frames: DecodedMaskFrame[] = [];

  for (let i = 0; i < maskRecords.length; i++) {
    const maskRecord = maskRecords[i]!;
    const frameIdx = frameIndexOf(maskRecord) ?? 0;
    const svgPath = decodeMaskToSVGPath(maskRecord.mask);

    let area = 0;
    try {
      const raster = decodeMaskToRaster(maskRecord.mask);
      for (let r = 0; r < raster.length; r++) {
        if ((raster[r] ?? 0) > 0) area++;
      }
    } catch {
      // Raster decode fallback if not needed
    }

    const boxRecord = boxRecords.find((b) => frameIndexOf(b) === frameIdx) || boxRecords[i];

    frames.push({
      frameIndex: frameIdx,
      bounds: {
        left: maskRecord.bounds.left,
        top: maskRecord.bounds.top,
        right: maskRecord.bounds.right,
        bottom: maskRecord.bounds.bottom,
      },
      svgPath,
      area,
      box: boxRecord
        ? {
            left: boxRecord.left,
            top: boxRecord.top,
            right: boxRecord.right,
            bottom: boxRecord.bottom,
          }
        : null,
    });
  }

  return frames;
}

export async function bundleWorkbenchData(): Promise<WorkbenchDataBundle> {
  const rootDir = findWorkspaceRoot();
  console.log(`[Workbench Bundler] Workspace root: ${rootDir}`);

  const publicAssetsDir = path.join(rootDir, 'packages', 'workbench', 'public', 'benchmark-assets');
  const publicDir = path.join(rootDir, 'packages', 'workbench', 'public');
  const generatedDir = path.join(rootDir, 'packages', 'workbench', 'src', 'generated');

  fs.mkdirSync(publicAssetsDir, { recursive: true });
  fs.mkdirSync(generatedDir, { recursive: true });

  // 1. Read manifest.json
  const manifestPath = path.join(rootDir, 'benchmark', 'manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
  const clips = (manifest.clips || []) as Array<{
    clipId: string;
    environment: 'canvas' | 'mobile_mp4' | 'dom_catch';
    groundTruthOcclusion: number;
    variant: string;
    targetLabel: string;
    targetBBox: { x: number; y: number; width: number; height: number };
  }>;

  // 2. Read referee_benchmark_report.json
  const reportPath = path.join(rootDir, 'benchmark', 'results', 'referee_benchmark_report.json');
  let benchmarkReport: Record<string, unknown> = {};
  if (fs.existsSync(reportPath)) {
    benchmarkReport = JSON.parse(fs.readFileSync(reportPath, 'utf-8'));
  }

  const reportClips = (benchmarkReport.clipResults || []) as Array<{
    clipId: string;
    evaluators?: Record<string, unknown>;
  }>;
  const reportMap = new Map<string, Record<string, unknown>>();
  for (const rc of reportClips) {
    if (rc.clipId && rc.evaluators) {
      reportMap.set(rc.clipId, rc.evaluators);
    }
  }

  // 3. Read .spectra/invariants.json
  const invariantsPath = path.join(rootDir, '.spectra', 'invariants.json');
  const invariants = fs.existsSync(invariantsPath)
    ? JSON.parse(fs.readFileSync(invariantsPath, 'utf-8'))
    : {};

  // 4. Read voice-smoke transcribe response
  const voiceSmokePath = path.join(
    rootDir,
    'benchmark',
    'responses',
    'voice-smoke',
    'raw_transcribe_response.json',
  );
  const voiceTranscript = fs.existsSync(voiceSmokePath)
    ? JSON.parse(fs.readFileSync(voiceSmokePath, 'utf-8'))
    : {};

  // 5. Copy clip assets & decode SAM masks
  console.log(`[Workbench Bundler] Processing ${clips.length} benchmark clips...`);
  const clipAssets: WorkbenchClipAsset[] = [];

  for (const c of clips) {
    const t0Src = path.join(rootDir, 'benchmark', 'clips', `${c.clipId}_t0.png`);
    const tkSrc = path.join(rootDir, 'benchmark', 'clips', `${c.clipId}_tk.png`);
    const mp4Src = path.join(rootDir, 'benchmark', 'clips', `${c.clipId}.mp4`);

    const t0Dest = path.join(publicAssetsDir, `${c.clipId}_t0.png`);
    const tkDest = path.join(publicAssetsDir, `${c.clipId}_tk.png`);
    const mp4Dest = path.join(publicAssetsDir, `${c.clipId}.mp4`);

    if (fs.existsSync(t0Src)) fs.copyFileSync(t0Src, t0Dest);
    if (fs.existsSync(tkSrc)) fs.copyFileSync(tkSrc, tkDest);
    let videoAssetUrl: string | undefined;
    if (fs.existsSync(mp4Src)) {
      fs.copyFileSync(mp4Src, mp4Dest);
      videoAssetUrl = `/benchmark-assets/${c.clipId}.mp4`;
    }

    // Look for SAM response
    const samCandidates = [
      path.join(rootDir, 'benchmark', 'responses', 'benchmark-sam', `${c.clipId}_sam.json`),
      path.join(rootDir, 'benchmark', 'responses', 'phase2-smoke', `${c.clipId}_sam.json`),
    ];

    let samResponseJson: Record<string, unknown> | null = null;
    for (const cand of samCandidates) {
      if (fs.existsSync(cand)) {
        try {
          samResponseJson = JSON.parse(fs.readFileSync(cand, 'utf-8'));
          break;
        } catch {
          // Continue search
        }
      }
    }

    let allMasks: DecodedMaskFrame[] | undefined;
    let t0Mask: DecodedMaskFrame | null = null;
    let tkMask: DecodedMaskFrame | null = null;

    if (samResponseJson) {
      const decodedFrames = await decodeSamResponseToSvg(samResponseJson);
      if (decodedFrames.length > 0) {
        allMasks = decodedFrames;
        t0Mask = decodedFrames[0] ?? null;
        tkMask = decodedFrames[decodedFrames.length - 1] ?? null;
      }
    }

    const evaluators = reportMap.get(c.clipId) as WorkbenchClipAsset['evaluators'] | undefined;

    clipAssets.push({
      clipId: c.clipId,
      environment: c.environment,
      groundTruthOcclusion: c.groundTruthOcclusion,
      variant: c.variant,
      targetLabel: c.targetLabel,
      targetBBox: [c.targetBBox.x, c.targetBBox.y, c.targetBBox.width, c.targetBBox.height],
      t0AssetUrl: `/benchmark-assets/${c.clipId}_t0.png`,
      tkAssetUrl: `/benchmark-assets/${c.clipId}_tk.png`,
      videoAssetUrl,
      samAvailable: Boolean(allMasks && allMasks.length > 0),
      t0Mask,
      tkMask,
      allMasks,
      evaluators,
    });
  }

  // 6. Process Closed-Loop Scenarios (S1, S2, S3)
  console.log('[Workbench Bundler] Bundling closed-loop scenarios...');

  async function loadScenario(
    scenarioId: 's1' | 's2' | 's3',
    title: string,
    environment: 'canvas' | 'mobile_mp4' | 'dom_catch',
    targetLabel: string,
    pass1ClipId: string,
    pass2ClipId: string,
  ): Promise<WorkbenchScenarioBundle> {
    const scenarioDir = path.join(rootDir, 'benchmark', 'responses', `closed-loop-${scenarioId}`);

    const summary = fs.existsSync(path.join(scenarioDir, 'closed_loop_summary.json'))
      ? JSON.parse(fs.readFileSync(path.join(scenarioDir, 'closed_loop_summary.json'), 'utf-8'))
      : {};

    const pass1Verdict = fs.existsSync(path.join(scenarioDir, 'pass1_verdict.json'))
      ? JSON.parse(fs.readFileSync(path.join(scenarioDir, 'pass1_verdict.json'), 'utf-8'))
      : {};

    const pass2Verdict = fs.existsSync(path.join(scenarioDir, 'pass2_verdict.json'))
      ? JSON.parse(fs.readFileSync(path.join(scenarioDir, 'pass2_verdict.json'), 'utf-8'))
      : {};

    const repairPatchRaw = fs.existsSync(path.join(scenarioDir, 'agent_repair_patch.json'))
      ? JSON.parse(fs.readFileSync(path.join(scenarioDir, 'agent_repair_patch.json'), 'utf-8'))
      : {};

    const pass1Asset = clipAssets.find((a) => a.clipId === pass1ClipId);
    const pass2Asset = clipAssets.find((a) => a.clipId === pass2ClipId);

    return {
      scenarioId,
      title,
      environment,
      targetLabel,
      pass1: {
        clipId: pass1ClipId,
        t0AssetUrl: pass1Asset?.t0AssetUrl || `/benchmark-assets/${pass1ClipId}_t0.png`,
        tkAssetUrl: pass1Asset?.tkAssetUrl || `/benchmark-assets/${pass1ClipId}_tk.png`,
        verdict: pass1Verdict,
        masks: pass1Asset?.allMasks,
      },
      repairPatch: {
        description: repairPatchRaw.description,
        reasoning: repairPatchRaw.reasoning,
        patchDiff: repairPatchRaw.patchDiff || repairPatchRaw.patch,
        suggestedFix: repairPatchRaw.suggestedFix,
        rawPatch: repairPatchRaw,
      },
      pass2: {
        clipId: pass2ClipId,
        t0AssetUrl: pass2Asset?.t0AssetUrl || `/benchmark-assets/${pass2ClipId}_t0.png`,
        tkAssetUrl: pass2Asset?.tkAssetUrl || `/benchmark-assets/${pass2ClipId}_tk.png`,
        verdict: pass2Verdict,
        masks: pass2Asset?.allMasks,
      },
      summary,
    };
  }

  const s1 = await loadScenario(
    's1',
    'Scenario S1: HTML5 Canvas Chart Collision',
    'canvas',
    'Monthly Revenue Chart Legend',
    'canvas_015_v1',
    'canvas_000_v1',
  );

  const s2 = await loadScenario(
    's2',
    'Scenario S2: Mobile Promo Bottom-Sheet Overlap (Raw MP4, No DOM)',
    'mobile_mp4',
    'Complete Checkout Button',
    'mobile_mp4_015_v1',
    'mobile_mp4_000_v1',
  );

  const s3 = await loadScenario(
    's3',
    'Scenario S3: Sticky Cart Drawer Edge Occlusion ("The Catch")',
    'dom_catch',
    'Complete Checkout Button',
    'dom_catch_010_v1',
    'dom_catch_000_v1',
  );

  const cal = getCalibration();
  const sigmaNoise = cal.sigma_noise ?? 0.0045;
  const delta = cal.delta ?? 0.041;
  const bundle: WorkbenchDataBundle = {
    version: '1.0',
    generatedAt: new Date().toISOString(),
    calibration: {
      sigma_noise: sigmaNoise,
      delta,
      threshold: 3 * sigmaNoise,
      runIdCitation: cal.citation || '',
    },
    invariants,
    voiceTranscript,
    scenarios: {
      s1,
      s2,
      s3,
    },
    benchmarkReport,
    clips: clipAssets,
  };

  // 7. Write to public/workbench-data.json and src/generated/workbench-data.json
  const publicDataPath = path.join(publicDir, 'workbench-data.json');
  const generatedDataPath = path.join(generatedDir, 'workbench-data.json');

  const bundleString = JSON.stringify(bundle, null, 2);
  fs.writeFileSync(publicDataPath, bundleString, 'utf-8');
  fs.writeFileSync(generatedDataPath, bundleString, 'utf-8');

  console.log(`[Workbench Bundler] Successfully wrote bundle to:`);
  console.log(`  - ${publicDataPath}`);
  console.log(`  - ${generatedDataPath}`);
  console.log(
    `  Clips bundled: ${bundle.clips.length} (${bundle.clips.filter((c) => c.samAvailable).length} with decoded SAM masks)`,
  );

  return bundle;
}

// Allow direct execution via CLI
if (
  process.argv[1] &&
  (process.argv[1].endsWith('bundle-workbench-data.ts') ||
    process.argv[1].endsWith('bundle-workbench-data.js'))
) {
  bundleWorkbenchData()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('[Workbench Bundler Error]:', err);
      process.exit(1);
    });
}
