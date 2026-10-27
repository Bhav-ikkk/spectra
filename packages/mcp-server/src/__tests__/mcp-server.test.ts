import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { PassThrough } from 'node:stream';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SpectraMcpServer } from '../index.js';

function findProjectRoot(): string {
  let dir = process.cwd();
  while (!fs.existsSync(path.join(dir, 'pnpm-workspace.yaml'))) {
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return dir;
}

interface JsonRpcResponse<T = unknown> {
  jsonrpc: '2.0';
  id: number | string | null;
  result?: T;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

class McpTestClient {
  private inStream: PassThrough;
  private outStream: PassThrough;
  private server: SpectraMcpServer;
  private pending = new Map<number, (res: JsonRpcResponse) => void>();
  private nextId = 1;

  constructor() {
    this.inStream = new PassThrough();
    this.outStream = new PassThrough();
    this.server = new SpectraMcpServer();
    this.server.listen(this.inStream, this.outStream);

    const rl = readline.createInterface({ input: this.outStream, terminal: false });
    rl.on('line', (line) => {
      const trimmed = line.trim();
      if (!trimmed) return;
      try {
        const parsed = JSON.parse(trimmed) as JsonRpcResponse;
        if (typeof parsed.id === 'number' && this.pending.has(parsed.id)) {
          const resolver = this.pending.get(parsed.id)!;
          this.pending.delete(parsed.id);
          resolver(parsed);
        }
      } catch {
        // ignore unparseable lines in stream listener
      }
    });
  }

  request<T = unknown>(
    method: string,
    params?: Record<string, unknown>,
  ): Promise<JsonRpcResponse<T>> {
    const id = this.nextId++;
    return new Promise((resolve) => {
      this.pending.set(id, resolve as (res: JsonRpcResponse) => void);
      this.inStream.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n');
    });
  }

  notify(method: string, params?: Record<string, unknown>): void {
    this.inStream.write(JSON.stringify({ jsonrpc: '2.0', method, params }) + '\n');
  }

  sendRaw(raw: string): Promise<string> {
    return new Promise((resolve) => {
      this.outStream.once('data', (d) => {
        resolve(d.toString());
      });
      this.inStream.write(raw + '\n');
    });
  }

  close(): void {
    this.server.close();
    this.inStream.end();
    this.outStream.end();
  }
}

describe('@spectra/mcp-server - End-to-End Stdio Protocol Integration Tests ($0.00 Spend)', () => {
  const root = findProjectRoot();
  let client: McpTestClient;

  beforeEach(() => {
    client = new McpTestClient();
  });

  afterEach(() => {
    client.close();
  });

  describe('Protocol Lifecycle & Discovery', () => {
    it('handles initialize handshake with server capabilities and protocol version', async () => {
      const res = await client.request<{
        protocolVersion: string;
        capabilities: { tools: Record<string, unknown> };
        serverInfo: { name: string; version: string };
      }>('initialize', {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'test-agent', version: '1.0' },
      });

      expect(res.jsonrpc).toBe('2.0');
      expect(res.error).toBeUndefined();
      expect(res.result).toBeDefined();
      expect(res.result?.protocolVersion).toBe('2024-11-05');
      expect(res.result?.serverInfo.name).toBe('spectra-mcp');
      expect(res.result?.capabilities.tools).toBeDefined();
    });

    it('acknowledges notifications/initialized without errors', () => {
      // Must not throw or emit any unhandled errors
      expect(() => {
        client.notify('notifications/initialized');
      }).not.toThrow();
    });

    it('lists all 3 bounded Spectra tools with schemas in tools/list', async () => {
      const res = await client.request<{
        tools: Array<{
          name: string;
          description: string;
          inputSchema: { properties: Record<string, unknown> };
        }>;
      }>('tools/list');

      expect(res.error).toBeUndefined();
      expect(res.result?.tools).toBeDefined();
      const toolNames = res.result?.tools.map((t) => t.name);

      expect(toolNames).toContain('spectra_verify');
      expect(toolNames).toContain('spectra_check');
      expect(toolNames).toContain('spectra_compile_invariant');

      const verifyTool = res.result?.tools.find((t) => t.name === 'spectra_verify');
      expect(verifyTool?.description).toContain('Dual-Instrument Referee');
      expect(verifyTool?.inputSchema.properties.t0FramePath).toBeDefined();
      expect(verifyTool?.inputSchema.properties.tkFramePath).toBeDefined();
      expect(verifyTool?.inputSchema.properties.targetBBox).toBeDefined();
    });
  });

  describe('tools/call: spectra_verify', () => {
    it('verifies canvas_000_v1 (0% clean control) returning verdict === "pass" and pixelLossCount === 0', async () => {
      const t0Path = path.join(root, 'benchmark/clips/canvas_000_v1_t0.png');
      const tkPath = path.join(root, 'benchmark/clips/canvas_000_v1_tk.png');
      const samPath = path.join(root, 'benchmark/responses/phase2-smoke/canvas_000_v1_sam.json');

      const res = await client.request<{
        content: Array<{ type: string; text: string }>;
        isError: boolean;
      }>('tools/call', {
        name: 'spectra_verify',
        arguments: {
          clipId: 'canvas_000_v1',
          t0FramePath: t0Path,
          tkFramePath: tkPath,
          targetLabel: 'Revenue Series Legend',
          targetBBox: { x: 820, y: 240, width: 220, height: 48 },
          cachedSamResponsePath: samPath,
        },
      });

      expect(res.error).toBeUndefined();
      expect(res.result?.isError).toBe(false);
      expect(res.result?.content[0]?.type).toBe('text');

      const data = JSON.parse(res.result?.content[0]?.text || '{}');
      expect(data.verdict).toBe('pass');
      expect(data.rSam).toBeGreaterThan(0.98);
      expect(data.visRatio).toBe(1.0);
      expect(data.pixelLossCount).toBe(0);
      expect(data.threshold).toBeCloseTo(0.0135, 4);
      expect(data.calibrated).toBe(true);
      expect(data.reason).toContain('VERIFIED:');
    });

    it('catches dom_catch_010_v1 (10% occlusion) returning verdict === "fail" and pixelLossCount > 0', async () => {
      const t0Path = path.join(root, 'benchmark/clips/dom_catch_010_v1_t0.png');
      const tkPath = path.join(root, 'benchmark/clips/dom_catch_010_v1_tk.png');
      const samPath = path.join(root, 'benchmark/responses/phase2-smoke/dom_catch_010_v1_sam.json');

      const res = await client.request<{
        content: Array<{ type: string; text: string }>;
        isError: boolean;
      }>('tools/call', {
        name: 'spectra_verify',
        arguments: {
          clipId: 'dom_catch_010_v1',
          t0FramePath: t0Path,
          tkFramePath: tkPath,
          targetLabel: 'Complete Checkout',
          targetBBox: { x: 910, y: 600, width: 340, height: 50 },
          cachedSamResponsePath: samPath,
        },
      });

      expect(res.error).toBeUndefined();
      expect(res.result?.isError).toBe(false);

      const data = JSON.parse(res.result?.content[0]?.text || '{}');
      expect(data.verdict).toBe('fail');
      expect(data.pixelLossCount).toBe(1700);
      expect(data.pixelLossCount).toBeGreaterThan(0);
      expect(data.visRatio).toBe(0.9);
      expect(data.rSam).toBeCloseTo(0.908, 2);
      expect(data.reason).toContain('REJECTED: Visibility loss 9.60% exceeds threshold');
    });
  });

  describe('tools/call: spectra_compile_invariant and spectra_check', () => {
    it('compiles voice expectation from cached voice smoke directory', async () => {
      const cachedDir = path.join(root, 'benchmark/responses/voice-smoke');

      const res = await client.request<{
        content: Array<{ type: string; text: string }>;
        isError: boolean;
      }>('tools/call', {
        name: 'spectra_compile_invariant',
        arguments: {
          cachedDir,
        },
      });

      expect(res.error).toBeUndefined();
      expect(res.result?.isError).toBe(false);

      const data = JSON.parse(res.result?.content[0]?.text || '{}');
      expect(data.success).toBe(true);
      expect(data.invariantsCount).toBe(2);
      expect(data.document.invariants[0].id).toBe('complete-checkout-button-visible');
    });

    it('checks invariants across manifest returning BenchmarkReport', async () => {
      const invariantsPath = path.join(root, '.spectra/invariants.json');
      const manifestPath = path.join(root, 'benchmark/manifest.json');
      const cachedSamDir = path.join(root, 'benchmark/responses/phase2-smoke');

      const res = await client.request<{
        content: Array<{ type: string; text: string }>;
        isError: boolean;
      }>('tools/call', {
        name: 'spectra_check',
        arguments: {
          invariantsPath,
          manifestPath,
          cachedSamDir,
        },
      });

      expect(res.error).toBeUndefined();
      expect(res.result?.isError).toBe(false);

      const data = JSON.parse(res.result?.content[0]?.text || '{}');
      expect(data.overallVerdict).toBe('fail');
      expect(data.results.length).toBe(45);
      expect(data.passed).toBeGreaterThan(0);
      expect(data.failed).toBeGreaterThan(0);
    });
  });

  describe('Error Handling', () => {
    it('returns JSON-RPC error -32601 for unknown methods', async () => {
      const res = await client.request('unknown/method');
      expect(res.error).toBeDefined();
      expect(res.error?.code).toBe(-32601);
      expect(res.error?.message).toContain('Method not found');
    });

    it('returns isError: true when a tool call fails (e.g. unknown tool or missing file)', async () => {
      const res = await client.request<{
        content: Array<{ type: string; text: string }>;
        isError: boolean;
      }>('tools/call', {
        name: 'non_existent_tool',
        arguments: {},
      });

      expect(res.result?.isError).toBe(true);
      const data = JSON.parse(res.result?.content[0]?.text || '{}');
      expect(data.error).toContain('Unknown tool');
    });

    it('handles raw invalid JSON with parse error -32700', async () => {
      const rawRes = await client.sendRaw('INVALID_JSON_LINE');
      const parsed = JSON.parse(rawRes);
      expect(parsed.error.code).toBe(-32700);
      expect(parsed.error.message).toContain('Parse error');
    });
  });
});
