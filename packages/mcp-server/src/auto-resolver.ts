import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { execFileSync } from 'node:child_process';
import { parseVideoStream, decodeMaskToRaster } from '@meta-sam/parser';
import type { BoundingBox } from '@spectra/core';

export interface RawVerifyToolArgs {
  videoPath?: string;
  t0FramePath?: string;
  tkFramePath?: string;
  targetLabel: string;
  targetBBox?: BoundingBox | [number, number, number, number];
  cachedSamResponsePath?: string;
  tolerance?: number;
}

export interface ResolvedVerifyInputs {
  videoPath?: string;
  t0FramePath: string;
  tkFramePath: string;
  targetLabel: string;
  targetBBox: BoundingBox;
  bboxSource: 'caller' | 'sam-frame-0' | 'manifest';
  cachedSamResponsePath?: string;
  tolerance?: number;
  cleanupTempFrames: () => void;
}

export function findRepoRoot(startDir: string = process.cwd()): string {
  let current = path.resolve(startDir);
  for (let i = 0; i < 6; i++) {
    if (
      fs.existsSync(path.join(current, 'pnpm-workspace.yaml')) ||
      fs.existsSync(path.join(current, 'benchmark', 'manifest.json'))
    ) {
      return current;
    }
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
  return process.cwd();
}

export function normalizeBBox(
  input: BoundingBox | [number, number, number, number],
): BoundingBox {
  if (Array.isArray(input)) {
    const [x, y, width, height] = input;
    return {
      x: Math.round(x),
      y: Math.round(y),
      width: Math.round(width),
      height: Math.round(height),
    };
  }
  return {
    x: Math.round(input.x),
    y: Math.round(input.y),
    width: Math.round(input.width),
    height: Math.round(input.height),
  };
}

/**
 * Extracts tight pixel bounding box { x, y, width, height } from Frame 0 of a SAM 3.1 response JSON.
 */
export function extractBBoxFromSamFrame0(samJsonPath: string): BoundingBox | null {
  if (!fs.existsSync(samJsonPath)) return null;
  try {
    const raw = JSON.parse(fs.readFileSync(samJsonPath, 'utf8'));
    const textChunks: string[] = [];
    if (typeof raw?.output_text === 'string') {
      textChunks.push(raw.output_text);
    } else if (Array.isArray(raw?.output)) {
      for (const item of raw.output) {
        if (Array.isArray(item?.content)) {
          for (const c of item.content) {
            if (typeof c?.text === 'string') textChunks.push(c.text);
          }
        }
      }
    }
    const fullText = textChunks.join('\n');
    if (!fullText) return null;

    const frame0Line =
      fullText.split('\n').find((l) => l.startsWith('<0f>') || l.includes('<0f>')) ?? fullText;
    const boxMatch = frame0Line.match(/<\|box;x1=(\d+);y1=(\d+);x2=(\d+);y2=(\d+)/);
    const maskMatch = frame0Line.match(/<\|mask;[^>]*data=(\d+),(\d+),([!~][^|>]+)\|>/);

    if (maskMatch) {
      const boxLeft = boxMatch ? parseInt(boxMatch[1], 10) : 0;
      const boxTop = boxMatch ? parseInt(boxMatch[2], 10) : 0;
      const maskH = parseInt(maskMatch[1], 10);
      const maskW = parseInt(maskMatch[2], 10);
      const payload = maskMatch[3];
      const encoding = payload.startsWith('!') ? 'one_bit' : 'lossless';
      const raster = decodeMaskToRaster({ encoding, width: maskW, height: maskH, payload });

      let minX = maskW;
      let minY = maskH;
      let maxX = -1;
      let maxY = -1;

      for (let y = 0; y < maskH; y++) {
        const rowOffset = y * maskW;
        for (let x = 0; x < maskW; x++) {
          if (raster[rowOffset + x] > 0) {
            if (x < minX) minX = x;
            if (y < minY) minY = y;
            if (x > maxX) maxX = x;
            if (y > maxY) maxY = y;
          }
        }
      }

      if (maxX >= minX && maxY >= minY) {
        return {
          x: boxLeft + minX,
          y: boxTop + minY,
          width: maxX - minX + 1,
          height: maxY - minY + 1,
        };
      }
    }

    if (
      typeof parseVideoStream === 'function' &&
      Array.isArray((raw as Record<string, unknown>)?.frames)
    ) {
      const frames = (raw as Record<string, unknown>).frames as Array<{
        frameIndex?: number;
        objects?: Array<{
          mask?: {
            encoding: 'one_bit' | 'lossless';
            width: number;
            height: number;
            payload: string;
          };
        }>;
      }>;
      const frame0 = frames.find((f) => f.frameIndex === 0) ?? frames[0];
      const obj = frame0?.objects?.[0];
      if (obj?.mask) {
        const raster = decodeMaskToRaster(obj.mask);
        const w = obj.mask.width;
        const h = obj.mask.height;
        let minX = w;
        let minY = h;
        let maxX = -1;
        let maxY = -1;
        for (let y = 0; y < h; y++) {
          const rowOffset = y * w;
          for (let x = 0; x < w; x++) {
            if (raster[rowOffset + x] > 0) {
              if (x < minX) minX = x;
              if (y < minY) minY = y;
              if (x > maxX) maxX = x;
              if (y > maxY) maxY = y;
            }
          }
        }
        if (maxX >= minX && maxY >= minY) {
          return {
            x: minX,
            y: minY,
            width: maxX - minX + 1,
            height: maxY - minY + 1,
          };
        }
      }
    }

    return null;
  } catch {
    return null;
  }
}

export function resolveVerifyInputs(args: RawVerifyToolArgs): ResolvedVerifyInputs {
  const repoRoot = findRepoRoot();
  const tempFiles: string[] = [];
  const cleanupTempFrames = (): void => {
    for (const f of tempFiles) {
      try {
        if (fs.existsSync(f)) fs.unlinkSync(f);
      } catch {
        // ignore cleanup errors
      }
    }
  };

  const resolvedVideoPath = args.videoPath
    ? path.isAbsolute(args.videoPath)
      ? args.videoPath
      : path.resolve(repoRoot, args.videoPath)
    : undefined;

  const stem = resolvedVideoPath
    ? path.basename(resolvedVideoPath, path.extname(resolvedVideoPath))
    : args.t0FramePath
      ? path.basename(args.t0FramePath).replace(/_t0\.png$/i, '')
      : undefined;

  // 1. Resolve t0FramePath and tkFramePath
  let t0FramePath = args.t0FramePath
    ? path.isAbsolute(args.t0FramePath)
      ? args.t0FramePath
      : path.resolve(repoRoot, args.t0FramePath)
    : undefined;
  let tkFramePath = args.tkFramePath
    ? path.isAbsolute(args.tkFramePath)
      ? args.tkFramePath
      : path.resolve(repoRoot, args.tkFramePath)
    : undefined;

  if ((!t0FramePath || !tkFramePath) && resolvedVideoPath && stem) {
    const videoDir = path.dirname(resolvedVideoPath);
    const candidateT0 = path.join(videoDir, `${stem}_t0.png`);
    const candidateTk = path.join(videoDir, `${stem}_tk.png`);

    if (fs.existsSync(candidateT0) && fs.existsSync(candidateTk)) {
      t0FramePath = t0FramePath ?? candidateT0;
      tkFramePath = tkFramePath ?? candidateTk;
    } else if (fs.existsSync(resolvedVideoPath)) {
      // Extract Frame 0 and last frame using ffmpeg
      const outT0 = path.join(os.tmpdir(), `spectra_${stem}_${Date.now()}_t0.png`);
      const outTk = path.join(os.tmpdir(), `spectra_${stem}_${Date.now()}_tk.png`);
      try {
        execFileSync(
          'ffmpeg',
          ['-y', '-i', resolvedVideoPath, '-vf', 'select=eq(n\\,0)', '-vframes', '1', outT0],
          {
            stdio: 'ignore',
          },
        );
        execFileSync(
          'ffmpeg',
          ['-y', '-sseof', '-0.3', '-i', resolvedVideoPath, '-vframes', '1', outTk],
          {
            stdio: 'ignore',
          },
        );
        tempFiles.push(outT0, outTk);
        t0FramePath = t0FramePath ?? outT0;
        tkFramePath = tkFramePath ?? outTk;
      } catch (err) {
        cleanupTempFrames();
        throw new Error(
          `Failed to extract frames from video using ffmpeg: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }
  }

  if (!t0FramePath || !tkFramePath) {
    throw new Error(
      'Unable to resolve t0/tk frames: provide either a valid `videoPath` or both `t0FramePath` and `tkFramePath`.',
    );
  }

  // 2. Auto-discover cachedSamResponsePath if not explicitly provided
  let cachedSamResponsePath = args.cachedSamResponsePath
    ? path.isAbsolute(args.cachedSamResponsePath)
      ? args.cachedSamResponsePath
      : path.resolve(repoRoot, args.cachedSamResponsePath)
    : undefined;

  if (!cachedSamResponsePath && stem) {
    const candidates = [
      path.join(repoRoot, 'benchmark', 'responses', 'phase2-smoke', `${stem}_sam.json`),
      path.join(repoRoot, 'benchmark', 'responses', 'benchmark-sam', `${stem}_sam.json`),
    ];
    for (const c of candidates) {
      if (fs.existsSync(c)) {
        cachedSamResponsePath = c;
        break;
      }
    }
  }

  // 3. Resolve targetBBox (Caller -> Manifest exact match / SAM Frame 0 auto-detect)
  let targetBBox: BoundingBox | null = args.targetBBox ? normalizeBBox(args.targetBBox) : null;
  let bboxSource: 'caller' | 'sam-frame-0' | 'manifest' = 'caller';

  if (!targetBBox && stem) {
    const manifestPath = path.join(repoRoot, 'benchmark', 'manifest.json');
    if (fs.existsSync(manifestPath)) {
      try {
        const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
        const clips = Array.isArray(manifest?.clips) ? manifest.clips : [];
        const matchedClip = clips.find((c: { clipId?: string }) => c.clipId === stem);
        if (matchedClip?.targetBBox) {
          targetBBox = normalizeBBox(matchedClip.targetBBox);
          bboxSource = 'manifest';
        }
      } catch {
        // fallback to SAM Frame 0
      }
    }
  }

  if (!targetBBox && cachedSamResponsePath) {
    const samBox = extractBBoxFromSamFrame0(cachedSamResponsePath);
    if (samBox) {
      targetBBox = samBox;
      bboxSource = 'sam-frame-0';
    }
  }

  if (!targetBBox) {
    throw new Error(
      'Unable to auto-detect targetBBox: no cached SAM Frame 0 mask or manifest entry found, and no targetBBox was provided.',
    );
  }

  return {
    videoPath: resolvedVideoPath,
    t0FramePath,
    tkFramePath,
    targetLabel: args.targetLabel,
    targetBBox,
    bboxSource,
    cachedSamResponsePath,
    tolerance: args.tolerance,
    cleanupTempFrames,
  };
}
