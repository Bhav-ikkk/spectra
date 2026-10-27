import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { InvariantsDocumentSchema } from '@spectra/core';
import { extractJsonFromText } from '../compile.js';
import { evaluateWithVlmJudge } from '../vlm-judge.js';

function findProjectRoot(): string {
  let dir = process.cwd();
  while (!fs.existsSync(path.join(dir, 'pnpm-workspace.yaml'))) {
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return dir;
}

describe('Baseten Open-Weight Provider Offline Unit Tests ($0.00 Spend)', () => {
  const root = findProjectRoot();
  const basetenSmokeDir = path.join(root, 'benchmark/responses/baseten-smoke');

  it('validates that live Baseten smoke test fixtures exist and are populated', () => {
    const compilePath = path.join(basetenSmokeDir, 'compile_response.json');
    const invariantsPath = path.join(basetenSmokeDir, 'invariants.json');
    const judgePath = path.join(basetenSmokeDir, 'vlm_judge_response.json');

    expect(fs.existsSync(compilePath)).toBe(true);
    expect(fs.existsSync(invariantsPath)).toBe(true);
    expect(fs.existsSync(judgePath)).toBe(true);

    const compileJson = JSON.parse(fs.readFileSync(compilePath, 'utf-8'));
    expect(compileJson.model).toBe('meta-models/muse-spark-open-1026');
    expect(compileJson.choices[0].message.content).toBeDefined();

    const judgeJson = JSON.parse(fs.readFileSync(judgePath, 'utf-8'));
    expect(judgeJson.model).toBe('meta-models/muse-spark-open-1026');
    expect(judgeJson.choices[0].message.content).toBeDefined();
  });

  it('verifies that InvariantsDocumentSchema validates Baseten-compiled invariants.json', () => {
    const invariantsPath = path.join(basetenSmokeDir, 'invariants.json');
    const doc = JSON.parse(fs.readFileSync(invariantsPath, 'utf-8'));

    const validated = InvariantsDocumentSchema.parse(doc);
    expect(validated.invariants.length).toBeGreaterThanOrEqual(2);

    const checkoutInv = validated.invariants.find((i) => i.id.includes('complete-checkout-button'));
    expect(checkoutInv).toBeDefined();
    expect(checkoutInv?.type).toBe('visual');
    expect(checkoutInv?.severity).toBe('error');
    expect(checkoutInv?.source.compiled_by).toBe('meta-models/muse-spark-open-1026');
    expect(checkoutInv?.source.voice_transcript_id).toBe(
      'voyager/transcribe/6D0FEAC1E93944EB9F057C5DBE136055',
    );

    const legendInv = validated.invariants.find((i) => i.id.includes('revenue-series-legend'));
    expect(legendInv).toBeDefined();
    expect(legendInv?.type).toBe('visual');
    expect(legendInv?.source.compiled_by).toBe('meta-models/muse-spark-open-1026');
  });

  it('extracts strict JSON cleanly from Baseten Chat Completion response content', () => {
    const compilePath = path.join(basetenSmokeDir, 'compile_response.json');
    const compileJson = JSON.parse(fs.readFileSync(compilePath, 'utf-8'));
    const content = compileJson.choices[0].message.content;

    const parsed = extractJsonFromText(content) as {
      invariants: Array<{ id: string; description: string }>;
    };

    expect(parsed.invariants).toBeDefined();
    expect(parsed.invariants.length).toBe(2);
    expect(parsed.invariants[0].id).toBe('complete-checkout-button-visible');
  });

  it('replays evaluateWithVlmJudge with Baseten cached fixture and documents VLM blind spot', async () => {
    const judgePath = path.join(basetenSmokeDir, 'vlm_judge_response.json');
    const framePath = path.join(root, 'benchmark/clips/dom_catch_010_v1_tk.png');

    const result = await evaluateWithVlmJudge(framePath, 'Complete Checkout Button', {
      provider: 'baseten',
      cachedResponsePath: judgePath,
    });

    expect(result.provider).toBe('baseten');
    expect(result.model).toBe('meta-models/muse-spark-open-1026');
    expect(result.target).toBe('Complete Checkout Button');
    // Open-weight VLM claimed false with 99% confidence on 10% edge occlusion
    expect(result.clipped).toBe(false);
    expect(result.confidence).toBe(0.99);
    expect(result.reasoning).toContain('Complete Checkout');
    expect(result.rawResponse).toBeDefined();
  });

  it('replays evaluateWithVlmJudge with Meta cached fixture', async () => {
    const metaClippedPath = path.join(root, 'benchmark/responses/spike-2/clipped_response.json');
    const framePath = path.join(root, 'benchmark/clips/dom_catch_010_v1_tk.png');

    const result = await evaluateWithVlmJudge(framePath, 'Submit Button', {
      provider: 'meta',
      cachedResponsePath: metaClippedPath,
    });

    expect(result.provider).toBe('meta');
    expect(result.model).toBe('muse-spark-1.3');
    expect(result.clipped).toBe(true);
    expect(result.confidence).toBe(0.92);
  });

  it('validates provider resolution and error handling when API key is missing', async () => {
    const framePath = path.join(root, 'benchmark/clips/dom_catch_010_v1_tk.png');

    // Missing BASETEN_API_KEY throws informative error
    await expect(
      evaluateWithVlmJudge(framePath, 'Checkout Button', {
        provider: 'baseten',
        apiKey: '',
      }),
    ).rejects.toThrow(/BASETEN_API_KEY is required/);

    // Missing META_API_KEY throws informative error
    await expect(
      evaluateWithVlmJudge(framePath, 'Checkout Button', {
        provider: 'meta',
        apiKey: '',
      }),
    ).rejects.toThrow(/META_API_KEY is required/);
  });
});
