#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import {
  SpectraClient,
  runClosedLoopReferee,
  type ClosedLoopResult,
  type MeasurementResult,
  type BoundingBox,
  getCalibration,
} from '@spectra/sdk';

export { SpectraClient, type SpectraClientConfig } from '@spectra/sdk';
export * from '@spectra/sdk';

export interface CliIo {
  stdout: (msg: string) => void;
  stderr: (msg: string) => void;
}

export interface CliResult {
  exitCode: number;
  data?: unknown;
}

function parseBoundingBox(bboxStr: string): BoundingBox {
  const parts = bboxStr.split(',').map((p) => Number(p.trim()));
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n) || n < 0)) {
    throw new Error(
      `Invalid bbox format "${bboxStr}". Expected "x,y,width,height" with non-negative numbers.`,
    );
  }
  const [x, y, width, height] = parts;
  return { x, y, width, height };
}

function formatClosedLoopOutput(result: ClosedLoopResult): string {
  const sep = '='.repeat(80);
  const line = '-'.repeat(80);

  return [
    sep,
    ' SPECTRA CLOSED-LOOP REFEREE DEMO: SCENARIO S3 ("THE CATCH")',
    sep,
    ` Scenario ID:          ${result.scenarioId}`,
    ` Description:          ${result.description}`,
    ` Target Element:       Complete Checkout [x=910, y=600, w=340, h=50]`,
    ` Center Coordinates:   (${result.naiveBaseline.coordinates.x}, ${result.naiveBaseline.coordinates.y})`,
    line,
    ' [PHASE 1: TRADITIONAL DOM HIT-TEST BASELINE]',
    ` Hit-Test Strategy:    ${result.naiveBaseline.strategy}`,
    ` Center Pixel Covered: ${result.naiveBaseline.centerPixelCovered}`,
    ` Baseline Verdict:     ${result.naiveBaseline.verdict.toUpperCase()} (FALSE PASS)`,
    ` Telemetry Reason:     ${result.naiveBaseline.reason}`,
    line,
    ' [PHASE 2: PASS #1 — SPECTRA DUAL-INSTRUMENT REFEREE CATCH]',
    ` Clip ID:              ${result.pass1.clipId}`,
    ` Instrument A (SAM):   rSam = ${result.pass1.instrumentA.score.toFixed(4)} [${result.pass1.instrumentA.passed ? 'PASS' : 'FAIL'}]`,
    ` Instrument B (Pix):   visRatio = ${result.pass1.instrumentB.score.toFixed(4)} [${result.pass1.instrumentB.passed ? 'PASS' : 'FAIL'}]`,
    ` Agreement Delta:      ${((result.pass1.noiseDelta ?? 0) * 100).toFixed(2)}%`,
    ` Spectra Verdict:      ${result.pass1.combinedVerdict.toUpperCase()} (REJECTED)`,
    ` Telemetry Reason:     ${result.pass1.notes}`,
    line,
    ' [PHASE 3: AI AGENT REPAIR STEP]',
    ` Model:                ${result.repair.model}`,
    ` Explanation:          ${result.repair.explanation}`,
    ` New Overlap:          ${result.repair.newFooterOverlapPx}px`,
    ' Applied CSS Patch:',
    result.repair.cssPatch
      .split('\n')
      .map((l) => `   ${l}`)
      .join('\n'),
    line,
    ' [PHASE 4: PASS #2 — SPECTRA CLOSED-LOOP RE-VERIFICATION]',
    ` Clip ID:              ${result.pass2.clipId}`,
    ` Instrument A (SAM):   rSam = ${result.pass2.instrumentA.score.toFixed(4)} [${result.pass2.instrumentA.passed ? 'PASS' : 'FAIL'}]`,
    ` Instrument B (Pix):   visRatio = ${result.pass2.instrumentB.score.toFixed(4)} [${result.pass2.instrumentB.passed ? 'PASS' : 'FAIL'}]`,
    ` Spectra Verdict:      ${result.pass2.combinedVerdict.toUpperCase()} (VERIFIED)`,
    ` Telemetry Reason:     ${result.pass2.notes}`,
    sep,
    ` CLOSED-LOOP OUTCOME:  ${result.success ? 'SUCCESS (REJECTED -> PATCHED -> VERIFIED)' : 'FAILED'}`,
    sep,
  ].join('\n');
}

function formatRefereeTable(
  result: MeasurementResult,
  targetLabel: string,
  bbox: BoundingBox,
): string {
  const cal = getCalibration();
  const thresholdPct = (3 * (cal.sigma_noise ?? 0) * 100).toFixed(2);
  const sigmaPct = ((cal.sigma_noise ?? 0) * 100).toFixed(2);
  const deltaPct = cal.delta != null ? (cal.delta * 100).toFixed(2) + '%' : 'N/A';
  const noiseDeltaPct =
    result.noiseDelta != null ? (result.noiseDelta * 100).toFixed(2) + '%' : 'N/A';
  const confPct = result.confidence != null ? (result.confidence * 100).toFixed(2) + '%' : 'N/A';

  const sep = '='.repeat(80);
  const line = '-'.repeat(80);

  return [
    sep,
    ' SPECTRA VISUAL REFEREE VERDICT',
    sep,
    ` Clip ID:              ${result.clipId}`,
    ` Target:               ${targetLabel} [x=${bbox.x}, y=${bbox.y}, w=${bbox.width}, h=${bbox.height}]`,
    line,
    ` Instrument A (SAM):   rSam = ${result.instrumentA.score.toFixed(4)} [${result.instrumentA.passed ? 'PASS' : 'FAIL'}]`,
    ` Instrument B (Pixel): visRatio = ${result.instrumentB.score.toFixed(4)} [${result.instrumentB.passed ? 'PASS' : 'FAIL'}]`,
    ` Details:              ${result.instrumentB.details ?? result.instrumentA.details ?? ''}`,
    ` Noise Threshold:      ${thresholdPct}% (3 * sigma_noise, sigma = ${sigmaPct}%)`,
    ` Agreement Delta:      ${noiseDeltaPct} (limit delta = ${deltaPct})`,
    ` Confidence:           ${confPct}`,
    line,
    ` VERDICT:              ${result.combinedVerdict.toUpperCase()}`,
    ` Notes:                ${result.notes ?? 'None'}`,
    sep,
  ].join('\n');
}

function formatHelp(): string {
  return [
    'Spectra CLI — Visual Referee for AI Coding Agents',
    '',
    'USAGE:',
    '  spectra <subcommand> [options]',
    '',
    'SUBCOMMANDS:',
    '  verify               Run dual-instrument referee on a pair of video frames',
    '  compile-invariant    Compile user expectation into formal visual invariants',
    '  check                Verify visual invariants across a benchmark manifest or clip set',
    '  closed-loop-demo     Run end-to-end closed-loop "The Catch" (Reject -> Patch -> Re-Verify)',
    '',
    'OPTIONS (verify):',
    '  --t0 <path>          Path to baseline frame (t0)',
    '  --tk <path>          Path to evaluation frame (tk)',
    '  --target <label>     Semantic label of the target UI element',
    '  --bbox <x,y,w,h>     Target bounding box coordinates in pixels',
    '  --video <path>       (Optional) Path to video clip',
    '  --cached-sam <path>  (Optional) Path to cached SAM 3.1 response JSON ($0 spend)',
    '  --json               Output strict MeasurementResult JSON',
    '',
    'OPTIONS (compile-invariant):',
    '  --out <path>         Output path for invariants JSON (e.g. .spectra/invariants.json)',
    '  --audio <path>       (Optional) Path to audio WAV recording',
    '  --transcript <text>  (Optional) Raw transcript text',
    '  --cached-dir <path>  (Optional) Directory with cached voice-smoke responses',
    '  --json               Output InvariantsDocument JSON to stdout',
    '',
    'OPTIONS (check):',
    '  --invariants <path>  Path to .spectra/invariants.json',
    '  --manifest <path>    Path to benchmark manifest JSON',
    '  --cached-sam-dir <dir> (Optional) Directory containing cached SAM JSON responses',
    '  --json               Output BenchmarkReport JSON',
    '',
    'OPTIONS (closed-loop-demo):',
    '  --cached-dir <path>  (Optional) Directory containing saved closed-loop artifacts',
    '  --json               Output complete ClosedLoopResult JSON',
  ].join('\n');
}

export async function runCli(
  args: string[] = process.argv.slice(2),
  io: CliIo = {
    stdout: (msg) => console.log(msg),
    stderr: (msg) => console.error(msg),
  },
): Promise<CliResult> {
  if (args.length === 0 || args[0] === '--help' || args[0] === '-h' || args[0] === 'help') {
    io.stdout(formatHelp());
    return { exitCode: 0 };
  }

  const subcommand = args[0];
  const subArgs = args.slice(1);
  const client = new SpectraClient();

  try {
    if (subcommand === 'verify') {
      const { values } = parseArgs({
        args: subArgs,
        options: {
          t0: { type: 'string' },
          tk: { type: 'string' },
          target: { type: 'string' },
          bbox: { type: 'string' },
          video: { type: 'string' },
          'cached-sam': { type: 'string' },
          'clip-id': { type: 'string' },
          json: { type: 'boolean' },
        },
        allowPositionals: false,
      });

      if (!values.t0) throw new Error('Missing required option: --t0 <path>');
      if (!values.tk) throw new Error('Missing required option: --tk <path>');
      if (!values.target) throw new Error('Missing required option: --target <label>');
      if (!values.bbox) throw new Error('Missing required option: --bbox <x,y,w,h>');

      const bbox = parseBoundingBox(values.bbox);
      const clipId =
        values['clip-id'] || path.basename(values.t0, path.extname(values.t0)).replace(/_t0$/, '');

      const result = await client.verifyClip({
        clipId,
        t0FramePath: path.resolve(values.t0),
        tkFramePath: path.resolve(values.tk),
        targetLabel: values.target,
        targetBBox: bbox,
        videoPath: values.video ? path.resolve(values.video) : undefined,
        cachedSamResponsePath: values['cached-sam']
          ? path.resolve(values['cached-sam'])
          : undefined,
      });

      if (values.json) {
        io.stdout(JSON.stringify(result, null, 2));
      } else {
        io.stdout(formatRefereeTable(result, values.target, bbox));
      }

      const exitCode =
        result.combinedVerdict === 'pass' ? 0 : result.combinedVerdict === 'fail' ? 1 : 2;
      return { exitCode, data: result };
    }

    if (subcommand === 'compile-invariant') {
      const { values } = parseArgs({
        args: subArgs,
        options: {
          audio: { type: 'string' },
          transcript: { type: 'string' },
          out: { type: 'string' },
          'cached-dir': { type: 'string' },
          json: { type: 'boolean' },
        },
        allowPositionals: false,
      });

      if (!values.out) throw new Error('Missing required option: --out <path>');
      if (!values.audio && !values.transcript && !values['cached-dir']) {
        throw new Error('Must provide at least one of --audio, --transcript, or --cached-dir');
      }

      const doc = await client.compileVoiceInvariant({
        audioPath: values.audio ? path.resolve(values.audio) : undefined,
        transcriptText: values.transcript,
        outputPath: path.resolve(values.out),
        cachedDir: values['cached-dir'] ? path.resolve(values['cached-dir']) : undefined,
      });

      if (values.json) {
        io.stdout(JSON.stringify(doc, null, 2));
      } else {
        const outList = doc.invariants
          .map((inv) => `   - [${inv.type}/${inv.severity}] ${inv.id}: ${inv.description}`)
          .join('\n');
        io.stdout(
          [
            '='.repeat(80),
            ' SPECTRA INVARIANT COMPILER',
            '='.repeat(80),
            ` Invariants Compiled: ${doc.invariants.length}`,
            ` Output File:         ${values.out}`,
            ' Invariants:',
            outList,
            '='.repeat(80),
          ].join('\n'),
        );
      }

      return { exitCode: 0, data: doc };
    }

    if (subcommand === 'check') {
      const { values } = parseArgs({
        args: subArgs,
        options: {
          invariants: { type: 'string' },
          manifest: { type: 'string' },
          'cached-sam-dir': { type: 'string' },
          json: { type: 'boolean' },
        },
        allowPositionals: false,
      });

      if (!values.invariants) throw new Error('Missing required option: --invariants <path>');
      if (!values.manifest) throw new Error('Missing required option: --manifest <path>');

      const report = await client.checkInvariants({
        invariantsPath: path.resolve(values.invariants),
        manifestPath: path.resolve(values.manifest),
        cachedSamDir: values['cached-sam-dir'] ? path.resolve(values['cached-sam-dir']) : undefined,
      });

      const passedCount = report.results.filter((r) => r.combinedVerdict === 'pass').length;
      const failedCount = report.results.filter((r) => r.combinedVerdict === 'fail').length;
      const inconclusiveCount = report.results.filter(
        (r) => r.combinedVerdict === 'inconclusive',
      ).length;
      const overall = failedCount > 0 ? 'FAIL' : inconclusiveCount > 0 ? 'INCONCLUSIVE' : 'PASS';

      if (values.json) {
        io.stdout(JSON.stringify(report, null, 2));
      } else {
        const resultLines = report.results
          .map(
            (r) =>
              `   - [${r.combinedVerdict.toUpperCase()}] ${r.clipId}: InstA=${r.instrumentA.score.toFixed(4)}, InstB=${r.instrumentB.score.toFixed(4)}`,
          )
          .join('\n');

        io.stdout(
          [
            '='.repeat(80),
            ' SPECTRA BENCHMARK CHECK REPORT',
            '='.repeat(80),
            ` Run ID:        ${report.runId}`,
            ` Timestamp:     ${report.timestamp}`,
            ` Total Clips:   ${report.results.length}`,
            ` Passed:        ${passedCount}`,
            ` Failed:        ${failedCount}`,
            ` Inconclusive:  ${inconclusiveCount}`,
            '-'.repeat(80),
            ' Results:',
            resultLines,
            '-'.repeat(80),
            ` OVERALL:       ${overall}`,
            '='.repeat(80),
          ].join('\n'),
        );
      }

      const exitCode = failedCount > 0 ? 1 : inconclusiveCount > 0 ? 2 : 0;
      return { exitCode, data: report };
    }

    if (subcommand === 'closed-loop-demo') {
      const { values } = parseArgs({
        args: subArgs,
        options: {
          'cached-dir': { type: 'string' },
          json: { type: 'boolean' },
        },
        allowPositionals: false,
      });

      const result = await runClosedLoopReferee({
        client,
        cachedDir: values['cached-dir'] ? path.resolve(values['cached-dir']) : undefined,
      });

      if (values.json) {
        io.stdout(JSON.stringify(result, null, 2));
      } else {
        io.stdout(formatClosedLoopOutput(result));
      }

      return { exitCode: result.success ? 0 : 1, data: result };
    }

    io.stderr(`Unknown subcommand: "${subcommand}". Run "spectra --help" for available commands.`);
    return { exitCode: 1 };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    if (args.includes('--json')) {
      io.stderr(JSON.stringify({ error: errorMsg }, null, 2));
    } else {
      io.stderr(`Error: ${errorMsg}`);
    }
    return { exitCode: 1 };
  }
}

// Direct execution detection in Node ESM
function isDirectRun(): boolean {
  if (typeof process === 'undefined' || !process.argv[1]) return false;
  try {
    const entryPath = fs.realpathSync(process.argv[1]);
    const modulePath = fs.realpathSync(fileURLToPath(import.meta.url));
    return entryPath === modulePath;
  } catch {
    return false;
  }
}

if (isDirectRun()) {
  runCli().then(({ exitCode }) => {
    process.exit(exitCode);
  });
}
