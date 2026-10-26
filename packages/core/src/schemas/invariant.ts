import { z } from 'zod';

export const InvariantTypeSchema = z.enum(['visual', 'behavioral', 'structural']);
export type InvariantType = z.infer<typeof InvariantTypeSchema>;

export const InvariantSeveritySchema = z.enum(['error', 'warning']);
export type InvariantSeverity = z.infer<typeof InvariantSeveritySchema>;

export const MatcherStrategySchema = z.enum(['exact', 'semantic', 'regex']);
export type MatcherStrategy = z.infer<typeof MatcherStrategySchema>;

export const InvariantMatcherSchema = z.object({
  strategy: MatcherStrategySchema,
  target: z.string().min(1),
  expected: z.union([z.string(), z.number(), z.boolean()]),
});
export type InvariantMatcher = z.infer<typeof InvariantMatcherSchema>;

export const InvariantSourceSchema = z.object({
  voice_transcript_id: z.string().optional(),
  compiled_by: z.string().min(1),
  compiled_at: z.string().datetime(),
});
export type InvariantSource = z.infer<typeof InvariantSourceSchema>;

const KEBAB_CASE_REGEX = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export const InvariantItemSchema = z.object({
  id: z.string().min(1).regex(KEBAB_CASE_REGEX, {
    message: 'Invariant ID must be non-empty and kebab-case (e.g. "submit-button-visible")',
  }),
  description: z.string().min(1),
  type: InvariantTypeSchema,
  severity: InvariantSeveritySchema,
  matcher: InvariantMatcherSchema,
  source: InvariantSourceSchema,
});
export type InvariantItem = z.infer<typeof InvariantItemSchema>;

export const InvariantsDocumentSchema = z
  .object({
    $schema: z.string().url().optional().default('https://spectra.dev/schemas/invariants/v1.json'),
    version: z.string().default('1.0'),
    invariants: z.array(InvariantItemSchema),
  })
  .refine(
    (doc) => {
      const ids = doc.invariants.map((item) => item.id);
      return new Set(ids).size === ids.length;
    },
    {
      message: 'All invariant IDs within a document must be unique',
      path: ['invariants'],
    },
  );

export type InvariantsDocument = z.infer<typeof InvariantsDocumentSchema>;
