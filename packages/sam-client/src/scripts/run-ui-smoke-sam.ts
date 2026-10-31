import fs from 'node:fs';
import path from 'node:path';
import {
  parseVideoStream,
  recordsOfKind,
  frameIndexOf,
  decodeMaskToRaster,
  buildObjectPrompt,
  type ResponsesEvent,
} from '../index.js';

interface ClipTarget {
  clipId: string;
  nounPhrase: string;
  useObjectPrompt: boolean;
}

const TARGET_CLIPS: ClipTarget[] = [
  { clipId: 'canvas_000_v1', nounPhrase: 'legend', useObjectPrompt: true },
  { clipId: 'mobile_mp4_015_v1', nounPhrase: 'button', useObjectPrompt: true },
  { clipId: 'dom_catch_010_v1', nounPhrase: 'button', useObjectPrompt: true },
  { clipId: 'dom_catch_040_v1', nounPhrase: 'button', useObjectPrompt: true },
];

function findProjectRoot(): string {
  let dir = process.cwd();
  while (!fs.existsSync(path.join(dir, 'pnpm-workspace.yaml'))) {
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return dir;
}

function matchEnvValue(envContent: string, key: string): string | undefined {
  const match = envContent.match(new RegExp(`^${key}=([^\r\n]+)`, 'm'));
  const raw = match?.[1]?.trim();
  if (!raw) return undefined;
  if (
    raw.length >= 2 &&
    ((raw.startsWith('"') && raw.endsWith('"')) || (raw.startsWith("'") && raw.endsWith("'")))
  ) {
    return raw.slice(1, -1);
  }
  return raw;
}

function getApiKey(root: string): string {
  const envPath = path.join(root, '.env');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf-8');
    const value = matchEnvValue(envContent, 'META_API_KEY');
    if (value) {
      return value;
    }
  }
  if (process.env.META_API_KEY) {
    return process.env.META_API_KEY;
  }
  throw new Error('META_API_KEY is not defined in .env or environment');
}

export async function runUiSmokeSam() {
  console.log('=== Step 1: SAM 3.1 Live UI Clip Verification (4 Authorized Calls) ===\n');

  const root = findProjectRoot();
  const apiKey = getApiKey(root);
  const manifestPath = path.join(root, 'benchmark/manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));

  const outputDir = path.join(root, 'benchmark/responses/phase2-smoke');
  fs.mkdirSync(outputDir, { recursive: true });

  const results: Record<
    string,
    {
      clipId: string;
      maskAreas: { frame: number; area: number }[];
      meanArea: number;
      stddev: number;
    }
  > = {};

  for (const target of TARGET_CLIPS) {
    const clipInfo = manifest.clips.find((c: { clipId: string }) => c.clipId === target.clipId);
    if (!clipInfo) {
      throw new Error(`Clip ${target.clipId} not found in manifest.json`);
    }

    const clipRelPath = clipInfo.videoPath;
    const clipAbsPath = path.join(root, clipRelPath);
    if (!fs.existsSync(clipAbsPath)) {
      throw new Error(`MP4 file not found: ${clipAbsPath}`);
    }

    console.log(`\nProcessing [${target.clipId}]...`);
    console.log(`  File:   ${clipRelPath} (${fs.statSync(clipAbsPath).size} bytes)`);
    console.log(
      `  Target: "${clipInfo.targetLabel}" at [x=${clipInfo.targetBBox.x}, y=${clipInfo.targetBBox.y}, w=${clipInfo.targetBBox.width}, h=${clipInfo.targetBBox.height}]`,
    );

    const videoBuffer = fs.readFileSync(clipAbsPath);
    const videoBase64 = `data:video/mp4;base64,${videoBuffer.toString('base64')}`;

    // Prompt selection: seed with baseline t0 bbox per Blueprint fallback rule
    let promptContent: string;
    if (target.useObjectPrompt) {
      promptContent = buildObjectPrompt({
        size: { width: 1280, height: 720 },
        objects: [
          {
            id: 0,
            prompts: [
              {
                frame: 0,
                box: {
                  left: clipInfo.targetBBox.x,
                  top: clipInfo.targetBBox.y,
                  right: clipInfo.targetBBox.x + clipInfo.targetBBox.width,
                  bottom: clipInfo.targetBBox.y + clipInfo.targetBBox.height,
                },
              },
            ],
          },
        ],
      });
      console.log(`  Seeded Object Prompt: ${promptContent}`);
    } else {
      promptContent = target.nounPhrase;
      console.log(`  Noun-phrase Prompt: "${promptContent}"`);
    }

    console.log(`  Calling POST https://api.meta.ai/v1/responses (model: sam-3.1)...`);
    const startTime = Date.now();
    const response = await fetch('https://api.meta.ai/v1/responses', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
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

    const elapsed = Date.now() - startTime;
    console.log(`  API Response status: ${response.status} ${response.statusText} (${elapsed}ms)`);

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Meta API error for ${target.clipId}: ${response.status} ${errText}`);
    }

    const rawJson = await response.json();
    const rawOutPath = path.join(outputDir, `${target.clipId}_sam.json`);
    fs.writeFileSync(rawOutPath, JSON.stringify(rawJson, null, 2), 'utf-8');
    console.log(`  ✓ Raw response saved to: ${rawOutPath}`);

    // Parse output text
    const outputMsg = rawJson.output?.[0]?.content?.[0];
    const outputText = outputMsg?.text || '';
    if (!outputText) {
      throw new Error(`No output_text in response for ${target.clipId}`);
    }

    async function* makeEvents(): AsyncIterable<ResponsesEvent> {
      yield {
        type: 'response.output_text.done',
        item_id: `msg-${target.clipId}`,
        output_index: 0,
        content_index: 0,
        text: outputText,
      };
      yield { type: 'response.completed' };
    }

    const parsedStream = parseVideoStream(makeEvents());
    const parseResult = await parsedStream.finalResult;
    const maskRecords = recordsOfKind(parseResult.records, 'mask');

    const frameAreas: { frame: number; area: number }[] = [];
    for (const record of maskRecords) {
      const frame = frameIndexOf(record) ?? 0;
      const raster = decodeMaskToRaster(record.mask);
      let area = 0;
      for (let i = 0; i < raster.length; i++) {
        if (raster[i] === 1) area++;
      }
      frameAreas.push({ frame, area });
    }

    frameAreas.sort((a, b) => a.frame - b.frame);
    console.log(`  Decoded ${frameAreas.length} frame masks:`);
    for (const fa of frameAreas) {
      console.log(`    Frame ${fa.frame}: area = ${fa.area} px`);
    }

    const areas = frameAreas.map((f) => f.area);
    const meanArea = areas.length > 0 ? areas.reduce((s, a) => s + a, 0) / areas.length : 0;
    const variance =
      areas.length > 1
        ? areas.reduce((s, a) => s + Math.pow(a - meanArea, 2), 0) / (areas.length - 1)
        : 0;
    const stddev = Math.sqrt(variance);

    results[target.clipId] = {
      clipId: target.clipId,
      maskAreas: frameAreas,
      meanArea,
      stddev,
    };
  }

  console.log('\n=== All 4 UI Smoke Clips Processed Successfully ===');
  return results;
}

// Execute when invoked directly
runUiSmokeSam()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Fatal error in runUiSmokeSam:', err);
    process.exit(1);
  });
