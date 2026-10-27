import type { BoundingBox, MeasurementResult, Verdict } from '@spectra/core';

export interface VerifyClipOptions {
  clipId?: string;
  videoPath?: string;
  t0FramePath: string;
  tkFramePath: string;
  targetLabel: string;
  targetBBox: BoundingBox;
  cachedSamResponsePath?: string;
  tolerance?: number;
}

export interface CompileVoiceOptions {
  audioPath?: string;
  transcriptText?: string;
  outputPath?: string;
  voiceTranscriptId?: string;
}

export interface CheckInvariantsOptions {
  invariantsPath: string;
  clipOrFrames: {
    t0FramePath: string;
    tkFramePath: string;
    videoPath?: string;
    cachedSamResponsePath?: string;
    targetBBox?: BoundingBox;
    targetLabel?: string;
  };
}

export interface InvariantCheckItemResult {
  invariantId: string;
  description: string;
  verdict: Verdict;
  reason: string;
  measurement?: MeasurementResult;
}
