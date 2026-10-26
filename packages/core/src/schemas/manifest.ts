import { z } from 'zod';
import { VerdictSchema } from './verdict.js';

export const ClipVariantSchema = z.enum(['clean', 'edge-case', 'adversarial']);
export type ClipVariant = z.infer<typeof ClipVariantSchema>;

export const ExpectedVerdictsSchema = z.object({
  samDecode: VerdictSchema.optional(),
  vlmBlindSpot: VerdictSchema.optional(),
  noiseFloor: VerdictSchema.optional(),
  invariantViolation: VerdictSchema.optional(),
});
export type ExpectedVerdicts = z.infer<typeof ExpectedVerdictsSchema>;

export const BoundingBoxSchema = z.object({
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number(),
});
export type BoundingBox = z.infer<typeof BoundingBoxSchema>;

export const ManifestClipEntrySchema = z.object({
  clipId: z.string().min(1),
  environment: z.enum(['canvas', 'mobile_mp4', 'dom_catch']).optional(),
  scenario: z.string().min(1).optional(),
  variant: ClipVariantSchema.optional(),
  groundTruthOcclusion: z.number().min(0).max(1).optional(),
  targetLabel: z.string().optional(),
  targetBBox: BoundingBoxSchema.optional(),
  t0FramePath: z.string().optional(),
  tkFramePath: z.string().optional(),
  videoPath: z.string().optional(),
  centerPixelCovered: z.boolean().optional(),
  expectedVerdicts: ExpectedVerdictsSchema.optional(),
  sourceParams: z.record(z.unknown()).optional(),
});
export type ManifestClipEntry = z.infer<typeof ManifestClipEntrySchema>;

export const BenchmarkManifestSchema = z.object({
  version: z.literal('1.0'),
  generatedAt: z.string(),
  clips: z.array(ManifestClipEntrySchema),
});
export type BenchmarkManifest = z.infer<typeof BenchmarkManifestSchema>;
export const ManifestSchema = BenchmarkManifestSchema;
