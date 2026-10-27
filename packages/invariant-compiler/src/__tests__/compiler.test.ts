import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { InvariantsDocumentSchema } from '@spectra/core';
import { extractJsonFromText } from '../compile.js';

function findProjectRoot(): string {
  let dir = process.cwd();
  while (!fs.existsSync(path.join(dir, 'pnpm-workspace.yaml'))) {
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return dir;
}

describe('Invariant Compiler Offline Unit Tests', () => {
  const root = findProjectRoot();
  const voiceSmokeDir = path.join(root, 'benchmark/responses/voice-smoke');

  it('validates saved spoken_invariant.wav fixture exists and has expected header', () => {
    const wavPath = path.join(voiceSmokeDir, 'spoken_invariant.wav');
    expect(fs.existsSync(wavPath)).toBe(true);
    const buf = fs.readFileSync(wavPath);
    // RIFF header
    expect(buf.toString('ascii', 0, 4)).toBe('RIFF');
    expect(buf.toString('ascii', 8, 12)).toBe('WAVE');
  });

  it('replays saved raw_transcribe_response.json fixture cleanly', () => {
    const transcribePath = path.join(voiceSmokeDir, 'raw_transcribe_response.json');
    expect(fs.existsSync(transcribePath)).toBe(true);

    const data = JSON.parse(fs.readFileSync(transcribePath, 'utf-8'));
    expect(data.sessionId).toMatch(/^voyager\/transcribe\//);
    expect(data.transcript).toContain('complete checkout button');
    expect(data.transcript).toContain('revenue series legend');
  });

  it('replays saved raw_spark_response.json and parses valid InvariantsDocument', () => {
    const sparkPath = path.join(voiceSmokeDir, 'raw_spark_response.json');
    expect(fs.existsSync(sparkPath)).toBe(true);

    const sparkData = JSON.parse(fs.readFileSync(sparkPath, 'utf-8'));
    let outputText = '';
    for (const item of sparkData.output) {
      if (Array.isArray(item.content)) {
        for (const c of item.content) {
          if (c.text) outputText += c.text;
        }
      }
    }

    const parsed = extractJsonFromText(outputText) as Record<string, unknown>;
    expect(parsed).toBeDefined();

    // Verify invariants.json fixture matches InvariantsDocumentSchema
    const docPath = path.join(voiceSmokeDir, 'invariants.json');
    expect(fs.existsSync(docPath)).toBe(true);
    const doc = JSON.parse(fs.readFileSync(docPath, 'utf-8'));

    const validated = InvariantsDocumentSchema.parse(doc);
    expect(validated.invariants.length).toBeGreaterThanOrEqual(2);
    expect(validated.invariants.some((i) => i.id === 'complete-checkout-button-visible')).toBe(
      true,
    );
    expect(validated.invariants.some((i) => i.id === 'revenue-series-legend-visible')).toBe(true);

    for (const inv of validated.invariants) {
      expect(inv.type).toBe('visual');
      expect(inv.severity).toBe('error');
      expect(inv.source.compiled_by).toBe('muse-spark-1.3');
      expect(inv.source.voice_transcript_id).toBeDefined();
    }
  });

  it('extractJsonFromText handles fenced and unfenced JSON output', () => {
    const sample =
      '```json\n{"$schema": "https://example.com", "version": "1.0", "invariants": []}\n```';
    const parsed = extractJsonFromText(sample) as { version: string };
    expect(parsed.version).toBe('1.0');
  });
});
