import { InvariantsDocumentSchema, type InvariantsDocument } from '@spectra/core';

export interface CompileOptions {
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  voiceTranscriptId?: string;
  nowIso?: string;
}

export interface CompileResult {
  document: InvariantsDocument;
  rawResponse: Record<string, unknown>;
  rawOutputText: string;
}

function toKebabCase(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function extractJsonFromText(text: string): unknown {
  const trimmed = text.trim();
  // Strip markdown code fences if present
  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  const jsonStr = fenceMatch ? fenceMatch[1].trim() : trimmed;

  try {
    return JSON.parse(jsonStr);
  } catch {
    // Try finding first { and matching }
    const firstBrace = jsonStr.indexOf('{');
    const lastBrace = jsonStr.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      return JSON.parse(jsonStr.substring(firstBrace, lastBrace + 1));
    }
    throw new Error(`Failed to parse JSON from model output:\n${text}`);
  }
}

export async function compileTranscriptToInvariants(
  transcript: string,
  options: CompileOptions = {},
): Promise<CompileResult> {
  const apiKey =
    options.apiKey || (typeof process !== 'undefined' ? process.env?.META_API_KEY : undefined);
  if (!apiKey) {
    throw new Error('META_API_KEY is required to compile invariants.');
  }

  const baseUrl = options.baseUrl || 'https://api.meta.ai/v1';
  const model = options.model || 'muse-spark-1.3';
  const compiledAt = options.nowIso || new Date().toISOString();

  const systemInstruction = `You are the Spectra Visual Invariant Compiler.
Translate the following user expectation transcript into formal visual and behavioral invariants.

Rules:
1. Output strict JSON conforming to this schema:
{
  "$schema": "https://spectra.dev/schemas/invariants/v1.json",
  "version": "1.0",
  "invariants": [
    {
      "id": "kebab-case-identifier",
      "description": "Clear human-readable statement of what must remain visible or intact",
      "type": "visual",
      "severity": "error",
      "matcher": {
        "strategy": "semantic",
        "target": "Element name or label (e.g. Complete Checkout Button)",
        "expected": true
      }
    }
  ]
}
2. The "id" field MUST be non-empty kebab-case (lowercase alphanumeric with hyphens, e.g. "complete-checkout-button-visible").
3. Each invariant represents one atomic UI invariant.
4. Output ONLY the JSON block. Do not prepend conversational text or explanations.`;

  const userPrompt = `Transcript to compile:\n"${transcript}"`;

  const endpoint = `${baseUrl}/responses`;
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      input: [
        {
          role: 'user',
          content: [
            {
              type: 'input_text',
              text: `${systemInstruction}\n\n${userPrompt}`,
            },
          ],
        },
      ],
    }),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Meta Responses API error (${res.status}): ${errorText}`);
  }

  const rawJson = (await res.json()) as Record<string, unknown>;
  let outputText = '';
  const outputArr = rawJson.output as Array<{ content?: Array<{ text?: string }> }> | undefined;
  if (Array.isArray(outputArr)) {
    for (const item of outputArr) {
      if (Array.isArray(item.content)) {
        for (const c of item.content) {
          if (c.text) {
            outputText += (outputText ? '\n' : '') + c.text;
          }
        }
      }
    }
  }

  const parsedRaw = extractJsonFromText(outputText) as {
    $schema?: string;
    version?: string;
    invariants: Array<{
      id: string;
      description: string;
      type?: 'visual' | 'behavioral' | 'structural';
      severity?: 'error' | 'warning';
      matcher?: {
        strategy: 'exact' | 'semantic' | 'regex';
        target: string;
        expected: string | number | boolean;
      };
      source?: { voice_transcript_id?: string; compiled_by: string; compiled_at: string };
    }>;
  };

  // Ensure invariants have correct metadata and kebab-case ids
  const enrichedInvariants = (parsedRaw.invariants || []).map((inv, idx) => ({
    id: toKebabCase(inv.id || `inv-${idx + 1}`),
    description: inv.description,
    type: inv.type || 'visual',
    severity: inv.severity || 'error',
    matcher: inv.matcher || {
      strategy: 'semantic' as const,
      target: inv.description,
      expected: true,
    },
    source: {
      voice_transcript_id: options.voiceTranscriptId,
      compiled_by: model,
      compiled_at: compiledAt,
    },
  }));

  const candidateDoc = {
    $schema: parsedRaw.$schema || 'https://spectra.dev/schemas/invariants/v1.json',
    version: parsedRaw.version || '1.0',
    invariants: enrichedInvariants,
  };

  const validatedDoc = InvariantsDocumentSchema.parse(candidateDoc);

  return {
    document: validatedDoc,
    rawResponse: rawJson,
    rawOutputText: outputText,
  };
}
