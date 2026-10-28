import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { runCli } from '../index.js';
import {
  MeasurementResultSchema,
  BenchmarkReportSchema,
  InvariantsDocumentSchema,
} from '@spectra/sdk';

function findProjectRoot(): string {
  let dir = process.cwd();
  while (!fs.existsSync(path.join(dir, 'pnpm-workspace.yaml'))) {
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return dir;
}

describe('@spectra/cli - Production CLI Offline Tests ($0.00 Spend)', () => {
  const root = findProjectRoot();
  const tempDir = path.join(root, 'packages/cli/src/__tests__/.tmp');

  beforeEach(() => {
    fs.mkdirSync(tempDir, { recursive: true });
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  function createTestIo() {
    let stdout = '';
    let stderr = '';
    return {
      io: {
        stdout: (msg: string) => {
          stdout += msg + '\n';
        },
        stderr: (msg: string) => {
          stderr += msg + '\n';
        },
      },
      getStdout: () => stdout,
      getStderr: () => stderr,
    };
  }

  describe('--help and general routing', () => {
    it('prints help and exits 0 when invoked with no args or --help', async () => {
      const { io, getStdout } = createTestIo();
      const res = await runCli([], io);
      expect(res.exitCode).toBe(0);
      expect(getStdout()).toContain('Spectra CLI');
      expect(getStdout()).toContain('SUBCOMMANDS:');
      expect(getStdout()).toContain('verify');
      expect(getStdout()).toContain('compile-invariant');
      expect(getStdout()).toContain('check');

      const { io: io2, getStdout: getStdout2 } = createTestIo();
      const res2 = await runCli(['--help'], io2);
      expect(res2.exitCode).toBe(0);
      expect(getStdout2()).toContain('Spectra CLI');
    });

    it('returns exit code 1 for unknown subcommands', async () => {
      const { io, getStderr } = createTestIo();
      const res = await runCli(['unknown-subcmd'], io);
      expect(res.exitCode).toBe(1);
      expect(getStderr()).toContain('Unknown subcommand');
    });
  });

  describe('spectra verify', () => {
    it('verifies canvas_000_v1 (0% clean control) with table output and exit code 0', async () => {
      const { io, getStdout } = createTestIo();
      const res = await runCli(
        [
          'verify',
          '--t0',
          path.join(root, 'benchmark/clips/canvas_000_v1_t0.png'),
          '--tk',
          path.join(root, 'benchmark/clips/canvas_000_v1_tk.png'),
          '--target',
          'Revenue Series Legend',
          '--bbox',
          '820,240,220,48',
          '--cached-sam',
          path.join(root, 'benchmark/responses/phase2-smoke/canvas_000_v1_sam.json'),
        ],
        io,
      );

      expect(res.exitCode).toBe(0);
      const out = getStdout();
      expect(out).toContain('SPECTRA VISUAL REFEREE VERDICT');
      expect(out).toContain('Instrument A (SAM 3.1):');
      expect(out).toContain('rSam = 0.9912');
      expect(out).toContain('Instrument B (Pixel Match):');
      expect(out).toContain('visRatio = 1.0000');
      expect(out).toContain('Calibration Guard:');
      expect(out).toContain('Final Referee Verdict:      PASS (VERIFIED)');
    });

    it('verifies canvas_000_v1 with --json output matching MeasurementResultSchema', async () => {
      const { io, getStdout } = createTestIo();
      const res = await runCli(
        [
          'verify',
          '--t0',
          path.join(root, 'benchmark/clips/canvas_000_v1_t0.png'),
          '--tk',
          path.join(root, 'benchmark/clips/canvas_000_v1_tk.png'),
          '--target',
          'Revenue Series Legend',
          '--bbox',
          '820,240,220,48',
          '--cached-sam',
          path.join(root, 'benchmark/responses/phase2-smoke/canvas_000_v1_sam.json'),
          '--json',
        ],
        io,
      );

      expect(res.exitCode).toBe(0);
      const parsed = JSON.parse(getStdout());
      const validated = MeasurementResultSchema.parse(parsed);
      expect(validated.combinedVerdict).toBe('pass');
      expect(validated.instrumentA.passed).toBe(true);
      expect(validated.instrumentB.passed).toBe(true);
      expect(validated.instrumentB.score).toBe(1.0);
    });

    it('catches dom_catch_010_v1 (10% occlusion) with exit code 1', async () => {
      const { io, getStdout } = createTestIo();
      const res = await runCli(
        [
          'verify',
          '--t0',
          path.join(root, 'benchmark/clips/dom_catch_010_v1_t0.png'),
          '--tk',
          path.join(root, 'benchmark/clips/dom_catch_010_v1_tk.png'),
          '--target',
          'Complete Checkout',
          '--bbox',
          '910,600,340,50',
          '--cached-sam',
          path.join(root, 'benchmark/responses/phase2-smoke/dom_catch_010_v1_sam.json'),
          '--json',
        ],
        io,
      );

      expect(res.exitCode).toBe(1);
      const parsed = JSON.parse(getStdout());
      const validated = MeasurementResultSchema.parse(parsed);
      expect(validated.combinedVerdict).toBe('fail');
      expect(validated.instrumentA.passed).toBe(false);
      expect(validated.instrumentB.passed).toBe(false);
      expect(validated.instrumentA.score).toBeCloseTo(0.908, 2);
      expect(validated.instrumentB.score).toBe(0.9);
    });

    it('errors when required options are missing or bbox is invalid', async () => {
      const { io: io1, getStderr: getStderr1 } = createTestIo();
      const res1 = await runCli(['verify', '--t0', 'some.png'], io1);
      expect(res1.exitCode).toBe(1);
      expect(getStderr1()).toContain('Missing required option: --tk');

      const { io: io2, getStderr: getStderr2 } = createTestIo();
      const res2 = await runCli(
        ['verify', '--t0', 'a.png', '--tk', 'b.png', '--target', 'btn', '--bbox', 'invalid,bbox'],
        io2,
      );
      expect(res2.exitCode).toBe(1);
      expect(getStderr2()).toContain('Invalid bbox format');
    });

    it('verifies canvas_000_v1 with ONLY --video and --target (zero-bbox, table output, exit 0)', async () => {
      const { io, getStdout } = createTestIo();
      const res = await runCli(
        [
          'verify',
          '--video',
          'benchmark/clips/canvas_000_v1.mp4',
          '--target',
          'Revenue Series Legend',
        ],
        io,
      );

      expect(res.exitCode).toBe(0);
      const out = getStdout();
      expect(out).toContain('SPECTRA VISUAL REFEREE VERDICT');
      expect(out).toContain('Input Source:               benchmark/clips/canvas_000_v1.mp4');
      expect(out).toContain('Target Element:             Revenue Series Legend');
      expect(out).toContain('Instrument A (SAM 3.1):');
      expect(out).toContain('rSam = 0.9912');
      expect(out).toContain('Instrument B (Pixel Match):');
      expect(out).toContain('visRatio = 1.0000');
      expect(out).toContain('Calibration Guard:');
      expect(out).toContain('Final Referee Verdict:      PASS (VERIFIED)');
    });

    it('catches dom_catch_010_v1 with ONLY --video and --target (zero-bbox, table output, exit 1)', async () => {
      const { io, getStdout } = createTestIo();
      const res = await runCli(
        [
          'verify',
          '--video',
          'benchmark/clips/dom_catch_010_v1.mp4',
          '--target',
          'Complete Checkout',
        ],
        io,
      );

      expect(res.exitCode).toBe(1);
      const out = getStdout();
      expect(out).toContain('SPECTRA VISUAL REFEREE VERDICT');
      expect(out).toContain('Input Source:               benchmark/clips/dom_catch_010_v1.mp4');
      expect(out).toContain('Target Element:             Complete Checkout');
      expect(out).toContain('Instrument A (SAM 3.1):');
      expect(out).toContain('estimatedOcclusion = 9.20%');
      expect(out).toContain('Instrument B (Pixel Match):');
      expect(out).toContain('Final Referee Verdict:      FAIL (REJECTED)');
    });

    it('verifies dom_catch_010_v1 with ONLY --video and --target with --json flag (exit 1)', async () => {
      const { io, getStdout } = createTestIo();
      const res = await runCli(
        [
          'verify',
          '--video',
          'benchmark/clips/dom_catch_010_v1.mp4',
          '--target',
          'Complete Checkout',
          '--json',
        ],
        io,
      );

      expect(res.exitCode).toBe(1);
      const parsed = JSON.parse(getStdout());
      const validated = MeasurementResultSchema.parse(parsed);
      expect(validated.clipId).toBe('dom_catch_010_v1');
      expect(validated.combinedVerdict).toBe('fail');
      expect(validated.instrumentA.score).toBeCloseTo(0.908, 2);
      expect(validated.instrumentB.score).toBe(0.9);
      expect(validated.instrumentA.passed).toBe(false);
      expect(validated.instrumentB.passed).toBe(false);
    });
  });

  describe('spectra compile-invariant', () => {
    it('compiles invariants from cached voice smoke directory and writes output file', async () => {
      const outPath = path.join(tempDir, 'invariants_test.json');
      const { io, getStdout } = createTestIo();

      const res = await runCli(
        [
          'compile-invariant',
          '--cached-dir',
          path.join(root, 'benchmark/responses/voice-smoke'),
          '--out',
          outPath,
        ],
        io,
      );

      expect(res.exitCode).toBe(0);
      expect(getStdout()).toContain('SPECTRA INVARIANT COMPILER');
      expect(getStdout()).toContain('Invariants Compiled: 2');
      expect(fs.existsSync(outPath)).toBe(true);

      const written = JSON.parse(fs.readFileSync(outPath, 'utf-8'));
      const validated = InvariantsDocumentSchema.parse(written);
      expect(validated.invariants.length).toBe(2);
      expect(validated.invariants[0].id).toBe('complete-checkout-button-visible');
    });

    it('compiles invariants with --json flag printing InvariantsDocument to stdout', async () => {
      const outPath = path.join(tempDir, 'invariants_json_test.json');
      const { io, getStdout } = createTestIo();

      const res = await runCli(
        [
          'compile-invariant',
          '--cached-dir',
          path.join(root, 'benchmark/responses/voice-smoke'),
          '--out',
          outPath,
          '--json',
        ],
        io,
      );

      expect(res.exitCode).toBe(0);
      const parsed = JSON.parse(getStdout());
      const validated = InvariantsDocumentSchema.parse(parsed);
      expect(validated.invariants.length).toBe(2);
    });

    it('errors when --out is omitted or no input is provided', async () => {
      const { io, getStderr } = createTestIo();
      const res = await runCli(['compile-invariant', '--transcript', 'foo'], io);
      expect(res.exitCode).toBe(1);
      expect(getStderr()).toContain('Missing required option: --out');
    });
  });

  describe('spectra check', () => {
    it('checks invariants against benchmark manifest and outputs BenchmarkReport', async () => {
      const { io, getStdout } = createTestIo();

      const res = await runCli(
        [
          'check',
          '--invariants',
          path.join(root, '.spectra/invariants.json'),
          '--manifest',
          path.join(root, 'benchmark/manifest.json'),
          '--cached-sam-dir',
          path.join(root, 'benchmark/responses/phase2-smoke'),
          '--json',
        ],
        io,
      );

      // Manifest includes occluded clips (e.g. dom_catch_010_v1, dom_catch_040_v1), so exit code is 1
      expect(res.exitCode).toBe(1);
      const parsed = JSON.parse(getStdout());
      const report = BenchmarkReportSchema.parse(parsed);
      expect(report.results.length).toBe(45);
      expect(report.calibration.sigma_noise).toBe(0.0045);

      const canvas000 = report.results.find((r) => r.clipId === 'canvas_000_v1');
      expect(canvas000).toBeDefined();
      expect(canvas000?.combinedVerdict).toBe('pass');

      const domCatch010 = report.results.find((r) => r.clipId === 'dom_catch_010_v1');
      expect(domCatch010).toBeDefined();
      expect(domCatch010?.combinedVerdict).toBe('fail');
    });

    it('checks invariants with table output', async () => {
      const { io, getStdout } = createTestIo();

      const res = await runCli(
        [
          'check',
          '--invariants',
          path.join(root, '.spectra/invariants.json'),
          '--manifest',
          path.join(root, 'benchmark/manifest.json'),
          '--cached-sam-dir',
          path.join(root, 'benchmark/responses/phase2-smoke'),
        ],
        io,
      );

      expect(res.exitCode).toBe(1);
      const out = getStdout();
      expect(out).toContain('SPECTRA BENCHMARK CHECK REPORT');
      expect(out).toContain('Total Clips:   45');
      expect(out).toContain('OVERALL:       FAIL');
    });

    it('errors when --invariants or --manifest is omitted', async () => {
      const { io, getStderr } = createTestIo();
      const res = await runCli(['check', '--invariants', 'foo.json'], io);
      expect(res.exitCode).toBe(1);
      expect(getStderr()).toContain('Missing required option: --manifest');
    });
  });

  describe('spectra closed-loop-demo', () => {
    it('runs closed-loop referee demo for scenario s3', async () => {
      const { io, getStdout } = createTestIo();
      const res = await runCli(['closed-loop-demo', '--scenario', 's3'], io);

      expect(res.exitCode).toBe(0);
      const out = getStdout();
      expect(out).toContain('SPECTRA CLOSED-LOOP REFEREE: SCENARIO S3');
      expect(out).toContain('PHASE 1: TRADITIONAL DOM / QA BASELINE');
      expect(out).toContain('PASS (FALSE PASS)');
      expect(out).toContain('PHASE 2: PASS #1 — SPECTRA DUAL-INSTRUMENT REFEREE CATCH');
      expect(out).toContain('FAIL (REJECTED)');
      expect(out).toContain('PHASE 3: AI AGENT REPAIR STEP');
      expect(out).toContain('.cart-drawer-footer');
      expect(out).toContain('PHASE 4: PASS #2 — SPECTRA CLOSED-LOOP RE-VERIFICATION');
      expect(out).toContain('PASS (VERIFIED)');
      expect(out).toContain('CLOSED-LOOP OUTCOME:  SUCCESS');
    });

    it('runs closed-loop referee demo for scenario s1 (canvas)', async () => {
      const { io, getStdout } = createTestIo();
      const res = await runCli(['closed-loop-demo', '--scenario', 's1'], io);

      expect(res.exitCode).toBe(0);
      const out = getStdout();
      expect(out).toContain(
        'SPECTRA CLOSED-LOOP REFEREE: SCENARIO S1: HTML5 CANVAS CHART COLLISION',
      );
      expect(out).toContain('playwright_dom_node_count');
      expect(out).toContain('FAIL (REJECTED)');
      expect(out).toContain('PASS (VERIFIED)');
      expect(out).toContain('CLOSED-LOOP OUTCOME:  SUCCESS');
    });

    it('runs closed-loop referee demo for scenario s2 (mobile_mp4)', async () => {
      const { io, getStdout } = createTestIo();
      const res = await runCli(['closed-loop-demo', '--scenario', 's2'], io);

      expect(res.exitCode).toBe(0);
      const out = getStdout();
      expect(out).toContain(
        'SPECTRA CLOSED-LOOP REFEREE: SCENARIO S2: MOBILE PROMO BOTTOM-SHEET OVERLAP',
      );
      expect(out).toContain('raw_video_stream_no_dom');
      expect(out).toContain('FAIL (REJECTED)');
      expect(out).toContain('PASS (VERIFIED)');
      expect(out).toContain('CLOSED-LOOP OUTCOME:  SUCCESS');
    });

    it('runs all closed-loop scenarios by default and prints summary report', async () => {
      const { io, getStdout } = createTestIo();
      const res = await runCli(['closed-loop-demo'], io);

      expect(res.exitCode).toBe(0);
      const out = getStdout();
      expect(out).toContain('SPECTRA CLOSED-LOOP ALL-SCENARIOS SUMMARY REPORT (S1, S2, S3)');
      expect(out).toContain('ALL SCENARIOS VERIFIED (100% REPAIR-TO-PASS)');
    });

    it('runs closed-loop referee demo with --json output', async () => {
      const { io, getStdout } = createTestIo();
      const res = await runCli(['closed-loop-demo', '--json'], io);

      expect(res.exitCode).toBe(0);
      const parsed = JSON.parse(getStdout());
      expect(parsed.allScenarios).toBeDefined();
      expect(parsed.allScenarios.s1.success).toBe(true);
      expect(parsed.allScenarios.s2.success).toBe(true);
      expect(parsed.allScenarios.s3.success).toBe(true);
    });
  });
});
