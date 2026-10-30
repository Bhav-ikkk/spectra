import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';
import {
  parseVideoStream,
  recordsOfKind,
  frameIndexOf,
  decodeMaskToRaster,
  decodeMaskToSVGPath,
  computeTightBBoxFromRaster,
  type ResponsesEvent,
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

function extractOutputText(raw: Record<string, unknown>): string {
  if (typeof raw.output_text === 'string') {
    return raw.output_text;
  }
  if (Array.isArray(raw.output)) {
    const parts: string[] = [];
    for (const item of raw.output as Array<{ content?: Array<{ text?: string }> }>) {
      if (Array.isArray(item?.content)) {
        for (const c of item.content) {
          if (typeof c?.text === 'string') parts.push(c.text);
        }
      }
    }
    return parts.join('\n');
  }
  return '';
}

async function parseFixtureResponse(fixturePath: string) {
  const raw = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
  const text = extractOutputText(raw);
  if (!text) {
    throw new Error(`No output text found in fixture ${fixturePath}`);
  }

  async function* makeEvents(): AsyncIterable<ResponsesEvent> {
    yield {
      type: 'response.output_text.done',
      item_id: 'msg-sam',
      output_index: 0,
      content_index: 0,
      text,
    };
    yield { type: 'response.completed' };
  }

  return await parseVideoStream(makeEvents()).finalResult;
}

function countActivePixels(raster: Uint8Array): number {
  let count = 0;
  for (let i = 0; i < raster.length; i++) {
    if ((raster[i] ?? 0) > 0) count++;
  }
  return count;
}

describe('@meta-sam/parser@0.1.0 Wire-Grammar Pin Invariants (Spike 1 / Phase 2)', () => {
  const root = findProjectRoot();
  const domFixturePath = path.join(
    root,
    'benchmark/responses/phase2-smoke/dom_catch_010_v1_sam.json',
  );
  const canvasFixturePath = path.join(
    root,
    'benchmark/responses/phase2-smoke/canvas_000_v1_sam.json',
  );

  it('verifies parseVideoStream extracts exactly 8 frames (0 through 7) from dom_catch_010_v1_sam.json', async () => {
    const parseResult = await parseFixtureResponse(domFixturePath);
    expect(parseResult.outcome.status).toBe('completed');

    const maskRecords = recordsOfKind(parseResult.records, 'mask');
    expect(maskRecords).toHaveLength(8);

    const frameIndices = maskRecords.map((m) => frameIndexOf(m));
    expect(frameIndices).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
  });

  it('verifies parseVideoStream extracts exactly 8 frames (0 through 7) from canvas_000_v1_sam.json', async () => {
    const parseResult = await parseFixtureResponse(canvasFixturePath);
    expect(parseResult.outcome.status).toBe('completed');

    const maskRecords = recordsOfKind(parseResult.records, 'mask');
    expect(maskRecords).toHaveLength(8);

    const frameIndices = maskRecords.map((m) => frameIndexOf(m));
    expect(frameIndices).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
  });

  it('verifies Frame 0 (<0f>) and Frame 7 (<7f>) of dom_catch_010_v1_sam.json decode to exact pixel areas 17299 and 15708, rSam = 0.9080293658592983, and tight bounding box { x: 909, y: 600, width: 342, height: 51 }', async () => {
    const parseResult = await parseFixtureResponse(domFixturePath);
    const maskRecords = recordsOfKind(parseResult.records, 'mask');

    const frame0 = maskRecords.find((m) => frameIndexOf(m) === 0);
    const frame7 = maskRecords.find((m) => frameIndexOf(m) === 7);

    expect(frame0).toBeDefined();
    expect(frame7).toBeDefined();

    // Decode Frame 0
    const raster0 = decodeMaskToRaster(frame0!.mask);
    const area0 = countActivePixels(raster0);
    expect(area0).toBe(17299);

    const tightBBox0 = computeTightBBoxFromRaster(
      { width: frame0!.mask.width, height: frame0!.mask.height, data: raster0 },
      { x: frame0!.bounds.left, y: frame0!.bounds.top },
    );
    expect(tightBBox0).toEqual({ x: 909, y: 600, width: 342, height: 51 });

    // Decode Frame 7
    const raster7 = decodeMaskToRaster(frame7!.mask);
    const area7 = countActivePixels(raster7);
    expect(area7).toBe(15708);

    // Verify exact rSam visibility ratio
    const rSam = area7 / area0;
    expect(rSam).toBe(0.9080293658592983);
  });

  it('verifies decodeMaskToSVGPath on Frame 0 produces a valid closed SVG path starting with "M" and ending with "Z"', async () => {
    const parseResult = await parseFixtureResponse(domFixturePath);
    const maskRecords = recordsOfKind(parseResult.records, 'mask');
    const frame0 = maskRecords.find((m) => frameIndexOf(m) === 0);

    expect(frame0).toBeDefined();

    const svgPath = decodeMaskToSVGPath(frame0!.mask);
    expect(typeof svgPath).toBe('string');
    expect(svgPath.length).toBeGreaterThan(0);
    expect(svgPath.startsWith('M')).toBe(true);
    expect(svgPath.endsWith('Z')).toBe(true);
  });
});

