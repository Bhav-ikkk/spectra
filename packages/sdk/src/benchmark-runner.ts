import fs from 'node:fs';
import path from 'node:path';
import {
  type RefereeBenchmarkReport,
  type ClipBenchmarkResult,
  type Full45ClipResult,
  type OcclusionLevelStats,
  type OcclusionLevelEvaluatorsRecord,
  type EvaluatorSummariesRecord,
  type EvaluatorType,
  type EvaluatorResult,
  getCalibration,
  computeTemplateMatchVisibility,
} from '@spectra/core';
import { buildObjectPrompt } from '@spectra/sam-client';
import { evaluateWithVlmJudge } from '@spectra/invariant-compiler';
import { SpectraClient } from './client.js';

function findProjectRoot(): string {
  let dir = process.cwd();
  while (!fs.existsSync(path.join(dir, 'pnpm-workspace.yaml'))) {
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return dir;
}

function getEnvVar(key: string): string | undefined {
  if (typeof process !== 'undefined' && process.env?.[key]) {
    return process.env[key];
  }
  const root = findProjectRoot();
  const envPath = path.join(root, '.env');
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf-8');
    const match = content.match(new RegExp(`${key}=([^\\r\\n]+)`));
    if (match?.[1]?.trim()) {
      return match[1].trim();
    }
  }
  return undefined;
}

export interface BenchmarkRunnerOptions {
  manifestPath?: string;
  samCacheDir?: string;
  vlmCacheDir?: string;
  phase2SmokeDir?: string;
  outputReportPath?: string;
  metaApiKey?: string;
  metaBaseUrl?: string;
  basetenApiKey?: string;
  basetenBaseUrl?: string;
  skipLiveCalls?: boolean;
  onProgress?: (progress: {
    stage: string;
    current: number;
    total: number;
    clipId?: string;
  }) => void;
}

interface ManifestClip {
  clipId: string;
  environment: 'canvas' | 'mobile_mp4' | 'dom_catch';
  scenario: string;
  variant: string;
  groundTruthOcclusion: number;
  targetLabel: string;
  targetBBox: { x: number; y: number; width: number; height: number };
  t0FramePath: string;
  tkFramePath: string;
  videoPath: string;
  centerPixelCovered: boolean;
  sourceParams?: {
    variantType?: string;
    width: number;
    height: number;
  };
}

export async function runRefereeBenchmark(
  options: BenchmarkRunnerOptions = {},
): Promise<RefereeBenchmarkReport> {
  const root = findProjectRoot();
  const manifestPath = options.manifestPath
    ? path.resolve(options.manifestPath)
    : path.join(root, 'benchmark/manifest.json');
  const manifestRaw = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
  const allClips: ManifestClip[] = manifestRaw.clips;

  const samCacheDir = options.samCacheDir
    ? path.resolve(options.samCacheDir)
    : path.join(root, 'benchmark/responses/benchmark-sam');
  const vlmCacheDir = options.vlmCacheDir
    ? path.resolve(options.vlmCacheDir)
    : path.join(root, 'benchmark/responses/benchmark-vlm');
  const phase2SmokeDir = options.phase2SmokeDir
    ? path.resolve(options.phase2SmokeDir)
    : path.join(root, 'benchmark/responses/phase2-smoke');
  const outputReportPath = options.outputReportPath
    ? path.resolve(options.outputReportPath)
    : path.join(root, 'benchmark/results/referee_benchmark_report.json');

  fs.mkdirSync(samCacheDir, { recursive: true });
  fs.mkdirSync(vlmCacheDir, { recursive: true });
  fs.mkdirSync(path.dirname(outputReportPath), { recursive: true });

  const metaApiKey = options.metaApiKey || getEnvVar('META_API_KEY');
  const metaBaseUrl =
    options.metaBaseUrl || getEnvVar('META_API_BASE_URL') || 'https://api.meta.ai/v1';
  const basetenApiKey = options.basetenApiKey || getEnvVar('BASETEN_API_KEY');
  const basetenBaseUrl =
    options.basetenBaseUrl || getEnvVar('BASETEN_BASE_URL') || 'https://inference.baseten.co/v1';

  // Seed benchmark-sam cache with any existing responses in phase2-smoke
  if (fs.existsSync(phase2SmokeDir)) {
    const existingSmoke = fs.readdirSync(phase2SmokeDir);
    for (const f of existingSmoke) {
      if (f.endsWith('_sam.json')) {
        const dest = path.join(samCacheDir, f);
        if (!fs.existsSync(dest)) {
          fs.copyFileSync(path.join(phase2SmokeDir, f), dest);
        }
      }
    }
  }

  // Filter 21 canonical v1 clips
  const v1Clips = allClips.filter((c) => c.sourceParams && c.sourceParams.variantType === 'v1');
  v1Clips.sort((a, b) => {
    if (a.environment !== b.environment) {
      return a.environment.localeCompare(b.environment);
    }
    return a.groundTruthOcclusion - b.groundTruthOcclusion;
  });

  const client = new SpectraClient();
  const v1Results: ClipBenchmarkResult[] = [];

  // =========================================================================
  // Process 21 Canonical v1 Clips across all 4 Evaluators
  // =========================================================================
  for (let i = 0; i < v1Clips.length; i++) {
    const clip = v1Clips[i];
    options.onProgress?.({
      stage: 'v1_clips',
      current: i + 1,
      total: v1Clips.length,
      clipId: clip.clipId,
    });

    const t0Abs = path.join(root, clip.t0FramePath);
    const tkAbs = path.join(root, clip.tkFramePath);
    const videoAbs = path.join(root, clip.videoPath);
    const samJsonPath = path.join(samCacheDir, `${clip.clipId}_sam.json`);
    const isOccluded = clip.groundTruthOcclusion > 0;

    // -----------------------------------------------------------------------
    // Evaluator 1: dom_hit_test
    // -----------------------------------------------------------------------
    const domStartTime = Date.now();
    let domVerdict: 'pass' | 'fail' = 'pass';
    let domDetails = '';
    const hasDom = clip.environment === 'dom_catch';

    if (!hasDom) {
      domVerdict = 'pass';
      domDetails =
        clip.environment === 'canvas'
          ? 'HTML5 <canvas> element has 0 child DOM nodes; DOM locators report false pass.'
          : 'Raw mobile video stream has no DOM accessibility tree; test runner assumes pass.';
    } else {
      domVerdict = clip.centerPixelCovered ? 'fail' : 'pass';
      domDetails = clip.centerPixelCovered
        ? 'Center pixel hit-test obstructed by overlay drawer.'
        : 'Center pixel unobstructed; edge occlusion missed by DOM hit-test.';
    }

    const domLatencyMs = Date.now() - domStartTime;
    const domResult: EvaluatorResult = {
      evaluator: 'dom_hit_test',
      verdict: domVerdict,
      detected: domVerdict === 'fail',
      falsePass: isOccluded && domVerdict === 'pass',
      latencyMs: domLatencyMs,
      details: domDetails,
      raw: {
        hasDom,
        centerPixelCovered: clip.centerPixelCovered,
      },
    };

    // -----------------------------------------------------------------------
    // Evaluator 2: vlm_open_weight (meta-models/muse-spark-open-1026 via Baseten)
    // -----------------------------------------------------------------------
    const openWeightCachePath = path.join(vlmCacheDir, `${clip.clipId}_open_weight.json`);
    const vlmOwStartTime = Date.now();
    let vlmOwJudgeRes;

    if (fs.existsSync(openWeightCachePath)) {
      vlmOwJudgeRes = await evaluateWithVlmJudge(tkAbs, clip.targetLabel, {
        provider: 'baseten',
        cachedResponsePath: openWeightCachePath,
      });
    } else {
      if (options.skipLiveCalls) {
        throw new Error(
          `Missing cached VLM open-weight response for ${clip.clipId} and skipLiveCalls is enabled.`,
        );
      }
      if (!basetenApiKey) {
        throw new Error(
          `BASETEN_API_KEY is required to run live open-weight evaluation for ${clip.clipId}.`,
        );
      }
      vlmOwJudgeRes = await evaluateWithVlmJudge(tkAbs, clip.targetLabel, {
        provider: 'baseten',
        apiKey: basetenApiKey,
        baseUrl: basetenBaseUrl,
      });
      fs.writeFileSync(
        openWeightCachePath,
        JSON.stringify(vlmOwJudgeRes.rawResponse, null, 2),
        'utf-8',
      );
    }
    const vlmOwLatencyMs = Date.now() - vlmOwStartTime;
    const vlmOwVerdict: 'pass' | 'fail' = vlmOwJudgeRes.clipped ? 'fail' : 'pass';

    const vlmOpenWeightResult: EvaluatorResult = {
      evaluator: 'vlm_open_weight',
      verdict: vlmOwVerdict,
      detected: vlmOwVerdict === 'fail',
      falsePass: isOccluded && vlmOwVerdict === 'pass',
      confidence: vlmOwJudgeRes.confidence,
      latencyMs: vlmOwLatencyMs,
      details: vlmOwJudgeRes.reasoning,
      raw: vlmOwJudgeRes.rawResponse,
    };

    // -----------------------------------------------------------------------
    // Evaluator 3: vlm_flagship (muse-spark-1.3 via Meta API)
    // -----------------------------------------------------------------------
    const flagshipCachePath = path.join(vlmCacheDir, `${clip.clipId}_flagship.json`);
    const vlmFlagshipStartTime = Date.now();
    let vlmFlagshipJudgeRes;

    if (fs.existsSync(flagshipCachePath)) {
      vlmFlagshipJudgeRes = await evaluateWithVlmJudge(tkAbs, clip.targetLabel, {
        provider: 'meta',
        cachedResponsePath: flagshipCachePath,
      });
    } else {
      if (options.skipLiveCalls) {
        throw new Error(
          `Missing cached VLM flagship response for ${clip.clipId} and skipLiveCalls is enabled.`,
        );
      }
      if (!metaApiKey) {
        throw new Error(
          `META_API_KEY is required to run live flagship evaluation for ${clip.clipId}.`,
        );
      }
      vlmFlagshipJudgeRes = await evaluateWithVlmJudge(tkAbs, clip.targetLabel, {
        provider: 'meta',
        apiKey: metaApiKey,
        baseUrl: metaBaseUrl,
      });
      fs.writeFileSync(
        flagshipCachePath,
        JSON.stringify(vlmFlagshipJudgeRes.rawResponse, null, 2),
        'utf-8',
      );
    }
    const vlmFlagshipLatencyMs = Date.now() - vlmFlagshipStartTime;
    const vlmFlagshipVerdict: 'pass' | 'fail' = vlmFlagshipJudgeRes.clipped ? 'fail' : 'pass';

    const vlmFlagshipResult: EvaluatorResult = {
      evaluator: 'vlm_flagship',
      verdict: vlmFlagshipVerdict,
      detected: vlmFlagshipVerdict === 'fail',
      falsePass: isOccluded && vlmFlagshipVerdict === 'pass',
      confidence: vlmFlagshipJudgeRes.confidence,
      latencyMs: vlmFlagshipLatencyMs,
      details: vlmFlagshipJudgeRes.reasoning,
      raw: vlmFlagshipJudgeRes.rawResponse,
    };

    // -----------------------------------------------------------------------
    // Evaluator 4: spectra_referee (SAM 3.1 + Pixel Matcher + Referee)
    // -----------------------------------------------------------------------
    // Ensure SAM 3.1 response exists; if missing, call live Meta API
    if (!fs.existsSync(samJsonPath)) {
      if (options.skipLiveCalls) {
        throw new Error(
          `Missing cached SAM response for ${clip.clipId} and skipLiveCalls is enabled.`,
        );
      }
      if (!metaApiKey) {
        throw new Error(`META_API_KEY is required to run live SAM call for ${clip.clipId}.`);
      }
      const videoBuffer = fs.readFileSync(videoAbs);
      const videoBase64 = `data:video/mp4;base64,${videoBuffer.toString('base64')}`;
      const promptContent = buildObjectPrompt({
        size: { width: 1280, height: 720 },
        objects: [
          {
            id: 0,
            prompts: [
              {
                frame: 0,
                box: {
                  left: clip.targetBBox.x,
                  top: clip.targetBBox.y,
                  right: clip.targetBBox.x + clip.targetBBox.width,
                  bottom: clip.targetBBox.y + clip.targetBBox.height,
                },
              },
            ],
          },
        ],
      });

      const endpoint = `${metaBaseUrl.replace(/\/+$/, '')}/responses`;
      const samRes = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${metaApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'sam-3.1',
          input: [
            {
              role: 'user',
              content: [
                {
                  type: 'input_video',
                  video_url: videoBase64,
                },
                {
                  type: 'input_text',
                  text: promptContent,
                },
              ],
            },
          ],
        }),
      });

      if (!samRes.ok) {
        throw new Error(
          `Meta SAM API error for ${clip.clipId} (${samRes.status}): ${await samRes.text()}`,
        );
      }
      const rawSamJson = await samRes.json();
      fs.writeFileSync(samJsonPath, JSON.stringify(rawSamJson, null, 2), 'utf-8');
    }

    const spectraStartTime = Date.now();
    const refereeResult = await client.verifyClip({
      clipId: clip.clipId,
      t0FramePath: t0Abs,
      tkFramePath: tkAbs,
      videoPath: videoAbs,
      cachedSamResponsePath: samJsonPath,
      targetLabel: clip.targetLabel,
      targetBBox: clip.targetBBox,
    });
    const spectraLatencyMs = Date.now() - spectraStartTime;

    const rSam = refereeResult.instrumentA.score;
    const visRatio = refereeResult.instrumentB.score;
    const rNcc = (refereeResult.instrumentB.raw as { rNcc?: number })?.rNcc ?? 1.0;
    const pixelLossCount =
      (refereeResult.instrumentB.raw as { pixelLossCount?: number })?.pixelLossCount ?? 0;
    const estimatedOcclusion =
      (refereeResult.instrumentA.raw as { estimatedOcclusion?: number })?.estimatedOcclusion ??
      1.0 - rSam;
    const absoluteError = Math.abs(estimatedOcclusion - clip.groundTruthOcclusion);

    const spectraResult: EvaluatorResult & {
      rSam: number;
      visRatio: number;
      rNcc: number;
      pixelLossCount: number;
      estimatedOcclusion: number;
      absoluteError: number;
      agreementDelta: number;
      notes?: string;
    } = {
      evaluator: 'spectra_referee',
      verdict: refereeResult.combinedVerdict,
      detected: refereeResult.combinedVerdict === 'fail',
      falsePass: isOccluded && refereeResult.combinedVerdict === 'pass',
      confidence: refereeResult.confidence ?? undefined,
      score: refereeResult.confidence ?? undefined,
      latencyMs: spectraLatencyMs,
      details: refereeResult.notes,
      rSam,
      visRatio,
      rNcc,
      pixelLossCount,
      estimatedOcclusion,
      absoluteError,
      agreementDelta: refereeResult.noiseDelta ?? 0,
      notes: refereeResult.notes,
      raw: {
        instrumentA: refereeResult.instrumentA,
        instrumentB: refereeResult.instrumentB,
      },
    };

    v1Results.push({
      clipId: clip.clipId,
      environment: clip.environment,
      scenario: clip.scenario,
      occlusionLevel: clip.groundTruthOcclusion,
      groundTruthOcclusion: clip.groundTruthOcclusion,
      targetLabel: clip.targetLabel,
      evaluators: {
        dom_hit_test: domResult,
        vlm_open_weight: vlmOpenWeightResult,
        vlm_flagship: vlmFlagshipResult,
        spectra_referee: spectraResult,
      },
    });
  }

  // =========================================================================
  // Process Full 45 Clips for Instrument B and DOM Hit-Test Analysis
  // =========================================================================
  const full45Results: Full45ClipResult[] = [];
  for (const clip of allClips) {
    const t0Abs = path.join(root, clip.t0FramePath);
    const tkAbs = path.join(root, clip.tkFramePath);
    const isOccluded = clip.groundTruthOcclusion > 0;
    const hasDom = clip.environment === 'dom_catch';

    let domVerdict: 'pass' | 'fail' = 'pass';
    if (hasDom && clip.centerPixelCovered) {
      domVerdict = 'fail';
    }

    const tpl = computeTemplateMatchVisibility(t0Abs, tkAbs, clip.targetBBox);
    const instBVerdict: 'pass' | 'fail' = tpl.measuredLoss > 0.0135 ? 'fail' : 'pass';

    full45Results.push({
      clipId: clip.clipId,
      environment: clip.environment,
      groundTruthOcclusion: clip.groundTruthOcclusion,
      domHitTest: {
        verdict: domVerdict,
        falsePass: isOccluded && domVerdict === 'pass',
        hasDom,
        centerPixelCovered: clip.centerPixelCovered,
      },
      instrumentB: {
        visRatio: tpl.pixelVisibilityRatio,
        measuredLoss: tpl.measuredLoss,
        pixelLossCount: tpl.pixelLossCount,
        totalPixels: tpl.totalPixels,
        absoluteError: Math.abs(tpl.measuredLoss - clip.groundTruthOcclusion),
        verdict: instBVerdict,
        falsePass: isOccluded && instBVerdict === 'pass',
      },
    });
  }

  // =========================================================================
  // Aggregate Metrics & Occlusion Detection Curve
  // =========================================================================
  const evaluatorsList: EvaluatorType[] = [
    'dom_hit_test',
    'vlm_open_weight',
    'vlm_flagship',
    'spectra_referee',
  ];

  const occlusionLevels = [0.0, 0.05, 0.1, 0.15, 0.25, 0.4, 0.6];
  const occlusionCurve: OcclusionLevelStats[] = [];

  for (const occ of occlusionLevels) {
    const clipsAtLevel = v1Results.filter((r) => Math.abs(r.occlusionLevel - occ) < 0.001);
    const count = clipsAtLevel.length;

    const evalMap = {} as OcclusionLevelEvaluatorsRecord;

    for (const ev of evaluatorsList) {
      let passed = 0;
      let failed = 0;
      let inconclusive = 0;

      for (const c of clipsAtLevel) {
        const v = c.evaluators[ev].verdict;
        if (v === 'pass') passed++;
        else if (v === 'fail') failed++;
        else inconclusive++;
      }

      if (occ === 0.0) {
        // Clean baseline: detection rate is N/A (0), false alarms are failures
        evalMap[ev] = {
          passed,
          failed,
          inconclusive,
          detectionRate: 0.0,
          falsePassRate: 0.0,
          falseAlarmRate: count > 0 ? failed / count : 0.0,
        };
      } else {
        // Occluded: detections are failures, false passes are passes
        evalMap[ev] = {
          passed,
          failed,
          inconclusive,
          detectionRate: count > 0 ? failed / count : 0.0,
          falsePassRate: count > 0 ? passed / count : 0.0,
          falseAlarmRate: 0.0,
        };
      }
    }

    occlusionCurve.push({
      occlusionLevel: occ,
      totalClips: count,
      evaluators: evalMap,
    });
  }

  // Evaluator Summaries
  const cleanV1 = v1Results.filter((r) => r.groundTruthOcclusion === 0);
  const occludedV1 = v1Results.filter((r) => r.groundTruthOcclusion > 0);

  const evaluatorSummaries = {} as EvaluatorSummariesRecord;
  for (const ev of evaluatorsList) {
    let cleanFails = 0;
    let occludedDetections = 0;
    let occludedFalsePasses = 0;
    let inconclusive = 0;
    let totalLatency = 0;

    for (const c of cleanV1) {
      if (c.evaluators[ev].verdict === 'fail') cleanFails++;
      if (c.evaluators[ev].verdict === 'inconclusive') inconclusive++;
      totalLatency += c.evaluators[ev].latencyMs;
    }

    for (const c of occludedV1) {
      if (c.evaluators[ev].verdict === 'fail') occludedDetections++;
      if (c.evaluators[ev].verdict === 'pass') occludedFalsePasses++;
      if (c.evaluators[ev].verdict === 'inconclusive') inconclusive++;
      totalLatency += c.evaluators[ev].latencyMs;
    }

    const totalV1 = v1Results.length;
    evaluatorSummaries[ev] = {
      evaluator: ev,
      totalEvaluated: totalV1,
      cleanClipsCount: cleanV1.length,
      occludedClipsCount: occludedV1.length,
      overallDetectionRate: occludedV1.length > 0 ? occludedDetections / occludedV1.length : 0.0,
      overallFalsePassRate: occludedV1.length > 0 ? occludedFalsePasses / occludedV1.length : 0.0,
      falseAlarmRate: cleanV1.length > 0 ? cleanFails / cleanV1.length : 0.0,
      inconclusiveRate: totalV1 > 0 ? inconclusive / totalV1 : 0.0,
      averageLatencyMs: totalV1 > 0 ? Math.round(totalLatency / totalV1) : 0,
    };
  }

  // Spectra MAE Calculations
  const spectraErrors = v1Results.map((r) => r.evaluators.spectra_referee.absoluteError);
  const spectraMae = spectraErrors.reduce((sum, e) => sum + e, 0) / (spectraErrors.length || 1);

  const canvasClips = v1Results.filter((r) => r.environment === 'canvas');
  const mobileClips = v1Results.filter((r) => r.environment === 'mobile_mp4');
  const domClips = v1Results.filter((r) => r.environment === 'dom_catch');

  const spectraCanvasMae =
    canvasClips
      .map((r) => r.evaluators.spectra_referee.absoluteError)
      .reduce((sum, e) => sum + e, 0) / (canvasClips.length || 1);

  const spectraMobileMae =
    mobileClips
      .map((r) => r.evaluators.spectra_referee.absoluteError)
      .reduce((sum, e) => sum + e, 0) / (mobileClips.length || 1);

  const spectraDomMae =
    domClips.map((r) => r.evaluators.spectra_referee.absoluteError).reduce((sum, e) => sum + e, 0) /
    (domClips.length || 1);

  const calibration = getCalibration();

  const report: RefereeBenchmarkReport = {
    version: '1.0',
    generatedAt: new Date().toISOString(),
    runId: `run_referee_benchmark_${Date.now()}`,
    calibration: {
      sigma_noise: calibration.sigma_noise ?? 0.0045,
      delta: calibration.delta ?? 0.041,
      threshold: 3 * (calibration.sigma_noise ?? 0.0045),
    },
    summary: {
      totalClips: allClips.length,
      canonicalV1Clips: v1Results.length,
      fullClipsAnalyzed: full45Results.length,
      spectraMae: Number(spectraMae.toFixed(4)),
      spectraCanvasMae: Number(spectraCanvasMae.toFixed(4)),
      spectraMobileMae: Number(spectraMobileMae.toFixed(4)),
      spectraDomMae: Number(spectraDomMae.toFixed(4)),
      evaluatorSummaries,
      occlusionCurve,
    },
    v1Results,
    full45Results,
  };

  fs.writeFileSync(outputReportPath, JSON.stringify(report, null, 2), 'utf-8');
  return report;
}

export function formatBenchmarkSummary(report: RefereeBenchmarkReport): string {
  const sep = '='.repeat(105);
  const line = '-'.repeat(105);

  const rows = report.summary.occlusionCurve.map((lvl) => {
    const occLabel =
      lvl.occlusionLevel === 0
        ? '0% (Clean)'
        : lvl.occlusionLevel === 0.1
          ? '10% (The Catch)'
          : `${(lvl.occlusionLevel * 100).toFixed(0)}% Occl`;

    const dom = lvl.evaluators.dom_hit_test;
    const vlmOw = lvl.evaluators.vlm_open_weight;
    const vlmFlag = lvl.evaluators.vlm_flagship;
    const spectra = lvl.evaluators.spectra_referee;

    function fmt(stats: { detectionRate: number; falsePassRate: number; falseAlarmRate: number }) {
      if (lvl.occlusionLevel === 0) {
        return `Pass ${(100 - stats.falseAlarmRate * 100).toFixed(0)}% (FA ${(stats.falseAlarmRate * 100).toFixed(0)}%)`;
      }
      return `Det ${(stats.detectionRate * 100).toFixed(0)}% / FP ${(stats.falsePassRate * 100).toFixed(0)}%`;
    }

    return (
      ` ${occLabel.padEnd(16)} | ` +
      `${fmt(dom).padEnd(18)} | ` +
      `${fmt(vlmOw).padEnd(18)} | ` +
      `${fmt(vlmFlag).padEnd(18)} | ` +
      `${fmt(spectra).padEnd(18)}`
    );
  });

  const sumDom = report.summary.evaluatorSummaries.dom_hit_test;
  const sumOw = report.summary.evaluatorSummaries.vlm_open_weight;
  const sumFlag = report.summary.evaluatorSummaries.vlm_flagship;
  const sumSpec = report.summary.evaluatorSummaries.spectra_referee;

  return [
    sep,
    ' SPECTRA 4-EVALUATOR REFEREE BENCHMARK REPORT (21 V1 Canonical Cells + 45 Full Instrument B)',
    sep,
    ` Run ID:        ${report.runId}`,
    ` Generated At:  ${report.generatedAt}`,
    ` Total Clips:   ${report.summary.canonicalV1Clips} canonical v1 clips (${report.summary.fullClipsAnalyzed} full clips)`,
    ` Noise Floor:   sigma_noise=${report.calibration.sigma_noise.toFixed(4)}, delta=${report.calibration.delta.toFixed(4)}, threshold=${(report.calibration.threshold * 100).toFixed(2)}%`,
    ` Spectra MAE:   Overall=${(report.summary.spectraMae * 100).toFixed(2)}% (Canvas=${(report.summary.spectraCanvasMae * 100).toFixed(2)}%, Mobile=${(report.summary.spectraMobileMae * 100).toFixed(2)}%, DOM=${(report.summary.spectraDomMae * 100).toFixed(2)}%)`,
    line,
    ' Occlusion Level  | DOM Hit-Test       | VLM Open-Weight    | VLM Flagship       | Spectra Referee   ',
    '                  | (Det % / FP %)     | (Det % / FP %)     | (Det % / FP %)     | (Det % / FP %)    ',
    line,
    ...rows,
    line,
    ` Overall Det Rate | ${(sumDom.overallDetectionRate * 100).toFixed(1)}%`.padEnd(19) +
      `| ${(sumOw.overallDetectionRate * 100).toFixed(1)}%`.padEnd(21) +
      `| ${(sumFlag.overallDetectionRate * 100).toFixed(1)}%`.padEnd(21) +
      `| ${(sumSpec.overallDetectionRate * 100).toFixed(1)}%`,
    ` Overall FP Rate  | ${(sumDom.overallFalsePassRate * 100).toFixed(1)}%`.padEnd(19) +
      `| ${(sumOw.overallFalsePassRate * 100).toFixed(1)}%`.padEnd(21) +
      `| ${(sumFlag.overallFalsePassRate * 100).toFixed(1)}%`.padEnd(21) +
      `| ${(sumSpec.overallFalsePassRate * 100).toFixed(1)}%`,
    ` False Alarm Rate | ${(sumDom.falseAlarmRate * 100).toFixed(1)}%`.padEnd(19) +
      `| ${(sumOw.falseAlarmRate * 100).toFixed(1)}%`.padEnd(21) +
      `| ${(sumFlag.falseAlarmRate * 100).toFixed(1)}%`.padEnd(21) +
      `| ${(sumSpec.falseAlarmRate * 100).toFixed(1)}%`,
    ` Average Latency  | ${sumDom.averageLatencyMs}ms`.padEnd(19) +
      `| ${sumOw.averageLatencyMs}ms`.padEnd(21) +
      `| ${sumFlag.averageLatencyMs}ms`.padEnd(21) +
      `| ${sumSpec.averageLatencyMs}ms`,
    sep,
  ].join('\n');
}
