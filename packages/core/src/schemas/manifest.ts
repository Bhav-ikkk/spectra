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

export const ManifestClipEntrySchema = z.object({
  clipId: z.string().min(1),
  scenario: z.string().min(1),
  variant: ClipVariantSchema,
  expectedVerdicts: ExpectedVerdictsSchema,
  sourceParams: z.record(z.unknown()),
});
export type ManifestClipEntry = z.infer<typeof ManifestClipEntrySchema>;

export const BenchmarkManifestSchema = z.object({
  version: z.literal('1.0'),
  generatedAt: z.string().datetime(),
  clips: z.array(ManifestClipEntrySchema),
});
export type BenchmarkManifest = z.infer<typeof BenchmarkManifestSchema>;
