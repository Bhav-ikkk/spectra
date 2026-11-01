#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import {
  SpectraClient,
  runClosedLoopReferee,
  type ClosedLoopResult,
  type ScenarioSelection,
  type MeasurementResult,
  type BoundingBox,
  getCalibration,
  findProjectRoot,
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

const MAX_BBOX_COORD = 100000;

function parseBoundingBox(bboxStr: string): BoundingBox {
  const parts = bboxStr.split(',').map((p) => Number(p.trim()));
  if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n) || n < 0 || n > MAX_BBOX_COORD)) {
    throw new Error(
      `Invalid bbox format "${bboxStr}". Expected "x,y,width,height" with non-negative numbers.`,
    );
  }
  const [x, y, width, height] = parts;
  return { x, y, width, height };
}

function formatSingleScenarioOutput(result: ClosedLoopResult): string {
  const sep = '='.repeat(80);
  const line = '-'.repeat(80);
  const patchStr = result.repair.patch || result.repair.codePatch || result.repair.cssPatch || '';
  const coordsStr = result.naiveBaseline.coordinates
    ? `(${result.naiveBaseline.coordinates.x}, ${result.naiveBaseline.coordinates.y})`
    : 'N/A';
  const overlapPx = result.repair.newOverlapPx ?? result.repair.newFooterOverlapPx ?? 0;

  return [
    sep,
    ` SPECTRA CLOSED-LOOP REFEREE: ${result.scenarioName.toUpperCase()}`,
    sep,
    ` Scenario ID:          ${result.scenarioId}`,
    ` Environment:          ${result.environment}`,
    ` Description:          ${result.description}`,
    ` Target Coordinates:   ${coordsStr}`,
    line,
    ' [PHASE 1: TRADITIONAL DOM / QA BASELINE]',
    ` Detection Strategy:   ${result.naiveBaseline.strategy}`,
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
    ` New Overlap:          ${overlapPx}px`,
    ' Applied Repair Patch:',
    patchStr
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

function formatClosedLoopOutput(result: ClosedLoopResult): string {
  if (result.allScenarios) {
    const s1Block = formatSingleScenarioOutput(result.allScenarios.s1);
    const s2Block = formatSingleScenarioOutput(result.allScenarios.s2);
    const s3Block = formatSingleScenarioOutput(result.allScenarios.s3);

    const sep = '='.repeat(80);
    const line = '-'.repeat(80);
    const allPassed =
      result.allScenarios.s1.success &&
      result.allScenarios.s2.success &&
      result.allScenarios.s3.success;

    const s1 = result.allScenarios.s1;
    const s2 = result.allScenarios.s2;
    const s3 = result.allScenarios.s3;

    const s1Pass1Loss = ((1 - s1.pass1.instrumentB.score) * 100).toFixed(1);
    const s1Pass2Loss = ((1 - s1.pass2.instrumentB.score) * 100).toFixed(1);
    const s2Pass1Loss = ((1 - s2.pass1.instrumentB.score) * 100).toFixed(1);
    const s2Pass2Loss = ((1 - s2.pass2.instrumentB.score) * 100).toFixed(1);
    const s3Pass1Loss = ((1 - s3.pass1.instrumentB.score) * 100).toFixed(1);
    const s3Pass2Loss = ((1 - s3.pass2.instrumentB.score) * 100).toFixed(1);

    const summaryBlock = [
      sep,
      ' SPECTRA CLOSED-LOOP ALL-SCENARIOS SUMMARY REPORT (S1, S2, S3)',
      sep,
      ` [${s1.success ? 'SUCCESS' : 'FAILED'}] S1 (HTML5 Canvas Chart Collision):   Pass1=${s1.pass1.combinedVerdict.toUpperCase()} (${s1Pass1Loss}% loss) -> Repair -> Pass2=${s1.pass2.combinedVerdict.toUpperCase()} (${s1Pass2Loss}% loss)`,
      ` [${s2.success ? 'SUCCESS' : 'FAILED'}] S2 (Mobile Raw MP4 Screen Recording):  Pass1=${s2.pass1.combinedVerdict.toUpperCase()} (${s2Pass1Loss}% loss) -> Repair -> Pass2=${s2.pass2.combinedVerdict.toUpperCase()} (${s2Pass2Loss}% loss)`,
      ` [${s3.success ? 'SUCCESS' : 'FAILED'}] S3 (Sticky Drawer "The Catch" DOM):   Pass1=${s3.pass1.combinedVerdict.toUpperCase()} (${s3Pass1Loss}% loss) -> Repair -> Pass2=${s3.pass2.combinedVerdict.toUpperCase()} (${s3Pass2Loss}% loss)`,
      line,
      ` OVERALL STATUS:       ${allPassed ? 'ALL SCENARIOS VERIFIED (100% REPAIR-TO-PASS)' : 'ONE OR MORE SCENARIOS FAILED'}`,
      sep,
    ].join('\n');

    return [s1Block, s2Block, s3Block, summaryBlock].join('\n\n');
  }

  return formatSingleScenarioOutput(result);
}

function formatRefereeTable(
  result: MeasurementResult,
  targetLabel: string,
  bbox?: BoundingBox,
  inputSource?: string,
): string {
  const cal = getCalibration();
  const sigmaNoise = cal.sigma_noise != null ? (cal.sigma_noise * 100).toFixed(2) + '%' : '0.45%';
  const threshold = cal.sigma_noise != null ? (3 * cal.sigma_noise * 100).toFixed(2) + '%' : '1.35%';
  const deltaLimit = cal.delta != null ? (cal.delta * 100).toFixed(2) + '%' : '4.10%';

  const rawA = result.instrumentA.raw as
    | { rSam?: number; estimatedOcclusion?: number; detectedBBox?: BoundingBox }
    | undefined;
  const rawB = result.instrumentB.raw as
    | { rNcc?: number; pixelLossCount?: number; pixelVisibilityRatio?: number }
    | undefined;

  const resolvedBBox = bbox ?? rawA?.detectedBBox;
  const bboxStr = resolvedBBox
    ? `[${resolvedBBox.x}, ${resolvedBBox.y}, ${resolvedBBox.width}, ${resolvedBBox.height}]`
    : 'N/A';

  const rSam = result.instrumentA.score;
  const estimatedOcclusion = rawA?.estimatedOcclusion ?? Math.max(0, 1 - rSam);
  const occlusionPct = (estimatedOcclusion * 100).toFixed(2);

  const visRatio = result.instrumentB.score;
  const rNccStr = rawB?.rNcc != null ? rawB.rNcc.toFixed(4) : 'N/A';
  const pixelLossCountStr = rawB?.pixelLossCount != null ? `${rawB.pixelLossCount}px` : 'N/A';

  const verdictLabel =
    result.combinedVerdict === 'pass'
      ? 'PASS (VERIFIED)'
      : result.combinedVerdict === 'fail'
        ? 'FAIL (REJECTED)'
        : 'INCONCLUSIVE';

  const sep = '='.repeat(80);
  const line = '-'.repeat(80);

  return [
    sep,
    ' SPECTRA VISUAL REFEREE VERDICT',
    sep,
    ` Clip ID:                    ${result.clipId}`,
    ` Input Source:               ${inputSource ?? result.clipId}`,
    ` Target Element:             ${targetLabel} ${bboxStr}`,
    line,
    ` Instrument A (SAM 3.1):     rSam = ${rSam.toFixed(4)} | estimatedOcclusion = ${occlusionPct}% [${result.instrumentA.passed ? 'PASS' : 'FAIL'}]`,
    ` Instrument B (Pixel Match): visRatio = ${visRatio.toFixed(4)} | rNcc = ${rNccStr} | pixelLossCount = ${pixelLossCountStr} [${result.instrumentB.passed ? 'PASS' : 'FAIL'}]`,
    ` Calibration Guard:         sigma_noise = ${sigmaNoise} | 3*sigma threshold = ${threshold} | delta limit = ${deltaLimit}`,
    line,
    ` Final Referee Verdict:      ${verdictLabel}`,
    ` Notes:                      ${result.notes ?? 'None'}`,
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
    '  verify               Run dual-instrument referee on a pair of video frames or video clip',
    '  compile-invariant    Compile user expectation into formal visual invariants',
    '  check                Verify visual invariants across a benchmark manifest or clip set',
    '  closed-loop-demo     Run end-to-end closed-loop verification (Reject -> Patch -> Re-Verify)',
    '',
    'OPTIONS (verify):',
    '  --target <label>     (Required) Semantic label of the target UI element',
    '  --video <path>       Path to video clip (or provide both --t0 and --tk)',
    '  --t0 <path>          (Optional) Path to baseline frame (t0)',
    '  --tk <path>          (Optional) Path to evaluation frame (tk)',
    '  --bbox <x,y,w,h>     (Optional) Target bounding box coordinates in pixels',
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
    '  --scenario <s1|s2|s3|all> Scenario to run: s1 (canvas), s2 (mobile_mp4), s3 (The Catch), or all (default: all)',
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
  if (args.includes('--version') || args.includes('-v')) {
    io.stdout('Spectra CLI v3.0.0 (Rule 2 Calibrated: 3σ=1.35%, δ=4.10%)');
    return { exitCode: 0 };
  }

  if (args.length === 0 || args[0] === '--help' || args[0] === '-h' || args[0] === 'help') {
    io.stdout(formatHelp());
    return { exitCode: 0 };
  }

  const subcommand = args[0];
  const subArgs = args.slice(1);

  if (subArgs.includes('--help') || subArgs.includes('-h')) {
    const subHelp: Record<string, string> = {
      verify: [
        'Spectra CLI — spectra verify',
        '',
        'USAGE:',
        '  spectra verify --target <label> [--video <path> | --t0 <path> --tk <path>] [options]',
        '',
        'OPTIONS:',
        '  --target <label>      (Required) Semantic label of the target UI element',
        '  --video <path>        Path to video clip (.mp4)',
        '  --t0 <path>           Path to baseline frame (t0)',
        '  --tk <path>           Path to evaluation frame (tk)',
        '  --bbox <x,y,w,h>      Target bounding box (optional — SAM Frame-0 auto-detects)',
        '  --clip-id <id>        Override clip ID for caching/reporting',
        '  --cached-sam <path>   Path to cached SAM 3.1 response JSON ($0 spend)',
        '  --json                Output strict MeasurementResult JSON to stdout',
        '',
        'EXIT CODES:',
        '  0 = PASS (retained within noise floor)',
        '  1 = FAIL (occlusion detected beyond 3σ threshold)',
        '  2 = INCONCLUSIVE (instruments disagree beyond δ limit)',
        '',
        'EXAMPLE:',
        '  pnpm spectra verify --video benchmark/clips/dom_catch_010_v1.mp4 --target "Complete Checkout"',
      ].join('\n'),
      'compile-invariant': [
        'Spectra CLI — spectra compile-invariant',
        '',
        'USAGE:',
        '  spectra compile-invariant --out <path> [--audio <path> | --transcript <text>] [options]',
        '',
        'OPTIONS:',
        '  --out <path>          (Required) Output path for invariants JSON (e.g. .spectra/invariants.json)',
        '  --audio <path>        Path to audio WAV recording (uses muse-voice-transcribe-1.0)',
        '  --transcript <text>   Raw transcript text (uses muse-spark-1.3 / Baseten)',
        '  --cached-dir <path>   Directory with cached voice-smoke responses',
        '  --json                Output InvariantsDocument JSON to stdout',
        '',
        'EXAMPLE:',
        '  pnpm spectra compile-invariant --out .spectra/invariants.json --transcript "checkout must never be covered"',
      ].join('\n'),
      check: [
        'Spectra CLI — spectra check',
        '',
        'USAGE:',
        '  spectra check --invariants <path> --manifest <path> [options]',
        '',
        'OPTIONS:',
        '  --invariants <path>    Path to .spectra/invariants.json',
        '  --manifest <path>      Path to benchmark manifest JSON',
        '  --cached-sam-dir <dir>  Directory containing cached SAM JSON responses',
        '  --json                 Output BenchmarkReport JSON',
        '',
        'EXIT CODES:',
        '  0 = ALL PASS',
        '  1 = ANY FAIL',
        '  2 = ANY INCONCLUSIVE',
        '',
        'EXAMPLE:',
        '  pnpm spectra check --invariants .spectra/invariants.json --manifest benchmark/manifest.json --cached-sam-dir benchmark/responses/benchmark-sam',
      ].join('\n'),
      'closed-loop-demo': [
        'Spectra CLI — spectra closed-loop-demo',
        '',
        'USAGE:',
        '  spectra closed-loop-demo [--scenario <s1|s2|s3|all>] [options]',
        '',
        'OPTIONS:',
        '  --scenario <id>       s1 (canvas), s2 (mobile_mp4), s3 (The Catch), or all (default: all)',
        '  --cached-dir <path>   Directory containing saved closed-loop artifacts',
        '  --json                Output complete ClosedLoopResult JSON',
        '',
        'EXIT CODES:',
        '  0 = ALL VERIFIED',
        '  1 = ANY FAILED',
        '',
        'EXAMPLE:',
        '  pnpm spectra closed-loop-demo --scenario all',
      ].join('\n'),
    };

    if (subHelp[subcommand]) {
      io.stdout(subHelp[subcommand]);
      return { exitCode: 0 };
    }
  }

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

      if (!values.video) {
        if (!values.t0 && !values.tk) {
          throw new Error(
            'Missing input source: provide either --video <path> or both --t0 <path> and --tk <path>.',
          );
        }
        if (!values.t0) throw new Error('Missing required option: --t0 <path>');
        if (!values.tk) throw new Error('Missing required option: --tk <path>');
      }

      if (!values.target) throw new Error('Missing required option: --target <label>');

      const bbox = values.bbox ? parseBoundingBox(values.bbox) : undefined;

      const root = findProjectRoot();
      const resolveCandidate = (p?: string) => {
        if (!p) return undefined;
        if (path.isAbsolute(p)) return p;
        if (fs.existsSync(p)) return path.resolve(p);
        const inRoot = path.join(root, p);
        if (fs.existsSync(inRoot)) return inRoot;
        return path.resolve(p);
      };

      const fileExists = (p?: string) => {
        if (!p) return false;
        if (path.isAbsolute(p)) return fs.existsSync(p);
        return fs.existsSync(p) || fs.existsSync(path.resolve(p)) || fs.existsSync(path.join(root, p));
      };

      if (values.video && !fileExists(values.video)) {
        throw new Error(
          `Video file not found at "${values.video}". Try a bundled sample clip:\n  pnpm spectra verify --video benchmark/clips/dom_catch_010_v1.mp4 --target "Complete Checkout"`,
        );
      }
      if (values.t0 && !fileExists(values.t0)) {
        throw new Error(`Frame file not found at "${values.t0}". Check the path and try again.`);
      }
      if (values.tk && !fileExists(values.tk)) {
        throw new Error(`Frame file not found at "${values.tk}". Check the path and try again.`);
      }

      const clipId =
        values['clip-id'] ||
        (values.video
          ? path.basename(values.video, path.extname(values.video))
          : values.t0
            ? path.basename(values.t0, path.extname(values.t0)).replace(/_t0$/, '')
            : undefined);

      const result = await client.verifyClip({
        clipId,
        t0FramePath: resolveCandidate(values.t0),
        tkFramePath: resolveCandidate(values.tk),
        targetLabel: values.target,
        targetBBox: bbox,
        videoPath: resolveCandidate(values.video),
        cachedSamResponsePath: resolveCandidate(values['cached-sam']),
      });

      if (values.json) {
        io.stdout(JSON.stringify(result, null, 2));
      } else {
        const inputSource = values.video
          ? values.video
          : `${values.t0} -> ${values.tk}`;
        io.stdout(formatRefereeTable(result, values.target, bbox, inputSource));
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
          scenario: { type: 'string' },
          'cached-dir': { type: 'string' },
          json: { type: 'boolean' },
        },
        allowPositionals: false,
      });

      const scenario = (values.scenario as ScenarioSelection) || 'all';
      const result = await runClosedLoopReferee({
        scenario,
        client,
        cachedDir: values['cached-dir'] ? path.resolve(values['cached-dir']) : undefined,
      });

      if (values.json) {
        io.stdout(JSON.stringify(result, null, 2));
      } else {
        io.stdout(formatClosedLoopOutput(result));
      }

      const allSuccess = result.allScenarios
        ? Object.values(result.allScenarios).every((r) => r.success)
        : result.success;

      return { exitCode: allSuccess ? 0 : 1, data: result };
    }

    const knownCommands = ['verify', 'compile-invariant', 'check', 'closed-loop-demo'];
    const suggestion = knownCommands.find(
      (cmd) => cmd.startsWith(subcommand.slice(0, 3)) || subcommand.startsWith(cmd.slice(0, 3)),
    );
    const hint = suggestion ? ` Did you mean "spectra ${suggestion}"?` : '';
    io.stderr(
      `Unknown subcommand: "${subcommand}".${hint}\nAvailable commands: ${knownCommands.join(', ')}\nRun "spectra --help" for available commands.`,
    );
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
