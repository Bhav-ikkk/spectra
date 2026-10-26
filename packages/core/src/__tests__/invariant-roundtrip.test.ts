import { describe, it, expect } from 'vitest';
import {
  InvariantsDocument,
  InvariantsDocumentSchema,
  InvariantType,
  InvariantSeverity,
  MatcherStrategy,
} from '../schemas/invariant.js';

describe('Invariant Schema Round-Trip', () => {
  it('creates, serializes, deserializes, and deep-equals a valid invariants object', () => {
    const original: InvariantsDocument = {
      $schema: 'https://spectra.dev/schemas/invariants/v1.json',
      version: '1.0',
      invariants: [
        {
          id: 'button-has-contrast-ratio',
          description: 'Primary button contrast ratio must exceed 4.5:1 against card background',
          type: 'visual',
          severity: 'error',
          matcher: {
            strategy: 'exact',
            target: 'button.primary-cta',
            expected: true,
          },
          source: {
            voice_transcript_id: 'vt-oct26-001',
            compiled_by: 'muse-spark-1.3',
            compiled_at: '2026-10-26T20:00:00.000Z',
          },
        },
        {
          id: 'sidebar-collapsible-animation',
          description: 'Sidebar collapse duration must not exceed 250ms',
          type: 'behavioral',
          severity: 'warning',
          matcher: {
            strategy: 'semantic',
            target: '.sidebar-drawer',
            expected: 250,
          },
          source: {
            compiled_by: 'muse-spark-1.3',
            compiled_at: '2026-10-26T20:05:00.000Z',
          },
        },
      ],
    };

    const serialized = JSON.stringify(original);
    const parsed = JSON.parse(serialized);
    const validated = InvariantsDocumentSchema.parse(parsed);

    expect(validated).toEqual(original);
  });

  it('handles empty invariants list', () => {
    const emptyDoc: InvariantsDocument = {
      $schema: 'https://spectra.dev/schemas/invariants/v1.json',
      version: '1.0',
      invariants: [],
    };

    const serialized = JSON.stringify(emptyDoc);
    const validated = InvariantsDocumentSchema.parse(JSON.parse(serialized));
    expect(validated).toEqual(emptyDoc);
  });

  it('covers all type, severity, and matcher strategy permutations', () => {
    const types: InvariantType[] = ['visual', 'behavioral', 'structural'];
    const severities: InvariantSeverity[] = ['error', 'warning'];
    const strategies: MatcherStrategy[] = ['exact', 'semantic', 'regex'];

    const items = [];
    let count = 0;
    for (const type of types) {
      for (const severity of severities) {
        for (const strategy of strategies) {
          count++;
          items.push({
            id: `test-rule-${count}`,
            description: `Testing permutation ${type}-${severity}-${strategy} with long descriptive text to test payload size`,
            type,
            severity,
            matcher: {
              strategy,
              target: `#target-${count}`,
              expected: count % 2 === 0 ? 'enabled' : count,
            },
            source: {
              compiled_by: 'muse-spark-1.3',
              compiled_at: '2026-10-26T20:10:00.000Z',
            },
          });
        }
      }
    }

    const doc: InvariantsDocument = {
      $schema: 'https://spectra.dev/schemas/invariants/v1.json',
      version: '1.0',
      invariants: items,
    };

    const serialized = JSON.stringify(doc);
    const validated = InvariantsDocumentSchema.parse(JSON.parse(serialized));
    expect(validated.invariants).toHaveLength(types.length * severities.length * strategies.length);
    expect(validated).toEqual(doc);
  });

  it('rejects duplicate invariant IDs', () => {
    const invalidDoc = {
      $schema: 'https://spectra.dev/schemas/invariants/v1.json',
      version: '1.0',
      invariants: [
        {
          id: 'duplicate-id',
          description: 'First invariant',
          type: 'visual',
          severity: 'error',
          matcher: { strategy: 'exact', target: '.cta', expected: true },
          source: { compiled_by: 'muse-spark-1.3', compiled_at: '2026-10-26T20:00:00.000Z' },
        },
        {
          id: 'duplicate-id',
          description: 'Second invariant with same ID',
          type: 'structural',
          severity: 'warning',
          matcher: { strategy: 'exact', target: '.nav', expected: false },
          source: { compiled_by: 'muse-spark-1.3', compiled_at: '2026-10-26T20:00:00.000Z' },
        },
      ],
    };

    expect(() => InvariantsDocumentSchema.parse(invalidDoc)).toThrowError(
      /All invariant IDs within a document must be unique/,
    );
  });

  it('rejects non-kebab-case IDs', () => {
    const invalidIdDoc = {
      version: '1.0',
      invariants: [
        {
          id: 'Not_Kebab_Case_123',
          description: 'Invalid casing',
          type: 'visual',
          severity: 'error',
          matcher: { strategy: 'exact', target: '.cta', expected: true },
          source: { compiled_by: 'muse-spark-1.3', compiled_at: '2026-10-26T20:00:00.000Z' },
        },
      ],
    };

    expect(() => InvariantsDocumentSchema.parse(invalidIdDoc)).toThrowError(/kebab-case/);
  });
});
