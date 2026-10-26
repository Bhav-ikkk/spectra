import fs from 'node:fs';
import path from 'node:path';
import {
  parseVideoStream,
  recordsOfKind,
  frameIndexOf,
  decodeMaskToRaster,
  type ResponsesEvent,
} from '@spectra/sam-client';

export function recomputeStaticCalibration() {
  console.log('=== Recomputing Static Baseline Jitter (Offline — Zero API Calls) ===\n');

  const fixturePath = path.resolve('benchmark/responses/spike-1/response.json');
  if (!fs.existsSync(fixturePath)) {
    throw new Error(`Spike 1 fixture not found at: ${fixturePath}`);
  }

  const rawJson = JSON.parse(fs.readFileSync(fixturePath, 'utf-8'));
  const runId = rawJson.id || 'resp_6adf950e30101e5a4f36456b';
  const outputText = rawJson.output?.[0]?.content?.[0]?.text || '';

  if (!outputText) {
    throw new Error('No output_text in Spike 1 fixture.');
  }

  // Parse using @meta-sam/parser synchronously through event generator
  async function* makeEvents(): AsyncIterable<ResponsesEvent> {
    yield {
      type: 'response.output_text.done',
      item_id: 'msg-sam',
      output_index: 0,
      content_index: 0,
      text: outputText,
    };
    yield { type: 'response.completed' };
  }

  return parseVideoStream(makeEvents()).finalResult.then((parseResult) => {
    const maskRecords = recordsOfKind(parseResult.records, 'mask');
    console.log(`Loaded ${maskRecords.length} mask records from local fixture.`);

    const frameAreas: { frame: number; area: number; width: number; height: number }[] = [];
    for (const record of maskRecords) {
      const frame = frameIndexOf(record) ?? 0;
      const raster = decodeMaskToRaster(record.mask);
      let area = 0;
      for (let i = 0; i < raster.length; i++) {
        if (raster[i] === 1) area++;
      }
      frameAreas.push({
        frame,
        area,
        width: record.mask.width,
        height: record.mask.height,
      });
    }

    frameAreas.sort((a, b) => a.frame - b.frame);

    // Extract quasi-static baseline window: frames 0 through 5 (areas: [2567, 2469, 2510, 2639, 2796, 2595])
    const baselineFrames = frameAreas.filter((f) => f.frame >= 0 && f.frame <= 5);
    console.log('\nQuasi-Static Baseline Frames (t_0 .. t_5):');
    for (const f of baselineFrames) {
      console.log(`  Frame ${f.frame}: area = ${f.area} px (${f.width}x${f.height})`);
    }

    const areas = baselineFrames.map((f) => f.area);
    const meanArea = areas.reduce((sum, a) => sum + a, 0) / areas.length;
    const variance =
      areas.reduce((sum, a) => sum + Math.pow(a - meanArea, 2), 0) / (areas.length - 1);
    const stddev = Math.sqrt(variance);

    const relativeStddev = stddev / meanArea;
    const sigma_noise = parseFloat(relativeStddev.toFixed(4));
    const delta = parseFloat((2 * sigma_noise).toFixed(4));

    console.log('\nDerived Static Calibration Metrics:');
    console.log(`  Mean baseline area:   ${meanArea.toFixed(1)} px`);
    console.log(`  Sample stddev:        ${stddev.toFixed(2)} px`);
    console.log(`  sigma_noise (rel):    ${sigma_noise}`);
    console.log(`  delta (2*sigma):      ${delta}`);

    const nowIso = new Date().toISOString();
    const citation = `Measured from Spike 1 run ${runId} (quasi-static window t_0..t_5, 6 frames: [${areas.join(', ')}], mean=${meanArea.toFixed(1)}px, stddev=${stddev.toFixed(2)}px)`;

    const calibrationData = {
      sigma_noise,
      delta,
      measured_at: nowIso,
      run_id: runId,
      sample_count: baselineFrames.length,
      citation,
    };

    const calibrationPath = path.resolve('packages/core/src/calibration.json');
    fs.writeFileSync(calibrationPath, JSON.stringify(calibrationData, null, 2) + '\n', 'utf-8');
    console.log(`\nUpdated ${calibrationPath}`);

    return calibrationData;
  });
}

// Execute if run directly
if (
  import.meta.url.endsWith(process.argv[1]) ||
  process.argv[1]?.includes('recompute-static-calibration')
) {
  recomputeStaticCalibration()
    .then((cal) => {
      console.log('Static calibration recomputation complete:', cal);
      process.exit(0);
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
