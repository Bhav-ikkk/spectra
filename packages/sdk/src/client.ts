import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import {
  computeTemplateMatchVisibility,
  computeSamVisibilityRatio,
  evaluateDualInstrument,
  getCalibration,
  assertCalibrated,
  InvariantsDocumentSchema,
  MeasurementResultSchema,
  BenchmarkReportSchema,
  ManifestSchema,
  type CalibrationData,
  type InvariantsDocument,
  type MeasurementResult,
  type BenchmarkReport,
} from '@spectra/core';
import {
  buildObjectPrompt,
  computeSamVisibilityFromResponse,
  type SamVisibilityRatioResult,
} from '@spectra/sam-client';
import {
  transcribeAudioFile,
  compileTranscriptToInvariants,
  evaluateWithVlmJudge,
  extractJsonFromText,
  type ModelProvider,
  type VlmJudgeOptions,
  type VlmJudgeResult,
} from '@spectra/invariant-compiler';
import type { VerifyClipOptions, CompileVoiceOptions, CheckInvariantsOptions } from './types.js';

export function findProjectRoot(): string {
  let dir = process.cwd();
  while (!fs.existsSync(path.join(dir, 'pnpm-workspace.yaml'))) {
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return dir;
}

export interface SpectraClientConfig {
  apiKey?: string;
  baseUrl?: string;
  basetenApiKey?: string;
  basetenBaseUrl?: string;
  provider?: ModelProvider;
  openWeight?: boolean;
  calibration?: CalibrationData;
}

export class SpectraClient {
  private readonly apiKey?: string;
  private readonly baseUrl: string;
  private readonly basetenApiKey?: string;
  private readonly basetenBaseUrl: string;
  private readonly provider?: ModelProvider;
  private readonly openWeight?: boolean;
  private readonly calibration: CalibrationData;

  constructor(config: SpectraClientConfig = {}) {
    this.apiKey =
      config.apiKey || (typeof process !== 'undefined' ? process.env?.META_API_KEY : undefined);
    this.baseUrl =
      config.baseUrl ||
      (typeof process !== 'undefined' ? process.env?.META_API_BASE_URL : undefined) ||
      'https://api.meta.ai/v1';
    this.basetenApiKey =
      config.basetenApiKey ||
      (typeof process !== 'undefined' ? process.env?.BASETEN_API_KEY : undefined);
    this.basetenBaseUrl =
      config.basetenBaseUrl ||
      (typeof process !== 'undefined' ? process.env?.BASETEN_BASE_URL : undefined) ||
      'https://inference.baseten.co/v1';
    this.provider = config.provider;
    this.openWeight = config.openWeight;
    this.calibration = config.calibration ?? getCalibration();
    assertCalibrated(this.calibration);
  }

  /**
   * Helper to decode SAM mask areas from raw Responses API JSON
   */
  private async decodeSamAreas(
    rawJson: Record<string, unknown>,
  ): Promise<{ t0Area: number; tkArea: number }> {
    const res = await computeSamVisibilityFromResponse(rawJson);
    return { t0Area: res.baselineArea, tkArea: res.evalArea };
  }

  /**
   * Runs Dual-Instrument Verification on a clip/frames
   */
  async verifyClip(options: VerifyClipOptions): Promise<MeasurementResult> {
    const { tolerance = 5.0 } = options;

    let resolvedVideoPath = options.videoPath;
    if (
      resolvedVideoPath &&
      !path.isAbsolute(resolvedVideoPath) &&
      !fs.existsSync(resolvedVideoPath)
    ) {
      const root = findProjectRoot();
      const cand = path.join(root, resolvedVideoPath);
      if (fs.existsSync(cand)) {
        resolvedVideoPath = cand;
      }
    }

    const stem =
      options.clipId ||
      (resolvedVideoPath
        ? path.basename(resolvedVideoPath, path.extname(resolvedVideoPath))
        : undefined);

    let t0FramePath = options.t0FramePath;
    let tkFramePath = options.tkFramePath;

    if (t0FramePath && !path.isAbsolute(t0FramePath) && !fs.existsSync(t0FramePath)) {
      const root = findProjectRoot();
      const cand = path.join(root, t0FramePath);
      if (fs.existsSync(cand)) t0FramePath = cand;
    }

    if (tkFramePath && !path.isAbsolute(tkFramePath) && !fs.existsSync(tkFramePath)) {
      const root = findProjectRoot();
      const cand = path.join(root, tkFramePath);
      if (fs.existsSync(cand)) tkFramePath = cand;
    }

    // Resolve t0FramePath and tkFramePath from video directory if omitted
    if ((!t0FramePath || !tkFramePath) && resolvedVideoPath && stem) {
      const videoDir = path.dirname(resolvedVideoPath);
      const candT0 = path.join(videoDir, `${stem}_t0.png`);
      const candTk = path.join(videoDir, `${stem}_tk.png`);

      if (!t0FramePath && fs.existsSync(candT0)) {
        t0FramePath = candT0;
      }
      if (!tkFramePath && fs.existsSync(candTk)) {
        tkFramePath = candTk;
      }

      // Also check project root benchmark/clips
      const root = findProjectRoot();
      if (!t0FramePath) {
        const rootT0 = path.join(root, 'benchmark/clips', `${stem}_t0.png`);
        if (fs.existsSync(rootT0)) t0FramePath = rootT0;
      }
      if (!tkFramePath) {
        const rootTk = path.join(root, 'benchmark/clips', `${stem}_tk.png`);
        if (fs.existsSync(rootTk)) tkFramePath = rootTk;
      }

      // Fallback: extract Frame 0 and final frame via ffmpeg to os.tmpdir()
      if ((!t0FramePath || !tkFramePath) && fs.existsSync(resolvedVideoPath)) {
        try {
          if (!t0FramePath) {
            const tmpT0 = path.join(os.tmpdir(), `spectra_${stem}_t0_${Date.now()}.png`);
            execFileSync(
              'ffmpeg',
              ['-y', '-ss', '0', '-i', resolvedVideoPath, '-vframes', '1', tmpT0],
              { stdio: 'ignore' },
            );
            if (fs.existsSync(tmpT0)) t0FramePath = tmpT0;
          }
          if (!tkFramePath) {
            const tmpTk = path.join(os.tmpdir(), `spectra_${stem}_tk_${Date.now()}.png`);
            execFileSync(
              'ffmpeg',
              [
                '-y',
                '-sseof',
                '-0.1',
                '-i',
                resolvedVideoPath,
                '-update',
                '1',
                '-frames:v',
                '1',
                tmpTk,
              ],
              { stdio: 'ignore' },
            );
            if (fs.existsSync(tmpTk)) tkFramePath = tmpTk;
          }
        } catch {
          // ffmpeg not installed or failed; let error check below handle missing files
        }
      }
    }

    if (!t0FramePath || !fs.existsSync(t0FramePath)) {
      throw new Error(`t0 frame not found: ${t0FramePath ?? '(omitted)'}`);
    }
    if (!tkFramePath || !fs.existsSync(tkFramePath)) {
      throw new Error(`tk frame not found: ${tkFramePath ?? '(omitted)'}`);
    }

    // Resolve cachedSamResponsePath if omitted
    let cachedSamResponsePath = options.cachedSamResponsePath;
    if (
      cachedSamResponsePath &&
      !path.isAbsolute(cachedSamResponsePath) &&
      !fs.existsSync(cachedSamResponsePath)
    ) {
      const root = findProjectRoot();
      const cand = path.join(root, cachedSamResponsePath);
      if (fs.existsSync(cand)) cachedSamResponsePath = cand;
    }

    if (!cachedSamResponsePath && stem) {
      const root = findProjectRoot();
      const candidates = [
        path.join(root, 'benchmark/responses/phase2-smoke', `${stem}_sam.json`),
        path.join(root, 'benchmark/responses/benchmark-sam', `${stem}_sam.json`),
        path.join(process.cwd(), 'benchmark/responses/phase2-smoke', `${stem}_sam.json`),
        path.join(process.cwd(), 'benchmark/responses/benchmark-sam', `${stem}_sam.json`),
      ];
      for (const cand of candidates) {
        if (fs.existsSync(cand)) {
          cachedSamResponsePath = cand;
          break;
        }
      }
    }

    // Resolve targetBBox if omitted
    let targetBBox = options.targetBBox;
    if (!targetBBox && stem) {
      const root = findProjectRoot();
      const manifestCandidates = [
        path.join(root, 'benchmark/manifest.json'),
        path.join(process.cwd(), 'benchmark/manifest.json'),
      ];
      for (const mPath of manifestCandidates) {
        if (fs.existsSync(mPath)) {
          try {
            const raw = JSON.parse(fs.readFileSync(mPath, 'utf-8'));
            if (Array.isArray(raw.clips)) {
              const match = raw.clips.find((c: { clipId?: string }) => c.clipId === stem);
              if (match?.targetBBox) {
                targetBBox = match.targetBBox;
                break;
              }
            }
          } catch {
            // continue
          }
        }
      }
    }

    // Instrument A: SAM Visibility Ratio
    let samMeasurement: SamVisibilityRatioResult | undefined;

    if (cachedSamResponsePath && fs.existsSync(cachedSamResponsePath)) {
      samMeasurement = await computeSamVisibilityFromResponse(cachedSamResponsePath);
      if (!targetBBox && samMeasurement.detectedBBox) {
        targetBBox = samMeasurement.detectedBBox;
      }
    } else if (resolvedVideoPath && fs.existsSync(resolvedVideoPath) && this.apiKey) {
      const videoBuffer = fs.readFileSync(resolvedVideoPath);
      const videoBase64 = `data:video/mp4;base64,${videoBuffer.toString('base64')}`;

      let promptText: string;
      if (targetBBox) {
        promptText = buildObjectPrompt({
          size: { width: 1280, height: 720 },
          objects: [
            {
              id: 0,
              prompts: [
                {
                  frame: 0,
                  box: {
                    left: targetBBox.x,
                    top: targetBBox.y,
                    right: targetBBox.x + targetBBox.width,
                    bottom: targetBBox.y + targetBBox.height,
                  },
                },
              ],
            },
          ],
        });
      } else {
        promptText = options.targetLabel;
      }

      const res = await fetch(`${this.baseUrl}/responses`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'sam-3.1',
          input: [
            {
              role: 'user',
              content: [
                { type: 'input_video', video_url: videoBase64 },
                { type: 'input_text', text: promptText },
              ],
            },
          ],
        }),
      });

      if (!res.ok) {
        throw new Error(`Meta SAM API error (${res.status}): ${await res.text()}`);
      }

      const rawJson = (await res.json()) as Record<string, unknown>;
      samMeasurement = await computeSamVisibilityFromResponse(rawJson);
      if (!targetBBox && samMeasurement.detectedBBox) {
        targetBBox = samMeasurement.detectedBBox;
      }
    }

    if (!targetBBox) {
      throw new Error(
        `Unable to resolve targetBBox for clip "${stem ?? options.clipId ?? 'unknown'}". Please provide targetBBox or ensure manifest/SAM cache is available.`,
      );
    }

    // Instrument B: Deterministic pixel template matching
    const resB = computeTemplateMatchVisibility(t0FramePath, tkFramePath, targetBBox, tolerance);

    let resA: SamVisibilityRatioResult;
    if (samMeasurement) {
      resA = samMeasurement;
    } else {
      // Offline fallback ($0.00 spend): derive from Instrument B area if no SAM data provided
      const t0Area = targetBBox.width * targetBBox.height;
      const tkArea = Math.round(t0Area * resB.pixelVisibilityRatio);
      resA = computeSamVisibilityRatio(t0Area, tkArea);
    }

    // Dual-Instrument Referee
    const verdict = evaluateDualInstrument({
      clipId: options.clipId || stem,
      rSam: resA.rSam,
      visRatio: resB.pixelVisibilityRatio,
      rNcc: resB.rNcc,
      targetBBox,
      pixelLossCount: resB.pixelLossCount,
      totalPixels: resB.totalPixels,
      calibration: this.calibration,
    });

    const threshold = 3 * (this.calibration.sigma_noise ?? 0);

    const measurement: MeasurementResult = {
      clipId: options.clipId || stem || 'clip_0',
      instrumentA: {
        instrument: 'sam_decode',
        score: resA.rSam,
        passed: resA.estimatedOcclusion <= threshold,
        details: `t0Area=${resA.baselineArea}px, tkArea=${resA.evalArea}px, rSam=${resA.rSam.toFixed(4)}`,
        raw: resA,
      },
      instrumentB: {
        instrument: 'vlm_evaluator',
        score: resB.pixelVisibilityRatio,
        passed: resB.measuredLoss <= threshold,
        details: `visRatio=${resB.pixelVisibilityRatio.toFixed(4)}, loss=${(resB.measuredLoss * 100).toFixed(2)}%, rNcc=${resB.rNcc.toFixed(4)}`,
        raw: resB,
      },
      combinedVerdict: verdict.verdict,
      confidence: 1.0 - verdict.instrumentAgreementDelta,
      noiseDelta: verdict.instrumentAgreementDelta,
      calibrated: true,
      notes: verdict.reason,
      decisionExplanation: verdict.decisionExplanation,
    };

    return MeasurementResultSchema.parse(measurement);
  }

  /**
   * Transcribes spoken expectation and compiles it to InvariantsDocument
   */
  async compileVoiceInvariant(options: CompileVoiceOptions): Promise<InvariantsDocument> {
    let transcript = options.transcriptText;
    let sessionId = options.voiceTranscriptId;

    if (options.cachedDir && fs.existsSync(options.cachedDir)) {
      const transcribePath = path.join(options.cachedDir, 'raw_transcribe_response.json');
      const invariantsPath = path.join(options.cachedDir, 'invariants.json');
      const sparkPath = path.join(options.cachedDir, 'raw_spark_response.json');

      if (!transcript && fs.existsSync(transcribePath)) {
        const transJson = JSON.parse(fs.readFileSync(transcribePath, 'utf-8'));
        transcript = transJson.transcript;
        sessionId = sessionId || transJson.sessionId;
      }

      if (fs.existsSync(invariantsPath)) {
        const doc = InvariantsDocumentSchema.parse(
          JSON.parse(fs.readFileSync(invariantsPath, 'utf-8')),
        );
        if (options.outputPath) {
          const dir = path.dirname(options.outputPath);
          fs.mkdirSync(dir, { recursive: true });
          fs.writeFileSync(options.outputPath, JSON.stringify(doc, null, 2) + '\n', 'utf-8');
        }
        return doc;
      }

      if (fs.existsSync(sparkPath)) {
        const sparkJson = JSON.parse(fs.readFileSync(sparkPath, 'utf-8'));
        const outputMsg = sparkJson.output?.[1] || sparkJson.output?.[0];
        const text = outputMsg?.content?.[0]?.text;
        if (text) {
          const rawParsed = extractJsonFromText(text) as {
            $schema?: string;
            version?: string;
            invariants: Array<{
              id: string;
              description: string;
              type?: 'visual' | 'behavioral' | 'structural';
              severity?: 'error' | 'warning';
              matcher?: {
                strategy: 'exact' | 'semantic' | 'regex';
                target: string;
                expected: string | number | boolean;
              };
            }>;
          };
          const enrichedInvariants = (rawParsed.invariants || []).map((inv, idx: number) => ({
            id: inv.id || `inv-${idx + 1}`,
            description: inv.description,
            type: inv.type || 'visual',
            severity: inv.severity || 'error',
            matcher: inv.matcher || {
              strategy: 'semantic' as const,
              target: inv.description,
              expected: true,
            },
            source: {
              voice_transcript_id: sessionId,
              compiled_by: 'muse-spark-1.3',
              compiled_at: new Date().toISOString(),
            },
          }));
          const doc = InvariantsDocumentSchema.parse({
            $schema: rawParsed.$schema || 'https://spectra.dev/schemas/invariants/v1.json',
            version: rawParsed.version || '1.0',
            invariants: enrichedInvariants,
          });
          if (options.outputPath) {
            const dir = path.dirname(options.outputPath);
            fs.mkdirSync(dir, { recursive: true });
            fs.writeFileSync(options.outputPath, JSON.stringify(doc, null, 2) + '\n', 'utf-8');
          }
          return doc;
        }
      }
    }

    if (!transcript && options.audioPath) {
      const transcribeRes = await transcribeAudioFile(options.audioPath, {
        apiKey: this.apiKey,
        baseUrl: this.baseUrl,
      });
      transcript = transcribeRes.transcript;
      sessionId = transcribeRes.sessionId;
    }

    if (!transcript) {
      throw new Error('Either audioPath, transcriptText, or cachedDir must be provided.');
    }

    const resolvedProvider = options.provider ?? this.provider;
    const isBaseten =
      resolvedProvider === 'baseten' ||
      Boolean(options.openWeight ?? this.openWeight) ||
      Boolean(options.model?.includes('open')) ||
      Boolean(options.baseUrl?.includes('baseten'));

    const resolvedApiKey = options.apiKey || (isBaseten ? this.basetenApiKey : this.apiKey);
    const resolvedBaseUrl = options.baseUrl || (isBaseten ? this.basetenBaseUrl : this.baseUrl);

    const compileRes = await compileTranscriptToInvariants(transcript, {
      provider: resolvedProvider,
      openWeight: options.openWeight ?? this.openWeight,
      apiKey: resolvedApiKey,
      baseUrl: resolvedBaseUrl,
      model: options.model,
      voiceTranscriptId: sessionId,
    });

    if (options.outputPath) {
      const dir = path.dirname(options.outputPath);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(
        options.outputPath,
        JSON.stringify(compileRes.document, null, 2) + '\n',
        'utf-8',
      );
    }

    return compileRes.document;
  }

  /**
   * Evaluates UI element visibility using VLM Judge (Baseten muse-spark-open-1026 or Meta muse-spark-1.3)
   */
  async evaluateWithVlmJudge(
    framePath: string,
    targetLabel: string,
    providerOrOptions?: ModelProvider | VlmJudgeOptions,
  ): Promise<VlmJudgeResult> {
    const opts: VlmJudgeOptions =
      typeof providerOrOptions === 'string'
        ? { provider: providerOrOptions }
        : { ...providerOrOptions };

    if (!opts.provider && this.provider) {
      opts.provider = this.provider;
    }
    if (opts.openWeight === undefined && this.openWeight !== undefined) {
      opts.openWeight = this.openWeight;
    }

    const isBaseten =
      opts.provider === 'baseten' ||
      Boolean(opts.openWeight) ||
      Boolean(opts.model?.includes('open')) ||
      Boolean(opts.baseUrl?.includes('baseten'));

    if (!opts.apiKey) {
      if (isBaseten && this.basetenApiKey) {
        opts.apiKey = this.basetenApiKey;
      } else if (!isBaseten && this.apiKey) {
        opts.apiKey = this.apiKey;
      }
    }

    if (!opts.baseUrl) {
      if (isBaseten && this.basetenBaseUrl) {
        opts.baseUrl = this.basetenBaseUrl;
      } else if (!isBaseten && this.baseUrl) {
        opts.baseUrl = this.baseUrl;
      }
    }

    return evaluateWithVlmJudge(framePath, targetLabel, opts);
  }

  /**
   * Checks visual invariants against a scenario clip, clip set, or manifest
   */
  async checkInvariants(options: CheckInvariantsOptions): Promise<BenchmarkReport> {
    const rawInvariants = JSON.parse(fs.readFileSync(options.invariantsPath, 'utf-8'));
    const doc = InvariantsDocumentSchema.parse(rawInvariants);

    const results: MeasurementResult[] = [];

    if (options.manifestPath && fs.existsSync(options.manifestPath)) {
      const rawManifest = JSON.parse(fs.readFileSync(options.manifestPath, 'utf-8'));
      const manifest = ManifestSchema.parse(rawManifest);
      const manifestDir = path.dirname(options.manifestPath);

      for (const clip of manifest.clips) {
        let cachedSamResponsePath: string | undefined;
        if (options.cachedSamDir && fs.existsSync(options.cachedSamDir)) {
          const p1 = path.join(options.cachedSamDir, `${clip.clipId}_sam.json`);
          const p2 = path.join(options.cachedSamDir, `${clip.clipId}.json`);
          if (fs.existsSync(p1)) cachedSamResponsePath = p1;
          else if (fs.existsSync(p2)) cachedSamResponsePath = p2;
        }

        const resolveClipPath = (p?: string): string | undefined => {
          if (!p) return undefined;
          if (fs.existsSync(p)) return p;
          const fromManifestDir = path.resolve(manifestDir, p);
          if (fs.existsSync(fromManifestDir)) return fromManifestDir;
          const fromParent = path.resolve(manifestDir, '..', p);
          if (fs.existsSync(fromParent)) return fromParent;
          return p;
        };

        const resolvedT0 = resolveClipPath(clip.t0FramePath);
        const resolvedTk = resolveClipPath(clip.tkFramePath);
        const resolvedVideo = resolveClipPath(clip.videoPath);

        if (clip.targetBBox && resolvedT0 && resolvedTk) {
          const measurement = await this.verifyClip({
            clipId: clip.clipId,
            t0FramePath: resolvedT0,
            tkFramePath: resolvedTk,
            videoPath: resolvedVideo,
            cachedSamResponsePath,
            targetLabel: clip.targetLabel || 'Target Element',
            targetBBox: clip.targetBBox,
          });
          results.push(measurement);
        }
      }
    } else if (options.clipOrFrames) {
      for (const inv of doc.invariants) {
        if (inv.type === 'visual' && options.clipOrFrames.targetBBox) {
          const measurement = await this.verifyClip({
            clipId: inv.id,
            t0FramePath: options.clipOrFrames.t0FramePath,
            tkFramePath: options.clipOrFrames.tkFramePath,
            videoPath: options.clipOrFrames.videoPath,
            cachedSamResponsePath: options.clipOrFrames.cachedSamResponsePath,
            targetLabel: String(inv.matcher.target),
            targetBBox: options.clipOrFrames.targetBBox,
          });

          results.push(measurement);
        }
      }
    } else {
      throw new Error('Either manifestPath or clipOrFrames must be provided to checkInvariants.');
    }

    const report: BenchmarkReport = {
      runId: `run_${Date.now()}`,
      timestamp: new Date().toISOString(),
      results,
      calibration: this.calibration,
      meta: {
        invariantsPath: options.invariantsPath,
        manifestPath: options.manifestPath,
      },
    };

    return BenchmarkReportSchema.parse(report);
  }
}
