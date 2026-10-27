import fs from 'node:fs';
import path from 'node:path';
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
  parseVideoStream,
  recordsOfKind,
  frameIndexOf,
  decodeMaskToRaster,
  buildObjectPrompt,
  type ResponsesEvent,
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
    const outputArr = rawJson.output as Array<{ content?: Array<{ text?: string }> }> | undefined;
    let outputText = '';
    if (Array.isArray(outputArr)) {
      for (const item of outputArr) {
        if (Array.isArray(item.content)) {
          for (const c of item.content) {
            if (c.text) outputText += c.text;
          }
        }
      }
    }

    if (!outputText) {
      throw new Error('No output_text in SAM response');
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
    const t0Area = frameAreas[0]?.area ?? 0;
    const tkArea = frameAreas[frameAreas.length - 1]?.area ?? 0;

    return { t0Area, tkArea };
  }

  /**
   * Runs Dual-Instrument Verification on a clip/frames
   */
  async verifyClip(options: VerifyClipOptions): Promise<MeasurementResult> {
    const {
      t0FramePath,
      tkFramePath,
      targetBBox,
      cachedSamResponsePath,
      videoPath,
      tolerance = 5.0,
    } = options;

    if (!fs.existsSync(t0FramePath)) {
      throw new Error(`t0 frame not found: ${t0FramePath}`);
    }
    if (!fs.existsSync(tkFramePath)) {
      throw new Error(`tk frame not found: ${tkFramePath}`);
    }

    // Instrument B: Deterministic pixel template matching
    const resB = computeTemplateMatchVisibility(t0FramePath, tkFramePath, targetBBox, tolerance);

    // Instrument A: SAM Visibility Ratio
    let t0Area = 0;
    let tkArea = 0;

    if (cachedSamResponsePath && fs.existsSync(cachedSamResponsePath)) {
      const rawJson = JSON.parse(fs.readFileSync(cachedSamResponsePath, 'utf-8'));
      const decoded = await this.decodeSamAreas(rawJson);
      t0Area = decoded.t0Area;
      tkArea = decoded.tkArea;
    } else if (videoPath && fs.existsSync(videoPath) && this.apiKey) {
      const videoBuffer = fs.readFileSync(videoPath);
      const videoBase64 = `data:video/mp4;base64,${videoBuffer.toString('base64')}`;

      const promptText = buildObjectPrompt({
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
      const decoded = await this.decodeSamAreas(rawJson);
      t0Area = decoded.t0Area;
      tkArea = decoded.tkArea;
    } else {
      // Offline fallback ($0.00 spend): derive from Instrument B area if no SAM data provided
      t0Area = targetBBox.width * targetBBox.height;
      tkArea = Math.round(t0Area * resB.pixelVisibilityRatio);
    }

    const resA = computeSamVisibilityRatio(t0Area, tkArea);

    // Dual-Instrument Referee
    const verdict = evaluateDualInstrument({
      clipId: options.clipId,
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
      clipId: options.clipId || 'clip_0',
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
