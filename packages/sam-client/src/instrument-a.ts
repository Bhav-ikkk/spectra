/**
 * Instrument A: SAM Visibility Ratio
 *
 * Given decoded raster masks M(t0) (baseline frame t0) and M(tk) (evaluation frame tk)
 * cropped or intersected with the target region, computes:
 *   R_SAM = min(1.0, Area(M(tk)) / Area(M(t0)))
 *   Estimated occlusion = 1.0 - R_SAM
 */

import {
  decodeMaskToRaster,
  frameIndexOf,
  parseVideoStream,
  recordsOfKind,
  type ResponsesEvent,
} from './index.js';

export interface BoundingBoxCoordinates {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface SamVisibilityRatioResult {
  rSam: number;
  estimatedOcclusion: number;
  baselineArea: number;
  evalArea: number;
  detectedBBox?: BoundingBoxCoordinates;
  frameAreas?: number[];
}

function countMaskArea(mask: Uint8Array | number[]): number {
  let count = 0;
  for (let i = 0; i < mask.length; i++) {
    if ((mask[i] ?? 0) > 0) {
      count++;
    }
  }
  return count;
}

/**
 * Scans a binary mask array (data[y * width + x] > 0) on Frame 0 (t0) and
 * computes the tight bounding box.
 */
export function computeTightBBoxFromRaster(
  raster: { width: number; height: number; data: Uint8Array },
  offset?: { x: number; y: number },
): { x: number; y: number; width: number; height: number } | undefined {
  const { width, height, data } = raster;
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < height; y++) {
    const rowOffset = y * width;
    for (let x = 0; x < width; x++) {
      if ((data[rowOffset + x] ?? 0) > 0) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (maxX >= minX && maxY >= minY) {
    const offsetX = offset?.x ?? 0;
    const offsetY = offset?.y ?? 0;
    return {
      x: offsetX + minX,
      y: offsetY + minY,
      width: maxX - minX + 1,
      height: maxY - minY + 1,
    };
  }

  return undefined;
}

export function computeSamVisibilityRatio(
  baseline: Uint8Array | number[] | number,
  evaluation: Uint8Array | number[] | number,
  options?: {
    detectedBBox?: BoundingBoxCoordinates;
    frameAreas?: number[];
  },
): SamVisibilityRatioResult {
  const areaT0 = typeof baseline === 'number' ? baseline : countMaskArea(baseline);
  const areaTk = typeof evaluation === 'number' ? evaluation : countMaskArea(evaluation);

  if (areaT0 <= 0) {
    throw new Error('Baseline SAM mask area must be greater than zero');
  }

  const rawRatio = areaTk / areaT0;
  const rSam = Math.min(1.0, Math.max(0.0, rawRatio));
  const estimatedOcclusion = 1.0 - rSam;

  return {
    rSam,
    estimatedOcclusion,
    baselineArea: areaT0,
    evalArea: areaTk,
    detectedBBox: options?.detectedBBox,
    frameAreas: options?.frameAreas,
  };
}

export async function computeSamVisibilityFromResponse(
  response: Record<string, unknown> | string,
): Promise<SamVisibilityRatioResult> {
  let raw: Record<string, unknown> | undefined;
  let outputText = '';

  if (typeof response === 'string') {
    const trimmed = response.trim();
    if (trimmed.startsWith('{')) {
      try {
        raw = JSON.parse(trimmed);
      } catch {
        outputText = trimmed;
      }
    } else if (
      trimmed.includes('<0f>') ||
      trimmed.includes('<|box') ||
      trimmed.includes('<|mask')
    ) {
      outputText = trimmed;
    } else {
      const fs = await import('node:fs');
      if (fs.existsSync(trimmed)) {
        const content = fs.readFileSync(trimmed, 'utf8');
        try {
          raw = JSON.parse(content);
        } catch {
          outputText = content;
        }
      } else {
        outputText = trimmed;
      }
    }
  } else if (typeof response === 'object' && response !== null) {
    raw = response;
  }

  if (raw) {
    if (typeof raw.output_text === 'string') {
      outputText = raw.output_text;
    } else if (Array.isArray(raw.output)) {
      const parts: string[] = [];
      for (const item of raw.output as Array<{ content?: Array<{ text?: string }> }>) {
        if (Array.isArray(item?.content)) {
          for (const c of item?.content ?? []) {
            if (typeof c?.text === 'string') parts.push(c.text);
          }
        }
      }
      outputText = parts.join('\n');
    }
  }

  if (!outputText) {
    throw new Error('No output_text or valid SAM stream content found in response');
  }

  async function* makeEvents(): AsyncIterable<ResponsesEvent> {
    yield {
      type: 'response.output_text.done',
      item_id: 'sam-msg',
      output_index: 0,
      content_index: 0,
      text: outputText,
    };
    yield { type: 'response.completed' };
  }

  const parsedStream = parseVideoStream(makeEvents());
  const parseResult = await parsedStream.finalResult;
  const maskRecords = recordsOfKind(parseResult.records, 'mask');

  const frameData: {
    frame: number;
    area: number;
    bbox?: BoundingBoxCoordinates;
  }[] = [];

  for (const record of maskRecords) {
    const frame = frameIndexOf(record) ?? 0;
    const raster = decodeMaskToRaster(record.mask);
    let area = 0;
    for (let i = 0; i < raster.length; i++) {
      if ((raster[i] ?? 0) > 0) area++;
    }

    let bbox: BoundingBoxCoordinates | undefined;
    if (frame === 0) {
      bbox = computeTightBBoxFromRaster(
        { width: record.mask.width, height: record.mask.height, data: raster },
        { x: record.bounds.left, y: record.bounds.top },
      );
    }

    frameData.push({ frame, area, bbox });
  }

  frameData.sort((a, b) => a.frame - b.frame);
  const t0 = frameData[0];
  const tk = frameData[frameData.length - 1];

  if (!t0 || t0.area <= 0) {
    throw new Error('Baseline SAM mask area must be greater than zero');
  }

  const t0Area = t0.area;
  const tkArea = tk?.area ?? 0;
  const detectedBBox = t0.bbox;
  const frameAreas = frameData.map((f) => f.area);

  return computeSamVisibilityRatio(t0Area, tkArea, {
    detectedBBox,
    frameAreas,
  });
}
