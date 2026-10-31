import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { EventEmitter } from 'node:events';
import type { IncomingMessage, ServerResponse } from 'node:http';
import {
  bundleWorkbenchData,
  handleApiStatus,
  handleVerifyLive,
  handleClosedLoopLive,
  handleCompileVoice,
  handleSaveInvariant,
  handleExplainVerdict,
  spectraApiMiddleware,
  type WorkbenchDataBundle,
  type LiveVideoVerifyApiResponse,
} from '../index.js';

function createMockReqRes(options: { method?: string; url?: string; body?: unknown }): {
  req: IncomingMessage;
  res: ServerResponse;
  getResult: () => Promise<{ statusCode: number; data: unknown }>;
} {
  let bodyEmitted = false;
  const req = new EventEmitter() as unknown as IncomingMessage;
  req.method = options.method || 'GET';
  req.url = options.url || '/api/status';

  const emitBody = () => {
    if (bodyEmitted) return;
    bodyEmitted = true;
    process.nextTick(() => {
      if (options.body !== undefined) {
        req.emit('data', Buffer.from(JSON.stringify(options.body)));
      }
      req.emit('end');
    });
  };

  req.on('newListener', (event) => {
    if (event === 'data' || event === 'end') {
      emitBody();
    }
  });

  let statusCode = 200;
  let responseData = '';
  let finished = false;
  const finishCallbacks: Array<() => void> = [];

  const res = {
    get statusCode() {
      return statusCode;
    },
    set statusCode(val: number) {
      statusCode = val;
    },
    setHeader: () => {},
    end: (chunk?: string) => {
      if (chunk) responseData += chunk;
      finished = true;
      for (const cb of finishCallbacks) cb();
    },
  } as unknown as ServerResponse;

  const getResult = (): Promise<{ statusCode: number; data: unknown }> => {
    if (options.body === undefined) {
      emitBody();
    }
    return new Promise((resolve) => {
      const finish = () => {
        let parsed: unknown = responseData;
        try {
          parsed = JSON.parse(responseData);
        } catch {
          // Keep as string
        }
        resolve({ statusCode, data: parsed });
      };

      if (finished) {
        finish();
      } else {
        finishCallbacks.push(finish);
      }
    });
  };

  return { req, res, getResult };
}

describe('@spectra/workbench - Data Bundle & Offline Replay ($0.00 Spend)', () => {
  const workspaceRoot = path.resolve(__dirname, '../../../../');
  const publicDataPath = path.join(
    workspaceRoot,
    'packages',
    'workbench',
    'public',
    'workbench-data.json',
  );

  it('generates and validates the workbench asset bundle', async () => {
    const bundle: WorkbenchDataBundle = fs.existsSync(publicDataPath)
      ? JSON.parse(fs.readFileSync(publicDataPath, 'utf-8'))
      : await bundleWorkbenchData();

    expect(bundle).toBeDefined();
    expect(bundle.version).toBe('1.0');
    expect(bundle.calibration.sigma_noise).toBe(0.0045);
    expect(bundle.calibration.delta).toBe(0.041);
    expect(bundle.calibration.threshold).toBeCloseTo(0.0135, 4);

    // 45 benchmark clips
    expect(bundle.clips).toHaveLength(45);

    // Check that at least 21 clips have decoded SAM masks
    const samClips = bundle.clips.filter(
      (c) => c.samAvailable && c.allMasks && c.allMasks.length > 0,
    );
    expect(samClips.length).toBeGreaterThanOrEqual(21);

    // Verify SVG vector path structure
    for (const sc of samClips) {
      expect(sc.allMasks).toHaveLength(8);
      expect(sc.t0Mask).toBeDefined();
      expect(sc.tkMask).toBeDefined();
      for (const m of sc.allMasks!) {
        expect(m.frameIndex).toBeGreaterThanOrEqual(0);
        expect(m.frameIndex).toBeLessThanOrEqual(7);
        expect(m.svgPath).toMatch(/^M/);
        expect(m.svgPath).toContain('Z');
        expect(m.bounds.right).toBeGreaterThan(m.bounds.left);
        expect(m.bounds.bottom).toBeGreaterThan(m.bounds.top);
        expect(m.area).toBeGreaterThan(0);
      }
    }
  });

  it('bundles all 3 closed-loop scenarios with telemetry and repair patches', () => {
    const bundle: WorkbenchDataBundle = JSON.parse(fs.readFileSync(publicDataPath, 'utf-8'));

    const { s1, s2, s3 } = bundle.scenarios;
    expect(s1).toBeDefined();
    expect(s2).toBeDefined();
    expect(s3).toBeDefined();

    // S1: Canvas
    expect(s1.scenarioId).toBe('s1');
    expect(s1.environment).toBe('canvas');
    expect(s1.pass1.verdict.combinedVerdict).toBe('fail');
    expect(s1.pass2.verdict.combinedVerdict).toBe('pass');
    expect(s1.pass1.masks).toBeDefined();
    expect(s1.pass2.masks).toBeDefined();
    expect(s1.repairPatch.rawPatch).toBeDefined();

    // S2: Mobile MP4
    expect(s2.scenarioId).toBe('s2');
    expect(s2.environment).toBe('mobile_mp4');
    expect(s2.pass1.verdict.combinedVerdict).toBe('fail');
    expect(s2.pass2.verdict.combinedVerdict).toBe('pass');
    expect(s2.repairPatch.rawPatch).toBeDefined();

    // S3: DOM Catch
    expect(s3.scenarioId).toBe('s3');
    expect(s3.environment).toBe('dom_catch');
    expect(s3.pass1.verdict.combinedVerdict).toBe('fail');
    expect(s3.pass2.verdict.combinedVerdict).toBe('pass');
    expect(s3.repairPatch.rawPatch).toBeDefined();
  });

  it('embeds invariants, voice transcript, and referee benchmark report', () => {
    const bundle: WorkbenchDataBundle = JSON.parse(fs.readFileSync(publicDataPath, 'utf-8'));

    const invariants = (bundle.invariants as { invariants?: Array<{ id: string }> }).invariants;
    expect(Array.isArray(invariants)).toBe(true);
    expect(invariants!.length).toBeGreaterThanOrEqual(2);

    const transcript = (bundle.voiceTranscript as { transcript?: string }).transcript;
    expect(transcript).toContain('cart drawer');

    expect(bundle.benchmarkReport).toBeDefined();
    expect(bundle.benchmarkReport.summary).toBeDefined();
  });

  it('bundles benchmark summary matching 94.4%, 44.4%, 61.1%, and 0.0% false-pass rates and 1.11% MAE', () => {
    const bundle: WorkbenchDataBundle = JSON.parse(fs.readFileSync(publicDataPath, 'utf-8'));
    const summary = bundle.benchmarkReport.summary as {
      spectraMae: number;
      evaluatorSummaries: {
        dom_hit_test: { overallFalsePassRate: number };
        vlm_open_weight: { overallFalsePassRate: number };
        vlm_flagship: { overallFalsePassRate: number };
        spectra_referee: { overallFalsePassRate: number };
      };
    };

    expect(summary).toBeDefined();
    expect((summary.spectraMae * 100).toFixed(2)).toBe('1.11');

    const ev = summary.evaluatorSummaries;
    expect((ev.dom_hit_test.overallFalsePassRate * 100).toFixed(1)).toBe('94.4');
    expect((ev.vlm_open_weight.overallFalsePassRate * 100).toFixed(1)).toBe('44.4');
    expect((ev.vlm_flagship.overallFalsePassRate * 100).toFixed(1)).toBe('61.1');
    expect((ev.spectra_referee.overallFalsePassRate * 100).toFixed(1)).toBe('0.0');
  });
});

describe('@spectra/workbench - Local API Server Middleware Tests ($0.00 Spend)', () => {
  const workspaceRoot = path.resolve(__dirname, '../../../../');

  it('GET /api/status returns calibration parameters and provider status', async () => {
    const { req, res, getResult } = createMockReqRes({
      method: 'GET',
      url: '/api/status',
    });

    await handleApiStatus(req, res);
    const result = await getResult();

    expect(result.statusCode).toBe(200);
    const data = result.data as {
      status: string;
      calibration: { sigma_noise: number; delta: number; threshold: number };
      providers: { meta: { model: string }; baseten: { model: string } };
    };
    expect(data.status).toBe('ok');
    expect(data.calibration.sigma_noise).toBe(0.0045);
    expect(data.calibration.delta).toBe(0.041);
    expect(data.calibration.threshold).toBeCloseTo(0.0135, 4);
    expect(data.providers.meta.model).toBe('sam-3.1');
    expect(data.providers.baseten.model).toBe('meta-models/muse-spark-open-1026');
  });

  it('POST /api/verify-live verifies clip offline using cached SAM masks', async () => {
    const t0Path = path.join(workspaceRoot, 'benchmark/clips/canvas_000_v1_t0.png');
    const tkPath = path.join(workspaceRoot, 'benchmark/clips/canvas_000_v1_tk.png');
    const videoPath = path.join(workspaceRoot, 'benchmark/clips/canvas_000_v1.mp4');
    const cachedSamPath = path.join(
      workspaceRoot,
      'benchmark/responses/benchmark-sam/canvas_000_v1_sam.json',
    );

    const { req, res, getResult } = createMockReqRes({
      method: 'POST',
      url: '/api/verify-live',
      body: {
        t0FramePath: t0Path,
        tkFramePath: tkPath,
        videoPath,
        targetLabel: 'Revenue Series Legend',
        targetBBox: [820, 240, 220, 48],
        cachedSamResponsePath: cachedSamPath,
      },
    });

    await handleVerifyLive(req, res);
    const result = await getResult();

    expect(result.statusCode).toBe(200);
    const data = result.data as {
      combinedVerdict: string;
      instrumentA: { score: number };
      instrumentB: { raw: { pixelLossCount: number } };
    };
    expect(data.combinedVerdict).toBe('pass');
    expect(data.instrumentA.score).toBeGreaterThan(0.98);
    expect(data.instrumentB.raw.pixelLossCount).toBe(0);
  });

  it('POST /api/verify-live verifies uploaded single MP4 video with auto-bbox and SVG telemetry ($0.00 spend)', async () => {
    const videoFilePath = path.join(workspaceRoot, 'benchmark/clips/dom_catch_010_v1.mp4');
    const videoBuffer = fs.readFileSync(videoFilePath);
    const videoBase64 = videoBuffer.toString('base64');

    const { req, res, getResult } = createMockReqRes({
      method: 'POST',
      url: '/api/verify-live',
      body: {
        videoBase64,
        videoFileName: 'dom_catch_010_v1.mp4',
        targetLabel: 'Complete Checkout',
      },
    });

    await handleVerifyLive(req, res);
    const result = await getResult();

    expect(result.statusCode).toBe(200);
    const data = result.data as LiveVideoVerifyApiResponse;

    expect(data.verdict).toBe('fail');
    expect(data.resolvedBBox).toBeDefined();
    expect(data.resolvedBBox.x).toBeGreaterThanOrEqual(909);
    expect(data.resolvedBBox.x).toBeLessThanOrEqual(910);
    expect(data.resolvedBBox.y).toBe(600);
    expect(data.resolvedBBox.width).toBeGreaterThanOrEqual(340);
    expect(data.resolvedBBox.width).toBeLessThanOrEqual(342);
    expect(data.resolvedBBox.height).toBeGreaterThanOrEqual(50);
    expect(data.resolvedBBox.height).toBeLessThanOrEqual(51);

    expect(data.t0DataUrl).toMatch(/^data:image\/png;base64,/);
    expect(data.tkDataUrl).toMatch(/^data:image\/png;base64,/);
    expect(data.tkSvgMaskPath).toMatch(/^M/);
    expect(data.pipelineStages).toHaveLength(4);
    expect(data.pipelineStages.map((s) => s.id)).toEqual([
      'frame_extract',
      'sam_segment',
      'pixel_match',
      'referee_verdict',
    ]);
    expect(data.cliCommandEquivalent).toContain('spectra verify --video');
    expect((data.mcpPayloadEquivalent as { params: { name: string } }).params.name).toBe(
      'spectra_verify',
    );
  });

  it('POST /api/closed-loop-live replays scenario s3 and returns live trace with rendered frame ($0.00 spend)', async () => {
    const { req, res, getResult } = createMockReqRes({
      method: 'POST',
      url: '/api/closed-loop-live',
      body: {
        scenario: 's3',
      },
    });

    await handleClosedLoopLive(req, res);
    const result = await getResult();

    expect(result.statusCode).toBe(200);
    const data = result.data as {
      closedLoopSuccess: boolean;
      scenarioId: string;
      pass1: { combinedVerdict: string };
      pass2: { combinedVerdict: string };
      pass2RenderedDataUrl?: string;
    };

    expect(data.closedLoopSuccess).toBe(true);
    expect(data.scenarioId).toBe('S3-the-catch');
    expect(data.pass1.combinedVerdict).toBe('fail');
    expect(data.pass2.combinedVerdict).toBe('pass');
    expect(data.pass2RenderedDataUrl).toMatch(/^data:image\/png;base64,/);
  });

  it('POST /api/compile-voice returns 400 when body lacks required fields', async () => {
    const { req, res, getResult } = createMockReqRes({
      method: 'POST',
      url: '/api/compile-voice',
      body: {},
    });

    await handleCompileVoice(req, res);
    const result = await getResult();

    expect(result.statusCode).toBe(400);
    const data = result.data as { error: string };
    expect(data.error).toContain('Either transcript or audioBase64 must be provided');
  });

  it('spectraApiMiddleware routes known endpoints and forwards unknown paths via next()', async () => {
    const middleware = spectraApiMiddleware();

    // Unknown endpoint
    const { req, res } = createMockReqRes({
      method: 'GET',
      url: '/index.html',
    });

    let nextCalled = false;
    await middleware(req, res, () => {
      nextCalled = true;
    });

    expect(nextCalled).toBe(true);
  });

  it('POST /api/save-invariant saves reference UI invariant to .spectra/invariants.json', async () => {
    const invPath = path.join(workspaceRoot, '.spectra', 'invariants.json');
    const originalContent = fs.existsSync(invPath) ? fs.readFileSync(invPath, 'utf-8') : null;

    try {
      const { req, res, getResult } = createMockReqRes({
        method: 'POST',
        url: '/api/save-invariant',
        body: {
          target: 'Checkout CTA Reference',
          description:
            'Checkout CTA Reference must remain visible (>= 98.65% retained) at [910, 600, 340, 50]',
          bbox: [910, 600, 340, 50],
          minVisibility: 0.9865,
        },
      });

      await handleSaveInvariant(req, res);
      const result = await getResult();

      expect(result.statusCode).toBe(200);
      const data = result.data as {
        success: boolean;
        invariant: { id: string; matcher: { target: string } };
      };
      expect(data.success).toBe(true);
      expect(data.invariant.matcher.target).toBe('Checkout CTA Reference');
    } finally {
      if (originalContent !== null) {
        fs.writeFileSync(invPath, originalContent, 'utf-8');
      }
    }
  });

  it('MODEL_VERIFICATION.md Path Existence Test: every referenced benchmark and package file exists', () => {
    const docPath = path.join(workspaceRoot, 'docs', 'MODEL_VERIFICATION.md');
    expect(fs.existsSync(docPath)).toBe(true);
    const content = fs.readFileSync(docPath, 'utf-8');

    const pathRegex = /`((?:benchmark|packages)\/[^`]+)`/g;
    const matches: string[] = [];
    let match;
    while ((match = pathRegex.exec(content)) !== null) {
      matches.push(match[1]);
    }

    expect(matches.length).toBeGreaterThan(0);
    for (const relPath of matches) {
      const fullPath = path.resolve(workspaceRoot, relPath);
      expect(
        fs.existsSync(fullPath),
        `Referenced file in MODEL_VERIFICATION.md does not exist: ${relPath}`,
      ).toBe(true);
    }
  });

  it('BenchmarkView.tsx No-Competitor-Mislabel Test: zero occurrences of GPT-4o or Claude', () => {
    const benchmarkViewPath = path.join(
      workspaceRoot,
      'packages',
      'workbench',
      'src',
      'components',
      'BenchmarkView.tsx',
    );
    expect(fs.existsSync(benchmarkViewPath)).toBe(true);
    const code = fs.readFileSync(benchmarkViewPath, 'utf-8');

    expect(code).not.toContain('GPT-4o');
    expect(code).not.toContain('gpt-4o');
    expect(code).not.toContain('Claude');
    expect(code).not.toContain('Anthropic');
    expect(code).not.toContain('OpenAI');

    expect(code).toContain('Muse Spark 1.3');
    expect(code).toContain('Muse Spark Open 1026');
    expect(code).toContain('Spectra Dual-Instrument Referee');
    expect(code).toContain('DOM Center Hit-Test');
  });

  it('POST /api/save-invariant Payload Shapes Test: accepts both flat and nested invariant structures', async () => {
    const invPath = path.join(workspaceRoot, '.spectra', 'invariants.json');
    const originalContent = fs.existsSync(invPath) ? fs.readFileSync(invPath, 'utf-8') : null;

    try {
      // 1. Flat payload shape
      const flatTest = createMockReqRes({
        method: 'POST',
        url: '/api/save-invariant',
        body: {
          target: 'Test Flat Target',
          description: 'Flat invariant description',
          bbox: [100, 200, 300, 40],
          minVisibility: 0.9865,
        },
      });
      await handleSaveInvariant(flatTest.req, flatTest.res);
      const flatRes = await flatTest.getResult();
      expect(flatRes.statusCode).toBe(200);
      expect((flatRes.data as { success: boolean }).success).toBe(true);

      // 2. Nested { invariant: { ... } } shape (from Spectra Lens)
      const nestedTest = createMockReqRes({
        method: 'POST',
        url: '/api/save-invariant',
        body: {
          invariant: {
            id: 'inv_nested_lens_test',
            description: 'Nested lens invariant description',
            targetLabel: 'Test Nested Target',
            bbox: [909, 600, 342, 51],
            minVisibility: 0.9865,
          },
        },
      });
      await handleSaveInvariant(nestedTest.req, nestedTest.res);
      const nestedRes = await nestedTest.getResult();
      expect(nestedRes.statusCode).toBe(200);
      const nestedData = nestedRes.data as {
        success: boolean;
        invariant: { matcher: { target: string } };
      };
      expect(nestedData.success).toBe(true);
      expect(nestedData.invariant.matcher.target).toBe('Test Nested Target');
    } finally {
      if (originalContent !== null) {
        fs.writeFileSync(invPath, originalContent, 'utf-8');
      }
    }
  });

  it('POST /api/explain-verdict returns structured decisionExplanation with mathematical proof', async () => {
    const { req, res, getResult } = createMockReqRes({
      method: 'POST',
      url: '/api/explain-verdict',
      body: {
        clipId: 'dom_catch_010_v1',
        targetLabel: 'Complete Checkout',
        targetBBox: [910, 600, 340, 50],
      },
    });

    await handleExplainVerdict(req, res);
    const result = await getResult();

    expect(result.statusCode).toBe(200);
    const data = result.data as {
      verdict: string;
      decisionExplanation: {
        ruleFired: string;
        instrumentAVote: string;
        instrumentBVote: string;
        marginToThreshold: number;
        observedDelta: number;
        deltaLimit: number;
        deltaMargin: number;
        formulaSummary: string;
      };
      bboxSource: string;
    };
    expect(data.verdict).toBe('fail');
    expect(data.decisionExplanation).toBeDefined();
    expect(data.decisionExplanation.ruleFired).toBe('RULE_3_THREE_SIGMA_OCCLUSION_REJECT');
    expect(data.decisionExplanation.instrumentAVote).toBe('fail');
    expect(data.decisionExplanation.instrumentBVote).toBe('fail');
    expect(data.decisionExplanation.marginToThreshold).toBeGreaterThan(0);
    expect(data.decisionExplanation.deltaMargin).toBeGreaterThan(0);
    expect(data.bboxSource).toBe('caller');
  });
});


describe('@spectra/workbench - Brand Asset Integrity Tests', () => {
  const workspaceRoot = path.resolve(__dirname, '../../../../');

  const brandAssets = [
    path.join(workspaceRoot, 'assets', 'spectra-logo.svg'),
    path.join(workspaceRoot, 'assets', 'spectra-banner.svg'),
    path.join(workspaceRoot, 'packages', 'workbench', 'public', 'favicon.svg'),
  ];

  it('all brand SVG assets exist on disk and contain valid <svg root elements', () => {
    for (const assetPath of brandAssets) {
      expect(
        fs.existsSync(assetPath),
        `Brand asset missing: ${path.relative(workspaceRoot, assetPath)}`,
      ).toBe(true);

      const content = fs.readFileSync(assetPath, 'utf-8');
      expect(
        content.includes('<svg'),
        `${path.relative(workspaceRoot, assetPath)} is not a valid SVG file`,
      ).toBe(true);
    }
  });
});
