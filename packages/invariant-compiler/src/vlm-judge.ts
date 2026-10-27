import fs from 'node:fs';
import path from 'node:path';
import { extractJsonFromText, type ModelProvider } from './compile.js';

export interface VlmJudgeOptions {
  provider?: ModelProvider;
  openWeight?: boolean;
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  cachedResponsePath?: string;
  temperature?: number;
}

export interface VlmJudgeResult {
  target: string;
  clipped: boolean;
  confidence: number;
  reasoning: string;
  rawResponse: Record<string, unknown>;
  rawOutputText: string;
  provider: ModelProvider;
  model: string;
}

function parseVlmJudgeOutput(
  outputText: string,
  targetLabel: string,
  rawJson: Record<string, unknown>,
  provider: ModelProvider,
  model: string,
): VlmJudgeResult {
  let parsed: {
    target?: string;
    clipped?: boolean;
    confidence?: number;
    reasoning?: string;
  } = {};

  try {
    parsed = extractJsonFromText(outputText) as {
      target?: string;
      clipped?: boolean;
      confidence?: number;
      reasoning?: string;
    };
  } catch {
    const lower = outputText.toLowerCase();
    const isClipped =
      lower.includes('"clipped": true') ||
      lower.includes('is clipped') ||
      lower.includes('partially clipped') ||
      lower.includes('occluded') ||
      lower.includes('covered');
    parsed = {
      target: targetLabel,
      clipped: isClipped,
      confidence: 0.7,
      reasoning: outputText.trim() || 'Parsed from raw VLM output text',
    };
  }

  const clipped = Boolean(parsed.clipped);
  const confidence = typeof parsed.confidence === 'number' ? parsed.confidence : 0.8;
  const reasoning =
    parsed.reasoning ||
    (clipped
      ? `${targetLabel} appears clipped or occluded.`
      : `${targetLabel} appears fully visible and unobstructed.`);

  return {
    target: parsed.target || targetLabel,
    clipped,
    confidence,
    reasoning,
    rawResponse: rawJson,
    rawOutputText: outputText,
    provider,
    model,
  };
}

function getEnvVar(key: string): string | undefined {
  if (typeof process !== 'undefined' && process.env?.[key]) {
    return process.env[key];
  }
  let dir = process.cwd();
  while (!fs.existsSync(path.join(dir, 'pnpm-workspace.yaml'))) {
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  const envPath = path.join(dir, '.env');
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf-8');
    const match = content.match(new RegExp(`${key}=([^\\r\\n]+)`));
    if (match?.[1]?.trim()) {
      return match[1].trim();
    }
  }
  return undefined;
}

export async function evaluateWithVlmJudge(
  framePath: string,
  targetLabel: string,
  providerOrOptions?: ModelProvider | VlmJudgeOptions,
): Promise<VlmJudgeResult> {
  const options: VlmJudgeOptions =
    typeof providerOrOptions === 'string'
      ? { provider: providerOrOptions }
      : providerOrOptions || {};

  // Resolve provider
  let provider: ModelProvider;
  if (options.provider) {
    provider = options.provider;
  } else if (
    options.openWeight ||
    options.model?.includes('open') ||
    options.baseUrl?.includes('baseten')
  ) {
    provider = 'baseten';
  } else if (getEnvVar('BASETEN_API_KEY') && !getEnvVar('META_API_KEY')) {
    provider = 'baseten';
  } else {
    provider = 'meta';
  }

  // Check cached response first (for $0.00 spend offline execution)
  if (options.cachedResponsePath && fs.existsSync(options.cachedResponsePath)) {
    const rawJson = JSON.parse(fs.readFileSync(options.cachedResponsePath, 'utf-8')) as Record<
      string,
      unknown
    >;
    let outputText = '';
    const choices = rawJson.choices as Array<{ message?: { content?: string } }> | undefined;
    if (Array.isArray(choices) && choices.length > 0 && choices[0].message?.content) {
      outputText = choices[0].message.content;
    } else {
      const outputArr = rawJson.output as Array<{ content?: Array<{ text?: string }> }> | undefined;
      if (Array.isArray(outputArr)) {
        for (const item of outputArr) {
          if (Array.isArray(item.content)) {
            for (const c of item.content) {
              if (c.text) outputText += (outputText ? '\n' : '') + c.text;
            }
          }
        }
      }
    }

    const model =
      typeof rawJson.model === 'string'
        ? rawJson.model
        : provider === 'baseten'
          ? 'meta-models/muse-spark-open-1026'
          : 'muse-spark-1.3';

    return parseVlmJudgeOutput(outputText, targetLabel, rawJson, provider, model);
  }

  if (!fs.existsSync(framePath)) {
    throw new Error(`Frame file not found for VLM evaluation: ${framePath}`);
  }

  const fileBuffer = fs.readFileSync(framePath);
  const ext = path.extname(framePath).toLowerCase().replace('.', '') || 'png';
  const mimeType = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : 'image/png';
  const base64DataUri = `data:${mimeType};base64,${fileBuffer.toString('base64')}`;

  const vlmJudgeSystemPrompt = `You are an expert visual UI evaluator judging UI element visibility and integrity.
Inspect the attached screenshot carefully for the target UI element: "${targetLabel}".

Determine whether "${targetLabel}" is clipped, cut off, obscured, partially occluded by any drawer/overlay/edge, or fully visible.
Even subtle edge clippings (e.g., 5-15% obscured by an overlay, drawer, or modal boundary) count as clipped/occluded.

Respond ONLY with valid JSON in the following format:
{
  "target": "${targetLabel}",
  "clipped": true,
  "confidence": 0.95,
  "reasoning": "Brief explanation of whether the element is occluded or visible"
}
Rules:
- clipped: boolean. Set to true if ANY part of the element is occluded, obscured, clipped, or cut off. Set to false ONLY if the element is completely unobstructed, intact, and fully visible.
- confidence: number between 0.0 and 1.0 representing your confidence.
- Output ONLY the JSON block. Do not add conversational text or markdown code fences outside JSON.`;

  const vlmJudgeUserPrompt = `Is the UI element "${targetLabel}" clipped, occluded, or fully visible in this screenshot? Respond ONLY with JSON.`;

  if (provider === 'baseten') {
    const apiKey = options.apiKey !== undefined ? options.apiKey : getEnvVar('BASETEN_API_KEY');
    if (!apiKey) {
      throw new Error('BASETEN_API_KEY is required for Baseten VLM evaluation.');
    }
    const baseUrl =
      options.baseUrl || getEnvVar('BASETEN_BASE_URL') || 'https://inference.baseten.co/v1';
    const model = options.model || 'meta-models/muse-spark-open-1026';

    const endpoint = `${baseUrl.replace(/\/+$/, '')}/chat/completions`;
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: 'system',
            content: vlmJudgeSystemPrompt,
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: vlmJudgeUserPrompt,
              },
              {
                type: 'image_url',
                image_url: {
                  url: base64DataUri,
                },
              },
            ],
          },
        ],
        temperature: options.temperature ?? 0.1,
        max_tokens: 2048,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Baseten VLM Judge API error (${res.status}): ${errText}`);
    }

    const rawJson = (await res.json()) as Record<string, unknown>;
    let outputText = '';
    const choices = rawJson.choices as
      | Array<{ message?: { content?: string; reasoning_content?: string } }>
      | undefined;
    if (Array.isArray(choices) && choices.length > 0) {
      outputText = choices[0].message?.content || choices[0].message?.reasoning_content || '';
    }

    return parseVlmJudgeOutput(outputText, targetLabel, rawJson, provider, model);
  } else {
    const apiKey = options.apiKey !== undefined ? options.apiKey : getEnvVar('META_API_KEY');
    if (!apiKey) {
      throw new Error('META_API_KEY is required for Meta VLM evaluation.');
    }
    const baseUrl = options.baseUrl || getEnvVar('META_API_BASE_URL') || 'https://api.meta.ai/v1';
    const model = options.model || 'muse-spark-1.3';

    const endpoint = `${baseUrl.replace(/\/+$/, '')}/responses`;
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
                type: 'input_image',
                image_url: base64DataUri,
              },
              {
                type: 'input_text',
                text: `${vlmJudgeSystemPrompt}\n\n${vlmJudgeUserPrompt}`,
              },
            ],
          },
        ],
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Meta VLM Judge API error (${res.status}): ${errText}`);
    }

    const rawJson = (await res.json()) as Record<string, unknown>;
    let outputText = '';
    const outputArr = rawJson.output as Array<{ content?: Array<{ text?: string }> }> | undefined;
    if (Array.isArray(outputArr)) {
      for (const item of outputArr) {
        if (Array.isArray(item.content)) {
          for (const c of item.content) {
            if (c.text) outputText += (outputText ? '\n' : '') + c.text;
          }
        }
      }
    }

    return parseVlmJudgeOutput(outputText, targetLabel, rawJson, provider, model);
  }
}
