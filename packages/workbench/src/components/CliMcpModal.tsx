import React, { useState } from 'react';
import {
  X,
  Terminal,
  Cpu,
  ShieldAlert,
  Copy,
  Check,
  CheckCircle2,
  AlertTriangle,
  Play,
  Code2,
} from 'lucide-react';

export interface CliMcpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export type CliMcpTab = 'all' | 'cli' | 'mcp' | 'refusal';

export const CliMcpModal: React.FC<CliMcpModalProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<CliMcpTab>('all');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard?.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 1500);
  };

  const cliSnippet = `pnpm spectra verify --video benchmark/clips/dom_catch_010_v1.mp4 --target "Complete Checkout"`;
  const mcpConfigSnippet = JSON.stringify(
    {
      mcpServers: {
        spectra: {
          command: 'node',
          args: ['packages/mcp-server/dist/index.js'],
        },
      },
    },
    null,
    2,
  );

  return (
    <div className="fixed inset-0 z-50 bg-[#181816]/70 backdrop-blur-xs flex items-center justify-center p-4 select-none font-sans">
      <div className="bg-[#EAE7DF] border-[2px] border-[#181816] rounded-[6px] shadow-2xl max-w-5xl w-full max-h-[90vh] flex flex-col overflow-hidden text-[#181816]">
        {/* Top Header Bar */}
        <header className="h-11 px-4 bg-[#DFDCD3] border-b border-[#B8B4A9] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-5 h-5 rounded-[3px] bg-[#181816] flex items-center justify-center text-white font-mono text-xs font-bold">
              &gt;_
            </div>
            <span className="font-mono font-bold text-xs tracking-wider uppercase text-[#181816]">
              Spectra System Architecture · CLI, 4-Tool MCP &amp; Rule 2 Calibration
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* Tab Controls */}
            <nav className="flex items-center gap-1 bg-[#D6D3C9] p-0.5 rounded-[4px] border border-[#B8B4A9]">
              <button
                type="button"
                onClick={() => setActiveTab('all')}
                className={`px-2 py-0.5 text-[11px] font-mono rounded-[3px] cursor-pointer transition-colors ${
                  activeTab === 'all'
                    ? 'bg-[#181816] text-white font-semibold'
                    : 'text-[#3A3935] hover:bg-[#DFDCD3]'
                }`}
              >
                Full Overview
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('cli')}
                className={`px-2 py-0.5 text-[11px] font-mono rounded-[3px] cursor-pointer transition-colors ${
                  activeTab === 'cli'
                    ? 'bg-[#181816] text-white font-semibold'
                    : 'text-[#3A3935] hover:bg-[#DFDCD3]'
                }`}
              >
                1. CLI Execution
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('mcp')}
                className={`px-2 py-0.5 text-[11px] font-mono rounded-[3px] cursor-pointer transition-colors ${
                  activeTab === 'mcp'
                    ? 'bg-[#181816] text-white font-semibold'
                    : 'text-[#3A3935] hover:bg-[#DFDCD3]'
                }`}
              >
                2. 4-Tool MCP Server
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('refusal')}
                className={`px-2 py-0.5 text-[11px] font-mono rounded-[3px] cursor-pointer transition-colors ${
                  activeTab === 'refusal'
                    ? 'bg-[#181816] text-white font-semibold'
                    : 'text-[#3A3935] hover:bg-[#DFDCD3]'
                }`}
              >
                3. Rule 2 Refusal
              </button>
            </nav>

            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded-[3px] text-[#4A4843] hover:text-[#181816] hover:bg-[#D6D3C9] transition-colors cursor-pointer ml-1"
              title="Close modal (Esc)"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* Modal Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0 bg-[#EAE7DF]">
          {/* ACT 5 PANEL 1: ZERO-BBOX CLI EXECUTION */}
          {(activeTab === 'all' || activeTab === 'cli') && (
            <div className="rounded-[4px] border border-[#B8B4A9] bg-[#F4F1EA] overflow-hidden shadow-xs">
              <div className="px-3.5 py-2 bg-[#DFDCD3] border-b border-[#B8B4A9] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-[#181816]" />
                  <span className="font-mono font-bold text-xs text-[#181816]">
                    ACT 5.1 · ZERO-BBOX CLI EXECUTION (STANDALONE VERIFICATION)
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono px-1.5 py-0.5 bg-[#DFDCD3] border border-[#B8B4A9] text-[#4A4843]">
                    EXIT CODE 1
                  </span>
                  <span className="text-[10px] font-mono px-2 py-0.5 bg-[#F2C6BE] border border-[#DF9B90] text-[#9E2A22] font-semibold">
                    REJECTED · 9.60% LOSS
                  </span>
                </div>
              </div>

              <div className="p-3.5 space-y-3 font-mono text-xs">
                {/* Command Bar */}
                <div className="flex items-center justify-between bg-[#181816] text-white px-3 py-2 rounded-[3px]">
                  <div className="flex items-center gap-2 overflow-x-auto">
                    <span className="text-[#9BB8A5]">$</span>
                    <span className="text-[#EAE7DF]">{cliSnippet}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleCopy(cliSnippet, 'cli')}
                    className="p-1 hover:bg-[#333330] rounded cursor-pointer text-[#DFDCD3] transition-colors shrink-0 ml-2"
                    title="Copy command"
                  >
                    {copiedKey === 'cli' ? (
                      <Check className="w-3.5 h-3.5 text-[#2E7D52]" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>

                {/* Terminal Execution Log */}
                <div className="p-3 bg-[#1F1E1B] text-[#D8D4C8] rounded-[3px] text-[11px] leading-relaxed space-y-1.5 font-mono overflow-x-auto">
                  <div className="text-[#8E8B82]">
                    [01/04] 01 · FRAME EXTRACT : Isolated 8 frames @ 4.0 FPS (1280x720) in 44ms
                  </div>
                  <div className="text-[#8E8B82]">
                    [02/04] 02 · SAM 3.1 FRAME-0: Prompt auto-resolved bbox [x=909, y=600, w=342,
                    h=51] in 138ms
                  </div>
                  <div className="text-[#8E8B82]">
                    [03/04] 03 · PIXEL NCC &amp; VISIBILITY: 1,700 occluded pixels, visRatio = 0.9000
                    in 26ms
                  </div>
                  <div className="text-[#E05246] font-semibold">
                    [04/04] 04 · DUAL REFEREE : rSam = 0.9080 (9.20% loss), visRatio = 0.9000 (10.00%
                    loss)
                  </div>
                  <div className="pt-1 border-t border-[#333330] text-[#9BB8A5] flex items-center justify-between">
                    <span>
                      Δ = 0.0080 &lt;= 0.0410 (CROSS-INSTRUMENT PASS) | 3σ THRESHOLD = 1.35%
                    </span>
                    <span className="text-[#E05246] font-bold">
                      VERDICT: REJECTED (9.60% loss exceeds 1.35%)
                    </span>
                  </div>
                </div>

                {/* Telemetry Grid */}
                <div className="grid grid-cols-4 gap-2 pt-1 text-[10px]">
                  <div className="p-2 bg-[#DFDCD3] border border-[#B8B4A9] rounded-[3px]">
                    <div className="text-[#6E6A60] uppercase">SAM 3.1 Loss</div>
                    <div className="font-bold text-[#9E2A22] text-xs">9.20%</div>
                  </div>
                  <div className="p-2 bg-[#DFDCD3] border border-[#B8B4A9] rounded-[3px]">
                    <div className="text-[#6E6A60] uppercase">Pixel Loss</div>
                    <div className="font-bold text-[#9E2A22] text-xs">10.00% (1,700 px)</div>
                  </div>
                  <div className="p-2 bg-[#DFDCD3] border border-[#B8B4A9] rounded-[3px]">
                    <div className="text-[#6E6A60] uppercase">Dual Disagreement</div>
                    <div className="font-bold text-[#1D4D35] text-xs">0.80% &lt;= 4.10%</div>
                  </div>
                  <div className="p-2 bg-[#DFDCD3] border border-[#B8B4A9] rounded-[3px]">
                    <div className="text-[#6E6A60] uppercase">Total Wall Clock</div>
                    <div className="font-bold text-[#181816] text-xs">217ms</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ACT 5 PANEL 2: 4-TOOL MCP SERVER */}
          {(activeTab === 'all' || activeTab === 'mcp') && (
            <div className="rounded-[4px] border border-[#B8B4A9] bg-[#F4F1EA] overflow-hidden shadow-xs">
              <div className="px-3.5 py-2 bg-[#DFDCD3] border-b border-[#B8B4A9] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-[#181816]" />
                  <span className="font-mono font-bold text-xs text-[#181816]">
                    ACT 5.2 · 4-TOOL MCP SERVER (MUSE CODE / CLAUDE CODE / CURSOR READY)
                  </span>
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 bg-[#DCE8DF] border border-[#9BB8A5] text-[#1D4D35] font-semibold">
                  JSON-RPC 2.0 PROTOCOL
                </span>
              </div>

              <div className="p-3.5 space-y-3 font-mono text-xs">
                {/* Tool Cards Grid */}
                <div className="grid grid-cols-2 gap-2.5">
                  <div className="p-2.5 bg-[#DFDCD3] border border-[#B8B4A9] rounded-[3px] space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-[#181816]">1. spectra_verify</span>
                      <span className="text-[9px] bg-[#EAE7DF] px-1 py-0.2 rounded border border-[#B8B4A9]">
                        TOOL
                      </span>
                    </div>
                    <p className="text-[10px] text-[#4A4843] leading-relaxed">
                      Dual-instrument visual referee for video clips &amp; frame pairs. Returns
                      structured MeasurementResult with rSam, visRatio, threshold, and reason.
                    </p>
                  </div>

                  <div className="p-2.5 bg-[#DFDCD3] border border-[#B8B4A9] rounded-[3px] space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-[#181816]">2. spectra_check</span>
                      <span className="text-[9px] bg-[#EAE7DF] px-1 py-0.2 rounded border border-[#B8B4A9]">
                        TOOL
                      </span>
                    </div>
                    <p className="text-[10px] text-[#4A4843] leading-relaxed">
                      Verifies current UI state against pre-compiled visual invariant schemas in{' '}
                      <code>.spectra/invariants.json</code>.
                    </p>
                  </div>

                  <div className="p-2.5 bg-[#DFDCD3] border border-[#B8B4A9] rounded-[3px] space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-[#181816]">
                        3. spectra_compile_invariant
                      </span>
                      <span className="text-[9px] bg-[#EAE7DF] px-1 py-0.2 rounded border border-[#B8B4A9]">
                        TOOL
                      </span>
                    </div>
                    <p className="text-[10px] text-[#4A4843] leading-relaxed">
                      Compiles natural-language voice/text intent into formal visual invariant
                      contracts via Muse Spark (Zod-schema validated).
                    </p>
                  </div>

                  <div className="p-2.5 bg-[#DFDCD3] border border-[#B8B4A9] rounded-[3px] space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-[#181816]">4. spectra_closed_loop</span>
                      <span className="text-[9px] bg-[#EAE7DF] px-1 py-0.2 rounded border border-[#B8B4A9]">
                        TOOL
                      </span>
                    </div>
                    <p className="text-[10px] text-[#4A4843] leading-relaxed">
                      Full autonomous repair loop: executes Pass #1 rejection, synthesizes CSS/DOM
                      patch, and re-verifies Pass #2 with 100% visibility.
                    </p>
                  </div>
                </div>

                {/* Agent MCP Config Snippet */}
                <div className="p-2.5 bg-[#1F1E1B] text-[#D8D4C8] rounded-[3px] text-[11px] font-mono space-y-1">
                  <div className="text-[#8E8B82] flex items-center justify-between">
                    <span>// claude_desktop_config.json / .cursor/mcp.json</span>
                    <button
                      type="button"
                      onClick={() => handleCopy(mcpConfigSnippet, 'mcp')}
                      className="text-[#9BB8A5] hover:text-white cursor-pointer"
                    >
                      {copiedKey === 'mcp' ? 'Copied!' : 'Copy Config'}
                    </button>
                  </div>
                  <pre className="text-[#9BB8A5] overflow-x-auto">{mcpConfigSnippet}</pre>
                </div>
              </div>
            </div>
          )}

          {/* ACT 5 PANEL 3: RULE 2 CALIBRATION REFUSAL CONTRACT */}
          {(activeTab === 'all' || activeTab === 'refusal') && (
            <div className="rounded-[4px] border border-[#B8B4A9] bg-[#F4F1EA] overflow-hidden shadow-xs">
              <div className="px-3.5 py-2 bg-[#DFDCD3] border-b border-[#B8B4A9] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-[#9E2A22]" />
                  <span className="font-mono font-bold text-xs text-[#181816]">
                    ACT 5.3 · RULE 2 CALIBRATION REFUSAL CONTRACT (ZERO HALLUCINATION)
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-mono px-1.5 py-0.5 bg-[#DFDCD3] border border-[#B8B4A9] text-[#4A4843]">
                    NON-NEGOTIABLE
                  </span>
                  <span className="text-[10px] font-mono px-2 py-0.5 bg-[#DCE8DF] border border-[#9BB8A5] text-[#1D4D35] font-semibold">
                    FAIL-CLOSED
                  </span>
                </div>
              </div>

              <div className="p-3.5 space-y-3 font-mono text-xs">
                <div className="p-2.5 bg-[#DFDCD3] border border-[#B8B4A9] rounded-[3px] text-[11px] leading-relaxed text-[#3A3935]">
                  <strong className="text-[#181816]">Rule 2 Mandate:</strong> Noise-floor (
                  <code>sigma_noise = 0.0045</code>, <code>3σ = 0.0135</code>) and disagreement
                  threshold (<code>delta = 0.0410</code>) are ONLY ever loaded from empirical Spike
                  1 measurements. If calibration is null or missing, any code path attempting to
                  emit verdicts must refuse with an explicit <code>UncalibratedError</code>!
                </div>

                {/* Vitest Execution Proof */}
                <div className="p-3 bg-[#1F1E1B] text-[#D8D4C8] rounded-[3px] text-[11px] leading-relaxed font-mono space-y-1">
                  <div className="text-[#2E7D52] font-semibold flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>✓ packages/core/src/__tests__/calibration.test.ts (24 tests passed)</span>
                  </div>
                  <div className="text-[#DFDCD3] pl-4">
                    ✓ refuses to emit verdicts when uncalibrated (throws UncalibratedError per Rule 2)
                    [1.2ms]
                  </div>
                  <div className="text-[#E05246] pl-6 text-[10px]">
                    UncalibratedError: Noise-floor values (sigma_noise, delta) are null. Refusing to
                    emit verdicts per Rule 2.
                  </div>
                  <div className="text-[#DFDCD3] pl-4">
                    ✓ enforces citation format: chore(calibration): update sigma_noise to 0.0045
                    [0.8ms]
                  </div>
                  <div className="text-[#8E8B82] pt-1 pl-4 border-t border-[#333330]">
                    Citation Source: resp_6ae03ef78bd3db0853c642af (SAM 3.1 settle frames t_2..t_7)
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Bar */}
        <footer className="h-10 px-4 bg-[#DFDCD3] border-t border-[#B8B4A9] flex items-center justify-between text-[11px] font-mono text-[#4A4843]">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#2E7D52]" />
            <span>Dual-Instrument Architecture · Meta SAM 3.1 + Deterministic Pixel Matcher</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1 bg-[#181816] hover:bg-[#2C2C29] text-white rounded-[3px] cursor-pointer text-xs font-semibold transition-colors"
          >
            Close Control Panel
          </button>
        </footer>
      </div>
    </div>
  );
};

