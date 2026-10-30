import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import type { MeasurementResult } from '@spectra/core';
import { extractJsonFromText, type ModelProvider } from '@spectra/invariant-compiler';
import { SpectraClient } from './client.js';
import {
  renderPatchedScene,
  computeRemainingOverlapRatio,
} from './scene-renderer.js';

export type ScenarioSelection = 's1' | 's2' | 's3' | 'all';

export interface NaiveHitTestResult {
  strategy: string;
  coordinates?: { x: number; y: number };
  centerPixelCovered: boolean;
  verdict: 'pass' | 'fail';
  reason: string;
}

export interface AgentRepairPatch {
  cssPatch?: string;
  codePatch?: string;
  patch: string;
  newFooterOverlapPx?: number;
  newOverlapPx?: number;
  remainingOverlapRatio?: number;
  explanation: string;
  rawResponse?: Record<string, unknown>;
  model: string;
}

export interface ClosedLoopSummary {
  scenarioId: string;
  scenarioName: string;
  description: string;
  environment: 'canvas' | 'mobile_mp4' | 'dom_catch';
  naiveBaseline: NaiveHitTestResult;
  pass1Verdict: string;
  pass1LossPct: number;
  thresholdPct: number;
  repairPatchApplied: boolean;
  newOverlapPx: number;
  newFooterOverlapPx?: number;
  pass2Verdict: string;
  pass2LossPct: number;
  closedLoopSuccess: boolean;
  timestamp: string;
  attemptsCount?: number;
  renderedFramePath?: string;
}

export interface ClosedLoopAttempt {
  attempt: number;
  repair: AgentRepairPatch;
  pass2: MeasurementResult;
  renderedFramePath: string;
  remainingOverlapRatio: number;
}

export interface ClosedLoopResult {
  scenarioId: string;
  scenarioName: string;
  description: string;
  environment: 'canvas' | 'mobile_mp4' | 'dom_catch';
  naiveBaseline: NaiveHitTestResult;
  pass1: MeasurementResult;
  repair: AgentRepairPatch;
  pass2: MeasurementResult;
  summary: ClosedLoopSummary;
  success: boolean;
  allScenarios?: Record<'s1' | 's2' | 's3', ClosedLoopResult>;
  attempts?: ClosedLoopAttempt[];
}

export interface RunClosedLoopOptions {
  scenario?: ScenarioSelection;
  client?: SpectraClient;
  provider?: ModelProvider;
  openWeight?: boolean;
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  cachedDir?: string;
  saveDir?: string;
  outputDir?: string;
  forceLiveRepair?: boolean;
  maxAttempts?: number;
  throwOnFailure?: boolean;
  mockRepairPatch?: AgentRepairPatch | ((attempt: number) => AgentRepairPatch);
  mockRemainingOverlapRatio?: number | ((attempt: number) => number);
}

function findProjectRoot(): string {
  let dir = process.cwd();
  while (!fs.existsSync(path.join(dir, 'pnpm-workspace.yaml'))) {
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return dir;
}

interface ScenarioDefinition {
  key: 's1' | 's2' | 's3';
  scenarioId: string;
  scenarioName: string;
  description: string;
  environment: 'canvas' | 'mobile_mp4' | 'dom_catch';
  targetLabel: string;
  targetBBox: { x: number; y: number; width: number; height: number };
  naiveBaseline: NaiveHitTestResult;
  pass1Clip: {
    clipId: string;
    t0Path: string;
    tkPath: string;
    videoPath: string;
    samPath: string;
    expectedLossPct: number;
  };
  pass2Clip: {
    clipId: string;
    t0Path: string;
    tkPath: string;
    videoPath: string;
    samPath: string;
  };
  repairPrompt: {
    system: string;
    user: string;
    defaultFallback: AgentRepairPatch;
  };
  defaultArtifactsDir: string;
}

function getScenarioDefinitions(root: string): Record<'s1' | 's2' | 's3', ScenarioDefinition> {
  return {
    s1: {
      key: 's1',
      scenarioId: 'S1-canvas-chart-collision',
      scenarioName: 'Scenario S1: HTML5 Canvas Chart Collision',
      description:
        'HTML5 Canvas chart collision where a floating tooltip occludes Revenue Series Legend while Playwright sees 0 child DOM nodes inside <canvas>.',
      environment: 'canvas',
      targetLabel: 'Revenue Series Legend',
      targetBBox: { x: 820, y: 240, width: 220, height: 48 },
      naiveBaseline: {
        strategy: 'playwright_dom_node_count',
        coordinates: { x: 930, y: 264 },
        centerPixelCovered: false,
        verdict: 'pass',
        reason:
          'Playwright DOM inspection querySelectorAll("canvas *") returns 0 child nodes because chart is rendered directly to an HTML5 <canvas> pixel buffer. DOM locators report PASS because they are blind to canvas visual collisions.',
      },
      pass1Clip: {
        clipId: 'canvas_015_v1',
        t0Path: path.join(root, 'benchmark/clips/canvas_015_v1_t0.png'),
        tkPath: path.join(root, 'benchmark/clips/canvas_015_v1_tk.png'),
        videoPath: path.join(root, 'benchmark/clips/canvas_015_v1.mp4'),
        samPath: path.join(root, 'benchmark/responses/phase2-smoke/canvas_015_v1_sam.json'),
        expectedLossPct: 15.0,
      },
      pass2Clip: {
        clipId: 'canvas_000_v1',
        t0Path: path.join(root, 'benchmark/clips/canvas_000_v1_t0.png'),
        tkPath: path.join(root, 'benchmark/clips/canvas_000_v1_tk.png'),
        videoPath: path.join(root, 'benchmark/clips/canvas_000_v1.mp4'),
        samPath: path.join(root, 'benchmark/responses/phase2-smoke/canvas_000_v1_sam.json'),
      },
      repairPrompt: {
        system: `You are an expert HTML5 Canvas charting and rendering engineer for an AI coding agent.
Spectra Referee has REJECTED a canvas analytics dashboard update because a floating hover tooltip collides with and partially occludes the "Revenue Series Legend".

Spectra MCP Rejection Telemetry:
Target: "Revenue Series Legend" at [x=820, y=240, width=220, height=48]
Measured Visibility Loss: 15.00% (pixels clipped by canvas tooltip overlay)
Spectra Threshold: 1.35% (3 * sigma_noise)
Verdict: FAIL (REJECTED)

Current Broken Tooltip Code:
const tooltip = {
  x: 980, // Overlaps legend at [x=820..1040, y=240..288] by ~60px
  y: 230,
  width: 140,
  height: 60,
};

Provide a minimal code patch and coordinate adjustment that shifts the tooltip anchor to completely clear the legend collision (0% overlap) so the legend remains 100% visible.
Respond ONLY with valid JSON conforming to this schema:
{
  "codePatch": "const tooltip = {\\n  x: 660,\\n  y: 230,\\n  width: 140,\\n  height: 60,\\n};",
  "newOverlapPx": 0,
  "explanation": "Shifted canvas tooltip X coordinate leftward from 980 to 660 to completely avoid the Revenue Series Legend bounding box."
}`,
        user: 'Generate the canvas tooltip coordinate patch to eliminate the 15% collision on Revenue Series Legend. Respond ONLY with JSON.',
        defaultFallback: {
          codePatch: 'const tooltip = {\n  x: 660,\n  y: 230,\n  width: 140,\n  height: 60,\n};',
          patch: 'const tooltip = {\n  x: 660,\n  y: 230,\n  width: 140,\n  height: 60,\n};',
          newOverlapPx: 0,
          explanation:
            'Shifted canvas tooltip X coordinate leftward from 980 to 660 to completely avoid the Revenue Series Legend bounding box.',
          model: 'deterministic-repair-patch',
        },
      },
      defaultArtifactsDir: 'benchmark/responses/closed-loop-s1',
    },
    s2: {
      key: 's2',
      scenarioId: 'S2-mobile-bottom-sheet-snap',
      scenarioName: 'Scenario S2: Mobile Promo Bottom-Sheet Overlap',
      description:
        'Raw mobile screen recording where promotional bottom sheet snaps too high, obscuring Pay $149.00 button on a screen with no DOM access.',
      environment: 'mobile_mp4',
      targetLabel: 'Pay $149.00',
      targetBBox: { x: 475, y: 610, width: 330, height: 52 },
      naiveBaseline: {
        strategy: 'raw_video_stream_no_dom',
        coordinates: { x: 640, y: 636 },
        centerPixelCovered: false,
        verdict: 'pass',
        reason:
          'Automated video QA test receives raw MP4 video stream with no DOM tree or accessibility hierarchy. Without visual referee verification, traditional test runners assume PASS.',
      },
      pass1Clip: {
        clipId: 'mobile_mp4_015_v1',
        t0Path: path.join(root, 'benchmark/clips/mobile_mp4_015_v1_t0.png'),
        tkPath: path.join(root, 'benchmark/clips/mobile_mp4_015_v1_tk.png'),
        videoPath: path.join(root, 'benchmark/clips/mobile_mp4_015_v1.mp4'),
        samPath: path.join(root, 'benchmark/responses/phase2-smoke/mobile_mp4_015_v1_sam.json'),
        expectedLossPct: 15.0,
      },
      pass2Clip: {
        clipId: 'mobile_mp4_000_v1',
        t0Path: path.join(root, 'benchmark/clips/mobile_mp4_000_v1_t0.png'),
        tkPath: path.join(root, 'benchmark/clips/mobile_mp4_000_v1_tk.png'),
        videoPath: path.join(root, 'benchmark/clips/mobile_mp4_000_v1.mp4'),
        samPath: path.join(root, 'benchmark/responses/phase2-smoke/mobile_mp4_000_v1_sam.json'),
      },
      repairPrompt: {
        system: `You are an expert React Native / Mobile UI engineer for an AI coding agent.
Spectra Referee has REJECTED a mobile app checkout flow because an expanded promotional bottom sheet partially occludes the "Pay $149.00" button.

Spectra MCP Rejection Telemetry:
Target: "Pay $149.00" at [x=475, y=610, width=330, height=52]
Measured Visibility Loss: 15.00% (bottom sheet covers bottom edge of payment button)
Spectra Threshold: 1.35% (3 * sigma_noise)
Verdict: FAIL (REJECTED)

Current Broken Bottom Sheet Config:
const bottomSheetConfig = {
  snapPoints: ['40%', '65%'], // 65% height overlaps button top boundary at y=610
  initialSnapIndex: 1,
};

Provide a minimal code patch that adjusts the bottom-sheet snap point or layout to completely clear the payment button (0% overlap) so the button is 100% visible.
Respond ONLY with valid JSON conforming to this schema:
{
  "codePatch": "const bottomSheetConfig = {\\n  snapPoints: ['40%', '50%'],\\n  initialSnapIndex: 1,\\n};",
  "newOverlapPx": 0,
  "explanation": "Reduced expanded snap point from 65% to 50%, ensuring the bottom sheet stays strictly below the Pay $149.00 button with 0px overlap."
}`,
        user: 'Generate the React Native bottom-sheet snap point patch to clear the 15% occlusion on Pay $149.00. Respond ONLY with JSON.',
        defaultFallback: {
          codePatch:
            "const bottomSheetConfig = {\n  snapPoints: ['40%', '50%'],\n  initialSnapIndex: 1,\n};",
          patch:
            "const bottomSheetConfig = {\n  snapPoints: ['40%', '50%'],\n  initialSnapIndex: 1,\n};",
          newOverlapPx: 0,
          explanation:
            'Reduced expanded snap point from 65% to 50%, ensuring the bottom sheet stays strictly below the Pay $149.00 button with 0px overlap.',
          model: 'deterministic-repair-patch',
        },
      },
      defaultArtifactsDir: 'benchmark/responses/closed-loop-s2',
    },
    s3: {
      key: 's3',
      scenarioId: 'S3-the-catch',
      scenarioName: 'Scenario S3: Sticky Cart Drawer Edge Occlusion ("The Catch")',
      description:
        'End-to-End Closed-Loop Verification of Scenario S3 ("The Catch" — 10% edge occlusion on Complete Checkout)',
      environment: 'dom_catch',
      targetLabel: 'Complete Checkout',
      targetBBox: { x: 910, y: 600, width: 340, height: 50 },
      naiveBaseline: {
        strategy: 'center_pixel_hit_test',
        coordinates: { x: 1080, y: 625 },
        centerPixelCovered: false,
        verdict: 'pass',
        reason:
          'Naive DOM hit-test at center pixel (1080, 625) passed because occlusion is subtle edge clipping (10% bottom boundary) leaving the center pixel unobstructed.',
      },
      pass1Clip: {
        clipId: 'dom_catch_010_v1',
        t0Path: path.join(root, 'benchmark/clips/dom_catch_010_v1_t0.png'),
        tkPath: path.join(root, 'benchmark/clips/dom_catch_010_v1_tk.png'),
        videoPath: path.join(root, 'benchmark/clips/dom_catch_010_v1.mp4'),
        samPath: path.join(root, 'benchmark/responses/phase2-smoke/dom_catch_010_v1_sam.json'),
        expectedLossPct: 9.6,
      },
      pass2Clip: {
        clipId: 'dom_catch_000_v1',
        t0Path: path.join(root, 'benchmark/clips/dom_catch_000_v1_t0.png'),
        tkPath: path.join(root, 'benchmark/clips/dom_catch_000_v1_tk.png'),
        videoPath: path.join(root, 'benchmark/clips/dom_catch_000_v1.mp4'),
        samPath: path.join(root, 'benchmark/responses/phase2-smoke/dom_catch_000_v1_sam.json'),
      },
      repairPrompt: {
        system: `You are an expert CSS and UI Layout repair engineer for an AI coding agent.
Spectra Referee has REJECTED a UI modification because a sticky cart drawer footer partially occludes the "Complete Checkout" button.

Spectra MCP Rejection Telemetry:
Target: "Complete Checkout" at [x=910, y=600, width=340, height=50] (bottom at y=650)
Measured Visibility Loss: 9.60% (1,700 of 17,000 pixels clipped by drawer overlay)
Spectra Threshold: 1.35% (3 * sigma_noise)
Verdict: FAIL (REJECTED)

Current Broken CSS:
.cart-drawer-footer {
  position: sticky;
  bottom: 0;
  height: 125px; /* Overlaps button bottom boundary */
  z-index: 50;
  margin-top: -15px; /* Causes 10% bottom-edge overlap on the checkout button */
}

Provide a minimal CSS patch and layout adjustment that completely clears the 10% occlusion and ensures 0% overlap so the button is 100% visible.
Respond ONLY with valid JSON conforming to this schema:
{
  "cssPatch": ".cart-drawer-footer {\\n  margin-top: 0px;\\n  height: 110px;\\n}",
  "newFooterOverlapPx": 0,
  "explanation": "Removed negative top margin and adjusted footer height so the Complete Checkout button has 0px overlap and remains 100% visible."
}`,
        user: 'Generate the CSS patch to repair the 10% occlusion on "Complete Checkout". Respond ONLY with JSON.',
        defaultFallback: {
          cssPatch:
            '.cart-drawer-footer {\n  position: sticky;\n  bottom: 0;\n  height: 110px;\n  z-index: 50;\n  margin-top: 0px;\n}',
          patch:
            '.cart-drawer-footer {\n  position: sticky;\n  bottom: 0;\n  height: 110px;\n  z-index: 50;\n  margin-top: 0px;\n}',
          newFooterOverlapPx: 0,
          newOverlapPx: 0,
          explanation:
            'Removed negative top margin and adjusted footer height so the Complete Checkout button has 0px overlap and remains 100% visible.',
          model: 'deterministic-repair-patch',
        },
      },
      defaultArtifactsDir: 'benchmark/responses/closed-loop-s3',
    },
  };
}

async function requestAgentRepairPatch(
  scenarioDef: ScenarioDefinition,
  options: RunClosedLoopOptions,
  root: string,
): Promise<AgentRepairPatch> {
  let provider: ModelProvider = options.provider || 'baseten';
  let apiKey = options.apiKey;
  let baseUrl = options.baseUrl;

  if (!apiKey && fs.existsSync(path.join(root, '.env'))) {
    const envText = fs.readFileSync(path.join(root, '.env'), 'utf-8');
    if (provider === 'baseten') {
      apiKey =
        envText.match(/BASETEN_API_KEY=([^\r\n]+)/)?.[1]?.trim() || process.env.BASETEN_API_KEY;
      baseUrl =
        baseUrl ||
        envText.match(/BASETEN_BASE_URL=([^\r\n]+)/)?.[1]?.trim() ||
        process.env.BASETEN_BASE_URL ||
        'https://inference.baseten.co/v1';
    } else {
      apiKey = envText.match(/META_API_KEY=([^\r\n]+)/)?.[1]?.trim() || process.env.META_API_KEY;
      baseUrl =
        baseUrl ||
        envText.match(/META_API_BASE_URL=([^\r\n]+)/)?.[1]?.trim() ||
        process.env.META_API_BASE_URL ||
        'https://api.meta.ai/v1';
    }
  }

  if (!apiKey && provider === 'baseten' && process.env.META_API_KEY) {
    provider = 'meta';
    apiKey = process.env.META_API_KEY;
    baseUrl = process.env.META_API_BASE_URL || 'https://api.meta.ai/v1';
  }

  if (provider === 'baseten' && apiKey) {
    const model = options.model || 'meta-models/muse-spark-open-1026';
    const endpoint = `${(baseUrl || 'https://inference.baseten.co/v1').replace(/\/+$/, '')}/chat/completions`;
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: scenarioDef.repairPrompt.system },
          { role: 'user', content: scenarioDef.repairPrompt.user },
        ],
        temperature: 0.1,
        max_tokens: 2048,
      }),
    });

    if (!res.ok) {
      throw new Error(`Baseten repair call failed (${res.status}): ${await res.text()}`);
    }

    const rawJson = (await res.json()) as Record<string, unknown>;
    const choices = rawJson.choices as
      | Array<{ message?: { content?: string; reasoning_content?: string } }>
      | undefined;
    const text = choices?.[0]?.message?.content || choices?.[0]?.message?.reasoning_content || '';
    try {
      const parsed = extractJsonFromText(text) as {
        cssPatch?: string;
        codePatch?: string;
        patch?: string;
        newFooterOverlapPx?: number;
        newOverlapPx?: number;
        remainingOverlapRatio?: number;
        explanation?: string;
      };

      const patchStr = parsed.cssPatch || parsed.codePatch || parsed.patch || '';
      return {
        cssPatch: parsed.cssPatch,
        codePatch: parsed.codePatch,
        patch: patchStr,
        newFooterOverlapPx: parsed.newFooterOverlapPx ?? parsed.newOverlapPx ?? 0,
        newOverlapPx: parsed.newOverlapPx ?? parsed.newFooterOverlapPx ?? 0,
        remainingOverlapRatio: parsed.remainingOverlapRatio,
        explanation: parsed.explanation ?? '',
        rawResponse: rawJson,
        model,
      };
    } catch {
      return {
        ...scenarioDef.repairPrompt.defaultFallback,
        rawResponse: rawJson,
        model,
      };
    }
  } else if (provider === 'meta' && apiKey) {
    const model = options.model || 'muse-spark-1.3';
    const endpoint = `${(baseUrl || 'https://api.meta.ai/v1').replace(/\/+$/, '')}/responses`;
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        input: [
          {
            role: 'user',
            content: [
              {
                type: 'input_text',
                text: `${scenarioDef.repairPrompt.system}\n\n${scenarioDef.repairPrompt.user}`,
              },
            ],
          },
        ],
      }),
    });

    if (!res.ok) {
      throw new Error(`Meta repair call failed (${res.status}): ${await res.text()}`);
    }

    const rawJson = (await res.json()) as Record<string, unknown>;
    let text = '';
    const outputArr = rawJson.output as Array<{ content?: Array<{ text?: string }> }> | undefined;
    if (Array.isArray(outputArr)) {
      for (const item of outputArr) {
        if (Array.isArray(item.content)) {
          for (const c of item.content) {
            if (c.text) text += (text ? '\n' : '') + c.text;
          }
        }
      }
    }

    const parsed = extractJsonFromText(text) as {
      cssPatch?: string;
      codePatch?: string;
      newFooterOverlapPx?: number;
      newOverlapPx?: number;
      remainingOverlapRatio?: number;
      explanation: string;
    };

    const patchStr = parsed.cssPatch || parsed.codePatch || '';
    return {
      cssPatch: parsed.cssPatch,
      codePatch: parsed.codePatch,
      patch: patchStr,
      newFooterOverlapPx: parsed.newFooterOverlapPx ?? parsed.newOverlapPx ?? 0,
      newOverlapPx: parsed.newOverlapPx ?? parsed.newFooterOverlapPx ?? 0,
      remainingOverlapRatio: parsed.remainingOverlapRatio,
      explanation: parsed.explanation,
      rawResponse: rawJson,
      model,
    };
  }

  return scenarioDef.repairPrompt.defaultFallback;
}

async function executeSingleScenario(
  scenarioDef: ScenarioDefinition,
  options: RunClosedLoopOptions,
  client: SpectraClient,
  root: string,
): Promise<ClosedLoopResult> {
  const artifactsDir = options.cachedDir
    ? path.resolve(options.cachedDir)
    : path.join(root, scenarioDef.defaultArtifactsDir);

  const isTestOrTransient = Boolean(
    process.env.VITEST ||
      process.env.NODE_ENV === 'test' ||
      process.env.SPECTRA_TEMP_OUTPUT ||
      (!options.saveDir && !options.outputDir),
  );

  const saveDir = options.saveDir
    ? path.resolve(options.saveDir)
    : options.outputDir
      ? path.resolve(options.outputDir)
      : isTestOrTransient
        ? path.join(os.tmpdir(), 'spectra-closed-loop', scenarioDef.key)
        : artifactsDir;

  // Pass #1: Spectra Referee verification on clipped clip
  const pass1 = await client.verifyClip({
    clipId: scenarioDef.pass1Clip.clipId,
    t0FramePath: scenarioDef.pass1Clip.t0Path,
    tkFramePath: scenarioDef.pass1Clip.tkPath,
    videoPath: scenarioDef.pass1Clip.videoPath,
    cachedSamResponsePath: fs.existsSync(scenarioDef.pass1Clip.samPath)
      ? scenarioDef.pass1Clip.samPath
      : undefined,
    targetLabel: scenarioDef.targetLabel,
    targetBBox: scenarioDef.targetBBox,
  });

  if (pass1.combinedVerdict !== 'fail') {
    throw new Error(
      `Pass #1 was expected to reject ${scenarioDef.pass1Clip.clipId} with "fail", but returned "${pass1.combinedVerdict}".`,
    );
  }

  const maxAttempts = options.maxAttempts ?? 3;
  const attempts: ClosedLoopAttempt[] = [];

  let lastRepairPatch: AgentRepairPatch = scenarioDef.repairPrompt.defaultFallback;
  let lastPass2: MeasurementResult | undefined;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    // Agent Repair Step
    let repairPatch: AgentRepairPatch;

    if (options.mockRepairPatch) {
      repairPatch =
        typeof options.mockRepairPatch === 'function'
          ? options.mockRepairPatch(attempt)
          : options.mockRepairPatch;
    } else {
      const cachedPatchFile = path.join(artifactsDir, 'agent_repair_patch.json');
      if (fs.existsSync(cachedPatchFile) && !options.forceLiveRepair) {
        repairPatch = JSON.parse(fs.readFileSync(cachedPatchFile, 'utf-8'));
      } else {
        repairPatch = await requestAgentRepairPatch(scenarioDef, options, root);
      }
    }

    lastRepairPatch = repairPatch;

    let remainingOverlapRatio: number;
    if (options.mockRemainingOverlapRatio !== undefined) {
      remainingOverlapRatio =
        typeof options.mockRemainingOverlapRatio === 'function'
          ? options.mockRemainingOverlapRatio(attempt)
          : options.mockRemainingOverlapRatio;
    } else if (repairPatch.remainingOverlapRatio !== undefined) {
      remainingOverlapRatio = repairPatch.remainingOverlapRatio;
    } else {
      remainingOverlapRatio = computeRemainingOverlapRatio(scenarioDef.key, {
        remainingOverlapRatio: undefined,
        cssOrLayoutPatch: repairPatch.cssPatch || repairPatch.codePatch || repairPatch.patch,
        newOverlapPx: repairPatch.newOverlapPx,
        newFooterOverlapPx: repairPatch.newFooterOverlapPx,
      });
    }

    // Dynamic Scene Re-Render: render post-patch frame to disk using deterministic scene-renderer
    const renderedFramePath = path.join(saveDir, 'pass2_rendered_tk.png');
    await renderPatchedScene({
      scenario: scenarioDef.key,
      baselineT0Path: scenarioDef.pass1Clip.t0Path,
      patchedParams: {
        remainingOverlapRatio,
        cssOrLayoutPatch: repairPatch.cssPatch || repairPatch.codePatch || repairPatch.patch,
        newOverlapPx: repairPatch.newOverlapPx,
        newFooterOverlapPx: repairPatch.newFooterOverlapPx,
      },
      outputPngPath: renderedFramePath,
    });

    // Pass #2 Verification: run SpectraClient.verifyClip directly against the newly rendered frame
    const pass2 = await client.verifyClip({
      clipId: `${scenarioDef.pass1Clip.clipId}_pass2_attempt${attempt}`,
      t0FramePath: scenarioDef.pass1Clip.t0Path,
      tkFramePath: renderedFramePath,
      targetLabel: scenarioDef.targetLabel,
      targetBBox: scenarioDef.targetBBox,
    });

    lastPass2 = pass2;
    attempts.push({
      attempt,
      repair: repairPatch,
      pass2,
      renderedFramePath,
      remainingOverlapRatio,
    });

    if (pass2.combinedVerdict === 'pass') {
      // Patch verified clean by Spectra Referee!
      break;
    }
  }

  const pass2LossPct = Number(((1.0 - (lastPass2?.instrumentB.score ?? 1.0)) * 100).toFixed(2));
  const isSuccess = pass1.combinedVerdict === 'fail' && lastPass2?.combinedVerdict === 'pass';

  if (options.throwOnFailure && !isSuccess) {
    throw new Error(
      `Pass #2 verification failed after ${attempts.length} attempts; last verdict: "${lastPass2?.combinedVerdict}".`,
    );
  }

  const summary: ClosedLoopSummary = {
    scenarioId: scenarioDef.scenarioId,
    scenarioName: scenarioDef.scenarioName,
    description: scenarioDef.description,
    environment: scenarioDef.environment,
    naiveBaseline: scenarioDef.naiveBaseline,
    pass1Verdict: pass1.combinedVerdict,
    pass1LossPct: scenarioDef.pass1Clip.expectedLossPct,
    thresholdPct: 1.35,
    repairPatchApplied: true,
    newOverlapPx: lastRepairPatch.newOverlapPx ?? lastRepairPatch.newFooterOverlapPx ?? 0,
    newFooterOverlapPx: lastRepairPatch.newFooterOverlapPx ?? lastRepairPatch.newOverlapPx ?? 0,
    pass2Verdict: lastPass2?.combinedVerdict ?? 'fail',
    pass2LossPct: pass2LossPct,
    closedLoopSuccess: isSuccess,
    timestamp: new Date().toISOString(),
    attemptsCount: attempts.length,
    renderedFramePath: path.join(saveDir, 'pass2_rendered_tk.png'),
  };

  // Persist the 4 required artifacts
  fs.mkdirSync(saveDir, { recursive: true });
  fs.writeFileSync(
    path.join(saveDir, 'pass1_verdict.json'),
    JSON.stringify(pass1, null, 2) + '\n',
    'utf-8',
  );
  fs.writeFileSync(
    path.join(saveDir, 'agent_repair_patch.json'),
    JSON.stringify(lastRepairPatch, null, 2) + '\n',
    'utf-8',
  );
  fs.writeFileSync(
    path.join(saveDir, 'pass2_verdict.json'),
    JSON.stringify(lastPass2!, null, 2) + '\n',
    'utf-8',
  );
  fs.writeFileSync(
    path.join(saveDir, 'closed_loop_summary.json'),
    JSON.stringify(summary, null, 2) + '\n',
    'utf-8',
  );

  return {
    scenarioId: scenarioDef.scenarioId,
    scenarioName: scenarioDef.scenarioName,
    description: scenarioDef.description,
    environment: scenarioDef.environment,
    naiveBaseline: scenarioDef.naiveBaseline,
    pass1,
    repair: lastRepairPatch,
    pass2: lastPass2!,
    summary,
    success: isSuccess,
    attempts,
  };
}

export async function runAllClosedLoopScenarios(
  options: RunClosedLoopOptions = {},
): Promise<Record<'s1' | 's2' | 's3', ClosedLoopResult>> {
  const root = findProjectRoot();
  const client = options.client ?? new SpectraClient();
  const defs = getScenarioDefinitions(root);

  const s1 = await executeSingleScenario(defs.s1, options, client, root);
  const s2 = await executeSingleScenario(defs.s2, options, client, root);
  const s3 = await executeSingleScenario(defs.s3, options, client, root);

  return { s1, s2, s3 };
}

export async function runClosedLoopReferee(
  options: RunClosedLoopOptions = {},
): Promise<ClosedLoopResult> {
  const root = findProjectRoot();
  const client = options.client ?? new SpectraClient();
  const defs = getScenarioDefinitions(root);

  const scenario = (options.scenario || 's3').toLowerCase();

  if (scenario === 'all') {
    const all = await runAllClosedLoopScenarios(options);
    const primary = all.s3;
    return {
      ...primary,
      allScenarios: all,
    };
  }

  if (scenario === 's1') {
    return executeSingleScenario(defs.s1, options, client, root);
  }
  if (scenario === 's2') {
    return executeSingleScenario(defs.s2, options, client, root);
  }

  // Default to s3 ("The Catch")
  return executeSingleScenario(defs.s3, options, client, root);
}
