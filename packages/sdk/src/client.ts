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
import { transcribeAudioFile, compileTranscriptToInvariants } from '@spectra/invariant-compiler';
import type { VerifyClipOptions, CompileVoiceOptions, CheckInvariantsOptions } from './types.js';

export interface SpectraClientConfig {
  apiKey?: string;
  baseUrl?: string;
  calibration?: CalibrationData;
}

export class SpectraClient {
  private readonly apiKey?: string;
  private readonly baseUrl: string;
  private readonly calibration: CalibrationData;

  constructor(config: SpectraClientConfig = {}) {
    this.apiKey =
      config.apiKey || (typeof process !== 'undefined' ? process.env?.META_API_KEY : undefined);
    this.baseUrl = config.baseUrl || 'https://api.meta.ai/v1';
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
    } else if (videoPath && fs.existsSync(videoPath)) {
      if (!this.apiKey) {
        throw new Error('META_API_KEY required for live SAM 3.1 verification.');
      }
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
      // Offline fallback: derive from Instrument B area if no SAM data provided
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

    if (!transcript && options.audioPath) {
      const transcribeRes = await transcribeAudioFile(options.audioPath, {
        apiKey: this.apiKey,
        baseUrl: this.baseUrl,
      });
      transcript = transcribeRes.transcript;
      sessionId = transcribeRes.sessionId;
    }

    if (!transcript) {
      throw new Error('Either audioPath or transcriptText must be provided.');
    }

    const compileRes = await compileTranscriptToInvariants(transcript, {
      apiKey: this.apiKey,
      baseUrl: this.baseUrl,
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
   * Checks visual invariants against a scenario clip or frames
   */
  async checkInvariants(options: CheckInvariantsOptions): Promise<BenchmarkReport> {
    const rawInvariants = JSON.parse(fs.readFileSync(options.invariantsPath, 'utf-8'));
    const doc = InvariantsDocumentSchema.parse(rawInvariants);

    const results: MeasurementResult[] = [];

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

    const report: BenchmarkReport = {
      runId: `run_${Date.now()}`,
      timestamp: new Date().toISOString(),
      results,
      calibration: this.calibration,
      meta: {
        invariantsPath: options.invariantsPath,
      },
    };

    return BenchmarkReportSchema.parse(report);
  }
}
