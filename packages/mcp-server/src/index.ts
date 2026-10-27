#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';
import {
  SpectraClient,
  type MeasurementResult,
  type BenchmarkReport,
  type InvariantsDocument,
  type BoundingBox,
  getCalibration,
} from '@spectra/sdk';

export { SpectraClient, type SpectraClientConfig } from '@spectra/sdk';
export * from '@spectra/sdk';

export interface McpToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

export const TOOLS_DEFINITIONS: McpToolDefinition[] = [
  {
    name: 'spectra_verify',
    description:
      'Evaluates a UI/canvas clip or frame pair using the Spectra Dual-Instrument Referee (SAM 3.1 + Deterministic Pixel Matcher). Returns exact structured MeasurementResult with verdict, rSam, visRatio, pixelLossCount, threshold, and reason.',
    inputSchema: {
      type: 'object',
      properties: {
        clipId: {
          type: 'string',
          description: 'Unique identifier for the clip/measurement (e.g. canvas_000_v1)',
        },
        t0FramePath: {
          type: 'string',
          description: 'Path to baseline frame (t0) PNG image',
        },
        tkFramePath: {
          type: 'string',
          description: 'Path to evaluation frame (tk) PNG image',
        },
        targetLabel: {
          type: 'string',
          description: 'Semantic label of the target UI element (e.g. "Complete Checkout")',
        },
        targetBBox: {
          type: 'object',
          properties: {
            x: { type: 'number', description: 'Left coordinate in pixels' },
            y: { type: 'number', description: 'Top coordinate in pixels' },
            width: { type: 'number', description: 'Width in pixels' },
            height: { type: 'number', description: 'Height in pixels' },
          },
          required: ['x', 'y', 'width', 'height'],
          description: 'Bounding box of the target element',
        },
        videoPath: {
          type: 'string',
          description: 'Optional path to MP4 video clip for live SAM 3.1 tracking',
        },
        cachedSamResponsePath: {
          type: 'string',
          description: 'Optional path to cached SAM 3.1 JSON response for offline $0 spend',
        },
        tolerance: {
          type: 'number',
          description: 'Color delta E tolerance for pixel matching (default 5.0)',
        },
      },
      required: ['t0FramePath', 'tkFramePath', 'targetLabel', 'targetBBox'],
    },
  },
  {
    name: 'spectra_check',
    description:
      'Evaluates all visual invariants in .spectra/invariants.json against the target benchmark clips or manifest and returns structured BenchmarkReport.',
    inputSchema: {
      type: 'object',
      properties: {
        invariantsPath: {
          type: 'string',
          description: 'Path to .spectra/invariants.json',
        },
        manifestPath: {
          type: 'string',
          description: 'Optional path to benchmark manifest JSON',
        },
        cachedSamDir: {
          type: 'string',
          description: 'Optional directory with cached SAM JSON responses',
        },
        clipOrFrames: {
          type: 'object',
          properties: {
            t0FramePath: { type: 'string' },
            tkFramePath: { type: 'string' },
            videoPath: { type: 'string' },
            cachedSamResponsePath: { type: 'string' },
            targetBBox: {
              type: 'object',
              properties: {
                x: { type: 'number' },
                y: { type: 'number' },
                width: { type: 'number' },
                height: { type: 'number' },
              },
              required: ['x', 'y', 'width', 'height'],
            },
            targetLabel: { type: 'string' },
          },
          required: ['t0FramePath', 'tkFramePath'],
          description: 'Optional single clip frame pair to evaluate',
        },
      },
      required: ['invariantsPath'],
    },
  },
  {
    name: 'spectra_compile_invariant',
    description:
      'Compiles a spoken expectation audio WAV file or raw transcript text into formal .spectra/invariants.json.',
    inputSchema: {
      type: 'object',
      properties: {
        audioPath: {
          type: 'string',
          description: 'Optional path to spoken audio WAV file',
        },
        transcriptText: {
          type: 'string',
          description: 'Optional transcript text of the spoken expectation',
        },
        outputPath: {
          type: 'string',
          description: 'Optional destination path to write .spectra/invariants.json',
        },
        cachedDir: {
          type: 'string',
          description: 'Optional directory with cached voice-smoke responses for offline testing',
        },
      },
    },
  },
];

export interface JsonRpcRequest {
  jsonrpc: '2.0';
  id?: string | number | null;
  method: string;
  params?: Record<string, unknown>;
}

export interface JsonRpcResponse {
  jsonrpc: '2.0';
  id: string | number | null;
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

export class SpectraMcpServer {
  private client: SpectraClient;
  private rl?: readline.Interface;

  constructor(client: SpectraClient = new SpectraClient()) {
    this.client = client;
  }

  async executeTool(name: string, args: Record<string, unknown>): Promise<unknown> {
    if (name === 'spectra_verify') {
      const clipId = (args.clipId as string) || 'verify_0';
      const t0FramePath = path.resolve(args.t0FramePath as string);
      const tkFramePath = path.resolve(args.tkFramePath as string);
      const targetLabel = String(args.targetLabel);
      const targetBBox = args.targetBBox as BoundingBox;

      const measurement: MeasurementResult = await this.client.verifyClip({
        clipId,
        t0FramePath,
        tkFramePath,
        targetLabel,
        targetBBox,
        videoPath: args.videoPath ? path.resolve(args.videoPath as string) : undefined,
        cachedSamResponsePath: args.cachedSamResponsePath
          ? path.resolve(args.cachedSamResponsePath as string)
          : undefined,
        tolerance: typeof args.tolerance === 'number' ? args.tolerance : undefined,
      });

      const cal = getCalibration();
      const threshold = 3 * (cal.sigma_noise ?? 0);
      const pixelLossCount =
        (measurement.instrumentB.raw as { pixelLossCount?: number } | undefined)?.pixelLossCount ??
        0;

      return {
        verdict: measurement.combinedVerdict,
        rSam: measurement.instrumentA.score,
        visRatio: measurement.instrumentB.score,
        pixelLossCount,
        threshold,
        reason: measurement.notes ?? '',
        clipId: measurement.clipId,
        confidence: measurement.confidence,
        noiseDelta: measurement.noiseDelta,
        calibrated: measurement.calibrated,
        instrumentA: measurement.instrumentA,
        instrumentB: measurement.instrumentB,
        notes: measurement.notes,
      };
    }

    if (name === 'spectra_check') {
      const invariantsPath = path.resolve(args.invariantsPath as string);
      const manifestPath = args.manifestPath
        ? path.resolve(args.manifestPath as string)
        : undefined;
      const cachedSamDir = args.cachedSamDir
        ? path.resolve(args.cachedSamDir as string)
        : undefined;

      const report: BenchmarkReport = await this.client.checkInvariants({
        invariantsPath,
        manifestPath,
        cachedSamDir,
        clipOrFrames: args.clipOrFrames as
          | {
              t0FramePath: string;
              tkFramePath: string;
              videoPath?: string;
              cachedSamResponsePath?: string;
              targetBBox?: BoundingBox;
              targetLabel?: string;
            }
          | undefined,
      });

      const passed = report.results.filter((r) => r.combinedVerdict === 'pass').length;
      const failed = report.results.filter((r) => r.combinedVerdict === 'fail').length;
      const inconclusive = report.results.filter(
        (r) => r.combinedVerdict === 'inconclusive',
      ).length;
      const overallVerdict = failed > 0 ? 'fail' : inconclusive > 0 ? 'inconclusive' : 'pass';

      return {
        overallVerdict,
        passed,
        failed,
        inconclusive,
        runId: report.runId,
        timestamp: report.timestamp,
        results: report.results,
        calibration: report.calibration,
      };
    }

    if (name === 'spectra_compile_invariant') {
      const doc: InvariantsDocument = await this.client.compileVoiceInvariant({
        audioPath: args.audioPath ? path.resolve(args.audioPath as string) : undefined,
        transcriptText: args.transcriptText as string | undefined,
        outputPath: args.outputPath ? path.resolve(args.outputPath as string) : undefined,
        cachedDir: args.cachedDir ? path.resolve(args.cachedDir as string) : undefined,
      });

      return {
        success: true,
        invariantsCount: doc.invariants.length,
        invariants: doc.invariants,
        document: doc,
      };
    }

    throw new Error(`Unknown tool name: ${name}`);
  }

  async handleMessage(msg: JsonRpcRequest): Promise<JsonRpcResponse | null> {
    if (!msg.id && msg.method) {
      // JSON-RPC Notification (e.g. notifications/initialized) -> no response returned
      return null;
    }

    const { id = null, method, params = {} } = msg;

    if (method === 'initialize') {
      return {
        jsonrpc: '2.0',
        id,
        result: {
          protocolVersion: '2024-11-05',
          capabilities: {
            tools: {},
          },
          serverInfo: {
            name: 'spectra-mcp',
            version: '0.0.1',
          },
        },
      };
    }

    if (method === 'notifications/initialized') {
      return null;
    }

    if (method === 'tools/list') {
      return {
        jsonrpc: '2.0',
        id,
        result: {
          tools: TOOLS_DEFINITIONS,
        },
      };
    }

    if (method === 'tools/call') {
      const toolName = params.name as string;
      const toolArgs = (params.arguments as Record<string, unknown>) || {};

      try {
        const toolResult = await this.executeTool(toolName, toolArgs);
        return {
          jsonrpc: '2.0',
          id,
          result: {
            content: [
              {
                type: 'text',
                text: JSON.stringify(toolResult, null, 2),
              },
            ],
            isError: false,
          },
        };
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        return {
          jsonrpc: '2.0',
          id,
          result: {
            content: [
              {
                type: 'text',
                text: JSON.stringify({ error: errorMsg }, null, 2),
              },
            ],
            isError: true,
          },
        };
      }
    }

    return {
      jsonrpc: '2.0',
      id,
      error: {
        code: -32601,
        message: `Method not found: ${method}`,
      },
    };
  }

  listen(
    input: NodeJS.ReadableStream = process.stdin,
    output: NodeJS.WritableStream = process.stdout,
  ): void {
    this.rl = readline.createInterface({ input, terminal: false });

    this.rl.on('line', async (line) => {
      const trimmed = line.trim();
      if (!trimmed) return;

      try {
        const req = JSON.parse(trimmed) as JsonRpcRequest;
        const res = await this.handleMessage(req);
        if (res) {
          output.write(JSON.stringify(res) + '\n');
        }
      } catch {
        output.write(
          JSON.stringify({
            jsonrpc: '2.0',
            id: null,
            error: {
              code: -32700,
              message: 'Parse error: invalid JSON',
            },
          }) + '\n',
        );
      }
    });
  }

  close(): void {
    if (this.rl) {
      this.rl.close();
    }
  }
}

// Direct execution detection in Node ESM
function isDirectRun(): boolean {
  if (typeof process === 'undefined' || !process.argv[1]) return false;
  try {
    const entryPath = fs.realpathSync(process.argv[1]);
    const modulePath = fs.realpathSync(fileURLToPath(import.meta.url));
    return entryPath === modulePath;
  } catch {
    return false;
  }
}

if (isDirectRun()) {
  const server = new SpectraMcpServer();
  server.listen();
}
