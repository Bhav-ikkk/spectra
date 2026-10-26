import { describe, it, expect } from 'vitest';
import {
  decodeMaskToRaster,
  decodeMaskToRLE,
  decodeMaskToSVGPath,
  parseVideoStream,
  recordsOfKind,
  frameIndexOf,
  buildObjectPrompt,
  type ResponsesEvent,
} from '../index.js';

describe('SAM 3.1 Parser Integration (Spike 1 dependency verification)', () => {
  it('correctly parses video segmentation stream deltas and decodes masks', async () => {
    // Frame 0 of a 320x334 clip, prompt "button", two objects
    const outputText =
      '<0f>0<|box;x1=211;y1=228;x2=270;y2=254;w=320;h=334|>' +
      "<|mask;x=0;y=0;data=27,60,~!!!!M!0c[0o91w?q1!pIH4pPRVp2B3'7`e.ioeAf6-k/#Xd8%dX9x(|>" +
      ',1<|box;x1=155;y1=228;x2=202;y2=254;w=320;h=334|>' +
      '<|mask;x=0;y=0;data=27,48,~!!!!J!0c[q=Pj_zs=*4C4(/./x#:/`S_GnD`=o3?X{emCgO$y@|>\n';

    async function* createStream(): AsyncIterable<ResponsesEvent> {
      const split = outputText.indexOf(',1<|box');
      yield {
        type: 'response.output_text.delta',
        item_id: 'msg-01',
        output_index: 0,
        content_index: 0,
        delta: outputText.slice(0, split),
      };
      yield {
        type: 'response.output_text.delta',
        item_id: 'msg-01',
        output_index: 0,
        content_index: 0,
        delta: outputText.slice(split),
      };
      yield {
        type: 'response.output_text.done',
        item_id: 'msg-01',
        output_index: 0,
        content_index: 0,
        text: outputText,
      };
      yield { type: 'response.completed' };
    }

    const parsed = parseVideoStream(createStream());
    const result = await parsed.finalResult;

    expect(result.outcome.status).toBe('completed');
    expect(result.records.length).toBe(4); // 2 boxes, 2 masks

    const boxRecords = recordsOfKind(result.records, 'box');
    const maskRecords = recordsOfKind(result.records, 'mask');

    expect(boxRecords).toHaveLength(2);
    expect(maskRecords).toHaveLength(2);

    expect(boxRecords[0].objectId).toBe('0');
    expect(boxRecords[0].left).toBe(211);
    expect(boxRecords[0].top).toBe(228);
    expect(boxRecords[0].right).toBe(271);
    expect(boxRecords[0].bottom).toBe(255);
    expect(maskRecords[0].bounds).toEqual({ left: 211, top: 228, right: 271, bottom: 255 });
    expect(frameIndexOf(boxRecords[0])).toBe(0);

    // Decode raster, COCO RLE, and SVG path
    const raster = decodeMaskToRaster(maskRecords[0].mask);
    expect(raster).toBeInstanceOf(Uint8Array);
    expect(raster.length).toBe(27 * 60);

    const cocoRle = decodeMaskToRLE(maskRecords[0].mask);
    expect(cocoRle.size).toEqual([27, 60]);
    expect(cocoRle.counts).toBeDefined();

    const svgPath = decodeMaskToSVGPath(maskRecords[0].mask);
    expect(svgPath).toMatch(/^M/);
    expect(svgPath).toContain('Z');
  });

  it('builds object prompts according to wire grammar', () => {
    const prompt = buildObjectPrompt({
      size: { width: 640, height: 480 },
      objects: [
        {
          id: 1,
          prompts: [{ frame: 0, box: { left: 10, top: 20, right: 40, bottom: 60 } }],
        },
      ],
    });

    expect(prompt).toContain('<0f>1<|box;x1=10;y1=20;x2=39;y2=59;w=640;h=480|>');
  });
});
