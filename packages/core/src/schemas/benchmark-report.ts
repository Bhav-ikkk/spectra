import { z } from 'zod';

export const EvaluatorTypeSchema = z.enum([
  'dom_hit_test',
  'vlm_open_weight',
  'vlm_flagship',
  'spectra_referee',
]);
export type EvaluatorType = z.infer<typeof EvaluatorTypeSchema>;

export const EvaluatorResultSchema = z.object({
  evaluator: EvaluatorTypeSchema,
  verdict: z.enum(['pass', 'fail', 'inconclusive']),
  detected: z.boolean(),
  falsePass: z.boolean(),
  confidence: z.number().nullable().optional(),
  score: z.number().nullable().optional(),
  latencyMs: z.number(),
  details: z.string().optional(),
  raw: z.record(z.unknown()).optional(),
});
export type EvaluatorResult = z.infer<typeof EvaluatorResultSchema>;

export const SpectraRefereeClipResultSchema = EvaluatorResultSchema.extend({
  rSam: z.number(),
  visRatio: z.number(),
  rNcc: z.number(),
  pixelLossCount: z.number(),
  estimatedOcclusion: z.number(),
  absoluteError: z.number(),
  agreementDelta: z.number(),
  notes: z.string().optional(),
});
export type SpectraRefereeClipResult = z.infer<typeof SpectraRefereeClipResultSchema>;

export const ClipBenchmarkResultSchema = z.object({
  clipId: z.string(),
  environment: z.enum(['canvas', 'mobile_mp4', 'dom_catch']),
  scenario: z.string(),
  occlusionLevel: z.number(),
  groundTruthOcclusion: z.number(),
  targetLabel: z.string(),
  evaluators: z.object({
    dom_hit_test: EvaluatorResultSchema,
    vlm_open_weight: EvaluatorResultSchema,
    vlm_flagship: EvaluatorResultSchema,
    spectra_referee: SpectraRefereeClipResultSchema,
  }),
});
export type ClipBenchmarkResult = z.infer<typeof ClipBenchmarkResultSchema>;

export const Full45ClipResultSchema = z.object({
  clipId: z.string(),
  environment: z.enum(['canvas', 'mobile_mp4', 'dom_catch']),
  groundTruthOcclusion: z.number(),
  domHitTest: z.object({
    verdict: z.enum(['pass', 'fail']),
    falsePass: z.boolean(),
    hasDom: z.boolean(),
    centerPixelCovered: z.boolean(),
  }),
  instrumentB: z.object({
    visRatio: z.number(),
    measuredLoss: z.number(),
    pixelLossCount: z.number(),
    totalPixels: z.number(),
    absoluteError: z.number(),
    verdict: z.enum(['pass', 'fail']),
    falsePass: z.boolean(),
  }),
});
export type Full45ClipResult = z.infer<typeof Full45ClipResultSchema>;

export const OcclusionLevelEvaluatorStatsSchema = z.object({
  passed: z.number(),
  failed: z.number(),
  inconclusive: z.number(),
  detectionRate: z.number(),
  falsePassRate: z.number(),
  falseAlarmRate: z.number(),
});
export type OcclusionLevelEvaluatorStats = z.infer<typeof OcclusionLevelEvaluatorStatsSchema>;

export const OcclusionLevelEvaluatorsRecordSchema = z.object({
  dom_hit_test: OcclusionLevelEvaluatorStatsSchema,
  vlm_open_weight: OcclusionLevelEvaluatorStatsSchema,
  vlm_flagship: OcclusionLevelEvaluatorStatsSchema,
  spectra_referee: OcclusionLevelEvaluatorStatsSchema,
});
export type OcclusionLevelEvaluatorsRecord = z.infer<typeof OcclusionLevelEvaluatorsRecordSchema>;

export const OcclusionLevelStatsSchema = z.object({
  occlusionLevel: z.number(),
  totalClips: z.number(),
  evaluators: OcclusionLevelEvaluatorsRecordSchema,
});
export type OcclusionLevelStats = z.infer<typeof OcclusionLevelStatsSchema>;

export const EvaluatorSummaryStatsSchema = z.object({
  evaluator: EvaluatorTypeSchema,
  totalEvaluated: z.number(),
  cleanClipsCount: z.number(),
  occludedClipsCount: z.number(),
  overallDetectionRate: z.number(),
  overallFalsePassRate: z.number(),
  falseAlarmRate: z.number(),
  inconclusiveRate: z.number(),
  averageLatencyMs: z.number(),
});
export type EvaluatorSummaryStats = z.infer<typeof EvaluatorSummaryStatsSchema>;

export const EvaluatorSummariesRecordSchema = z.object({
  dom_hit_test: EvaluatorSummaryStatsSchema,
  vlm_open_weight: EvaluatorSummaryStatsSchema,
  vlm_flagship: EvaluatorSummaryStatsSchema,
  spectra_referee: EvaluatorSummaryStatsSchema,
});
export type EvaluatorSummariesRecord = z.infer<typeof EvaluatorSummariesRecordSchema>;

export const RefereeBenchmarkReportSchema = z.object({
  version: z.string(),
  generatedAt: z.string(),
  runId: z.string(),
  calibration: z.object({
    sigma_noise: z.number(),
    delta: z.number(),
    threshold: z.number(),
  }),
  summary: z.object({
    totalClips: z.number(),
    canonicalV1Clips: z.number(),
    fullClipsAnalyzed: z.number(),
    spectraMae: z.number(),
    spectraCanvasMae: z.number(),
    spectraMobileMae: z.number(),
    spectraDomMae: z.number(),
    evaluatorSummaries: EvaluatorSummariesRecordSchema,
    occlusionCurve: z.array(OcclusionLevelStatsSchema),
  }),
  v1Results: z.array(ClipBenchmarkResultSchema),
  full45Results: z.array(Full45ClipResultSchema),
});
export type RefereeBenchmarkReport = z.infer<typeof RefereeBenchmarkReportSchema>;
