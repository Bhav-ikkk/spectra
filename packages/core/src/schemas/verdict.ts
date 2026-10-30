import { z } from 'zod';

export const VerdictSchema = z.enum(['pass', 'fail', 'inconclusive']);
export type Verdict = z.infer<typeof VerdictSchema>;

export const InstrumentMeasurementSchema = z.object({
  instrument: z.enum(['sam_decode', 'vlm_evaluator']),
  score: z.number(),
  passed: z.boolean(),
  details: z.string().optional(),
  raw: z.unknown().optional(),
});
export type InstrumentMeasurement = z.infer<typeof InstrumentMeasurementSchema>;

export const RefereeDecisionExplanationSchema = z.object({
  ruleFired: z.enum([
    'RULE_1_GROSS_DELTA_INCONCLUSIVE',
    'RULE_2_BOUNDARY_SPLIT_INCONCLUSIVE',
    'RULE_3_THREE_SIGMA_OCCLUSION_REJECT',
    'RULE_4_THREE_SIGMA_CLEAN_PASS',
  ]),
  instrumentAVote: z.enum(['pass', 'fail']),
  instrumentBVote: z.enum(['pass', 'fail']),
  instrumentALoss: z.number(),
  instrumentBLoss: z.number(),
  combinedLoss: z.number(),
  threeSigmaThreshold: z.number(),
  marginToThreshold: z.number(), // combinedLoss - threeSigmaThreshold (>0 means rejected by this margin)
  observedDelta: z.number(), // |rSam - visRatio|
  deltaLimit: z.number(), // calibration.delta (0.041)
  deltaMargin: z.number(), // deltaLimit - observedDelta (>0 means instruments agreed within bound)
  formulaSummary: z.string(),
});
export type RefereeDecisionExplanation = z.infer<typeof RefereeDecisionExplanationSchema>;

export const MeasurementResultSchema = z.object({
  clipId: z.string().min(1),
  instrumentA: InstrumentMeasurementSchema,
  instrumentB: InstrumentMeasurementSchema,
  combinedVerdict: VerdictSchema,
  confidence: z.number().nullable(),
  noiseDelta: z.number().nullable(),
  calibrated: z.boolean(),
  notes: z.string().optional(),
  decisionExplanation: RefereeDecisionExplanationSchema.optional(),
});
export type MeasurementResult = z.infer<typeof MeasurementResultSchema>;

export const CalibrationDataSchema = z.object({
  sigma_noise: z.number().nullable(),
  delta: z.number().nullable(),
  measured_at: z.string().datetime().nullable(),
  run_id: z.string().nullable(),
  sample_count: z.number().int().nonnegative(),
  citation: z.string(),
});
export type CalibrationData = z.infer<typeof CalibrationDataSchema>;

export const BenchmarkReportSchema = z.object({
  runId: z.string().min(1),
  timestamp: z.string().datetime(),
  results: z.array(MeasurementResultSchema),
  calibration: CalibrationDataSchema,
  meta: z.record(z.unknown()).default({}),
});
export type BenchmarkReport = z.infer<typeof BenchmarkReportSchema>;
