import { describe, it, expect } from 'vitest';
import { normalizeBBox, resolveVerifyInputs } from '../auto-resolver.js';

describe('@spectra/mcp-server - resolver input validation ($0.00 Spend)', () => {
  it('accepts valid bboxes and rounds fractional pixels', () => {
    expect(normalizeBBox([10.4, 20.5, 30.6, 40.1])).toEqual({
      x: 10,
      y: 21,
      width: 31,
      height: 40,
    });
    expect(normalizeBBox({ x: 1, y: 2, width: 3, height: 4 })).toEqual({
      x: 1,
      y: 2,
      width: 3,
      height: 4,
    });
  });

  it('rejects non-finite, negative, and malformed bboxes', () => {
    expect(() => normalizeBBox([0, 0, Number.POSITIVE_INFINITY, 10])).toThrow('Invalid targetBBox');
    expect(() => normalizeBBox([0, 0, Number.NaN, 10])).toThrow('Invalid targetBBox');
    expect(() => normalizeBBox([-1, 0, 10, 10])).toThrow('Invalid targetBBox');
    expect(() => normalizeBBox([0, 0, 10] as unknown as [number, number, number, number])).toThrow(
      'Invalid targetBBox',
    );
  });

  it('rejects non-finite and negative tolerance', () => {
    const base = {
      t0FramePath: 'a_t0.png',
      tkFramePath: 'a_tk.png',
      targetLabel: 'btn',
      targetBBox: [0, 0, 10, 10] as [number, number, number, number],
    };
    expect(() => resolveVerifyInputs({ ...base, tolerance: Number.NaN })).toThrow(
      'Invalid tolerance',
    );
    expect(() => resolveVerifyInputs({ ...base, tolerance: -1 })).toThrow('Invalid tolerance');
    expect(() => resolveVerifyInputs({ ...base, tolerance: Number.POSITIVE_INFINITY })).toThrow(
      'Invalid tolerance',
    );
    const ok = resolveVerifyInputs({ ...base, tolerance: 5 });
    expect(ok.tolerance).toBe(5);
  });
});
