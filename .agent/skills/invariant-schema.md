# Invariant Schema

## JSON Contract for `.spectra/invariants.json`

The invariants file is the source of truth for what Spectra checks when
evaluating an AI coding agent's output. It is produced by the invariant
compiler (`@spectra/invariant-compiler`) from Muse Voice transcriptions.

### Schema

```json
{
  "$schema": "https://spectra.dev/schemas/invariants/v1.json",
  "version": "1.0",
  "invariants": [
    {
      "id": "string (unique, kebab-case)",
      "description": "string (natural language, from Muse Voice transcription)",
      "type": "visual | behavioral | structural",
      "severity": "error | warning",
      "matcher": {
        "strategy": "exact | semantic | regex",
        "target": "string (what to match against — e.g., CSS selector, text, region)",
        "expected": "string | number | boolean"
      },
      "source": {
        "voice_transcript_id": "string (optional, ID of the Muse Voice transcription)",
        "compiled_by": "muse-spark-1.3",
        "compiled_at": "ISO 8601 timestamp"
      }
    }
  ]
}
```

### Field Details

| Field                        | Type   | Required | Description                                                                |
| ---------------------------- | ------ | -------- | -------------------------------------------------------------------------- |
| `id`                         | string | Yes      | Unique kebab-case identifier (e.g., `header-font-size`)                    |
| `description`                | string | Yes      | Natural language description from voice transcription                      |
| `type`                       | enum   | Yes      | `visual` (appearance), `behavioral` (interaction), `structural` (DOM/code) |
| `severity`                   | enum   | Yes      | `error` (must fix) or `warning` (should fix)                               |
| `matcher.strategy`           | enum   | Yes      | How to evaluate: `exact`, `semantic`, or `regex`                           |
| `matcher.target`             | string | Yes      | What to evaluate against (CSS selector, text pattern, region)              |
| `matcher.expected`           | mixed  | Yes      | The expected value or pattern                                              |
| `source.voice_transcript_id` | string | No       | ID of the originating Muse Voice transcription                             |
| `source.compiled_by`         | string | Yes      | Always `"muse-spark-1.3"`                                                  |
| `source.compiled_at`         | string | Yes      | ISO 8601 timestamp of compilation                                          |

## Zod Schema Location

`packages/core/src/schemas/invariant.ts`

This Zod schema is the **single source of truth**. The JSON Schema above is
documentation — the Zod schema is what code validates against.

## Round-Trip Validation Test

File: `packages/core/src/__tests__/invariant-roundtrip.test.ts`

This test MUST:

1. Create a valid invariants object programmatically
2. Serialize to JSON (`JSON.stringify`)
3. Deserialize and validate through the Zod schema (`JSON.parse` → `schema.parse`)
4. Assert deep equality with the original object
5. Test edge cases:
   - Empty invariants array (`"invariants": []`)
   - Maximum-length descriptions (1000+ characters)
   - All type/severity combinations (`visual/error`, `visual/warning`, etc.)
   - All matcher strategies (`exact`, `semantic`, `regex`)
   - Missing optional fields (`voice_transcript_id` omitted)
   - Invalid data (should throw `ZodError`)

This test must pass as part of `pnpm -r test` from Day 1 onward.

## Example

```json
{
  "$schema": "https://spectra.dev/schemas/invariants/v1.json",
  "version": "1.0",
  "invariants": [
    {
      "id": "sidebar-background-color",
      "description": "The sidebar should have a dark blue background, not black",
      "type": "visual",
      "severity": "error",
      "matcher": {
        "strategy": "semantic",
        "target": ".sidebar",
        "expected": "dark blue background color"
      },
      "source": {
        "voice_transcript_id": "vt-20261028-001",
        "compiled_by": "muse-spark-1.3",
        "compiled_at": "2026-10-28T14:30:00Z"
      }
    }
  ]
}
```
