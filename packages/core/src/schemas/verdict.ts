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

export const MeasurementResultSchema = z.object({
  clipId: z.string().min(1),
  instrumentA: InstrumentMeasurementSchema,
  instrumentB: InstrumentMeasurementSchema,
  combinedVerdict: VerdictSchema,
  confidence: z.number().nullable(),
  noiseDelta: z.number().nullable(),
  calibrated: z.boolean(),
  notes: z.string().optional(),
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
