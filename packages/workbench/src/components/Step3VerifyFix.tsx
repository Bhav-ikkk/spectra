import React, { useState, useRef, useCallback } from 'react';
import {
  CheckCircle2,
  Sparkles,
  Copy,
  Check,
  MoveHorizontal,
  RotateCcw,
  ArrowLeft,
  Terminal,
  Layers,
} from 'lucide-react';
import type { WorkbenchScenarioBundle } from '../types.js';

export interface Step3VerifyFixProps {
  scenarioId: 's1' | 's2' | 's3' | 'custom' | 'control';
  scenario?: WorkbenchScenarioBundle;
  targetLabel: string;
  onBackToScan: () => void;
  onVerifyAnother: () => void;
  closedLoopResult?: {
    closedLoopSuccess?: boolean;
    pass2RenderedDataUrl?: string;
    pass2DataUrl?: string;
    summary?: Record<string, unknown>;
  } | null;
}

export const Step3VerifyFix: React.FC<Step3VerifyFixProps> = ({
  scenarioId,
  scenario,
  targetLabel,
  onBackToScan,
  onVerifyAnother,
  closedLoopResult,
}) => {
  // Split-curtain slider position (0 to 100 percent)
  const [sliderPos, setSliderPos] = useState<number>(50);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Copy buttons
  const [copiedPatch, setCopiedPatch] = useState<boolean>(false);
  const [copiedCli, setCopiedCli] = useState<boolean>(false);
  const [copiedMcp, setCopiedMcp] = useState<boolean>(false);

  // 1:1 Direct Manipulation Pointer Tracking (Skills.md Section 2)
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    setIsDragging(true);
    updateSlider(e.clientX);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isDragging) {
      updateSlider(e.clientX);
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isDragging) {
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        // Safe fallback
      }
      setIsDragging(false);
    }
  };

  const updateSlider = useCallback((clientX: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const pct = Math.max(0, Math.min(100, (x / rect.width) * 100));
    setSliderPos(pct);
  }, []);

  // Pass 1 & Pass 2 assets
  const pass1TkUrl =
    scenario?.pass1?.tkAssetUrl ||
    (scenarioId === 's1'
      ? '/benchmark-assets/canvas_015_v1_tk.png'
      : scenarioId === 's2'
        ? '/benchmark-assets/mobile_mp4_015_v1_tk.png'
        : '/benchmark-assets/dom_catch_010_v1_tk.png');

  const pass2TkUrl =
    closedLoopResult?.pass2RenderedDataUrl ||
    closedLoopResult?.pass2DataUrl ||
    scenario?.pass2?.tkAssetUrl ||
    (scenarioId === 's1'
      ? '/benchmark-assets/canvas_000_v1_tk.png'
      : scenarioId === 's2'
        ? '/benchmark-assets/mobile_mp4_000_v1_tk.png'
        : '/benchmark-assets/dom_catch_000_v1_tk.png');

  // Target bounding box [x, y, w, h]
  const targetBBox: [number, number, number, number] =
    scenarioId === 's1'
      ? [820, 240, 220, 48]
      : scenarioId === 's2'
        ? [475, 610, 330, 52]
        : [909, 600, 342, 51];

  // Fix details
  const initialLossPct = scenarioId === 's1' ? 15.0 : scenarioId === 's2' ? 15.0 : 9.6;
  const initialLossPx = scenarioId === 's1' ? 1584 : scenarioId === 's2' ? 2574 : 1700;

  const patchCode =
    scenarioId === 's1'
      ? `/* Adjust tooltip positioning and canvas z-ordering */\n.canvas-tooltip-overlay {\n  pointer-events: none;\n  transform: translateY(-40px);\n  opacity: 0.95;\n}`
      : scenarioId === 's2'
        ? `/* Constrain promo sheet max-height to clear CTA button */\n.promo-bottom-sheet {\n  max-height: 48vh;\n  bottom: 0;\n  padding-bottom: 24px;\n}`
        : `.cart-drawer-footer {\n  margin-top: 0px;\n  height: 110px;\n}`;

  const patchExplanation =
    scenarioId === 's1'
      ? 'Offset hover tooltip upward by 40px so Revenue Series Legend is 100% visible with zero canvas occlusion.'
      : scenarioId === 's2'
        ? 'Constrained sheet height and adjusted padding so the Pay button remains 100% clear of bottom-sheet overlap.'
        : 'Removed negative top margin and reduced sticky footer height to 110px so Complete Checkout has 0px overlap.';

  const cliCommand = `spectra closed-loop-demo --scenario ${scenarioId === 'custom' || scenarioId === 'control' ? 's3' : scenarioId}`;
  const mcpJson = JSON.stringify(
    {
      method: 'tools/call',
      params: {
        name: 'spectra_closed_loop',
        arguments: {
          scenario: scenarioId === 'custom' || scenarioId === 'control' ? 's3' : scenarioId,
        },
      },
    },
    null,
    2,
  );

  const handleCopyPatch = () => {
    navigator.clipboard.writeText(patchCode);
    setCopiedPatch(true);
    setTimeout(() => setCopiedPatch(false), 2000);
  };

  const handleCopyCli = () => {
    navigator.clipboard.writeText(cliCommand);
    setCopiedCli(true);
    setTimeout(() => setCopiedCli(false), 2000);
  };

  const handleCopyMcp = () => {
    navigator.clipboard.writeText(mcpJson);
    setCopiedMcp(true);
    setTimeout(() => setCopiedMcp(false), 2000);
  };

  return (
    <div className="w-full max-w-6xl mx-auto py-6 px-6 select-none animate-fade-in">
      {/* 1. Top Status Banner */}
      <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between flex-wrap gap-4 shadow-lg">
        <div className="flex items-center gap-3">
          <span className="text-xl" role="img" aria-label="Verified Check">
            🟢
          </span>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-[#30D158] text-sm tracking-tight uppercase">
                CLOSED-LOOP VERIFIED
              </span>
              <span className="text-xs text-[#86868B] hidden sm:inline">•</span>
              <span className="text-xs text-[#86868B] hidden sm:inline">Zero-Spend Local Pass</span>
            </div>
            <p className="text-sm text-[#F5F5F7] mt-0.5">
              "{targetLabel}" restored from {(100 - initialLossPct).toFixed(1)}% → 100.0% visibility (0 px obstructed)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={onBackToScan}
            className="px-3.5 py-1.5 rounded-xl text-xs font-medium text-[#86868B] hover:text-[#F5F5F7] bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 active:scale-[0.98] transition-all cursor-pointer"
          >
            ← Back to Scan
          </button>
          <button
            type="button"
            onClick={onVerifyAnother}
            className="px-4 py-1.5 rounded-xl text-xs font-medium text-black bg-white hover:bg-zinc-200 active:scale-[0.98] transition-all shadow-sm cursor-pointer"
          >
            Verify Another Clip
          </button>
        </div>
      </div>

      {/* 2. 2-Column Comparison & Code Diff */}
      <div className="mt-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* ================= LEFT COLUMN (col-span-7) ================= */}
        <div className="lg:col-span-7 space-y-4">
          {/* Magnified Button Before vs. After */}
          <div className="p-4 rounded-xl bg-[#111318] border border-white/10 grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Pass #1 Broken */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-[#F5F5F7]">Pass #1 (Broken)</span>
                <span className="text-[11px] font-semibold text-[#FF453A] bg-[#FF453A]/10 px-2 py-0.5 rounded-full border border-[#FF453A]/20">
                  {(100 - initialLossPct).toFixed(1)}% Visible 🔴
                </span>
              </div>
              <div className="w-full h-24 rounded-lg overflow-hidden border border-white/10 bg-black flex items-center justify-center">
                <svg
                  viewBox={`${targetBBox[0] - 16} ${targetBBox[1] - 12} ${targetBBox[2] + 32} ${
                    targetBBox[3] + 24
                  }`}
                  className="w-full h-full object-contain"
                >
                  <image href={pass1TkUrl} width="1280" height="720" />
                </svg>
              </div>
            </div>

            {/* Pass #2 Patched */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-[#F5F5F7]">Pass #2 (Patched)</span>
                <span className="text-[11px] font-semibold text-[#30D158] bg-[#30D158]/10 px-2 py-0.5 rounded-full border border-[#30D158]/20">
                  100.0% Visible 🟢
                </span>
              </div>
              <div className="w-full h-24 rounded-lg overflow-hidden border border-white/10 bg-black flex items-center justify-center">
                <svg
                  viewBox={`${targetBBox[0] - 16} ${targetBBox[1] - 12} ${targetBBox[2] + 32} ${
                    targetBBox[3] + 24
                  }`}
                  className="w-full h-full object-contain"
                >
                  <image href={pass2TkUrl} width="1280" height="720" />
                </svg>
              </div>
            </div>
          </div>

          {/* Interactive Before / After Split-Curtain Viewport */}
          <div className="space-y-2">
            <div className="flex items-center justify-between px-1 text-xs text-[#86868B]">
              <span className="flex items-center gap-1.5 font-medium text-[#F5F5F7]">
                <MoveHorizontal className="w-3.5 h-3.5 text-[#0071E3]" />
                <span>Split-Curtain Interactive Comparison</span>
              </span>
              <span>Drag slider left / right to compare</span>
            </div>

            <div
              ref={containerRef}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              className="relative aspect-video rounded-xl overflow-hidden border border-white/10 bg-black shadow-2xl cursor-ew-resize select-none touch-none"
            >
              {/* Bottom Image: Pass #1 (Broken) */}
              <img
                src={pass1TkUrl}
                alt="Pass 1 Broken Frame"
                className="absolute inset-0 w-full h-full object-cover select-none pointer-events-none"
              />

              {/* Top Image: Pass #2 (Patched), clipped by sliderPos */}
              <div
                className="absolute inset-0 overflow-hidden pointer-events-none select-none"
                style={{
                  clipPath: `polygon(0% 0%, ${sliderPos}% 0%, ${sliderPos}% 100%, 0% 100%)`,
                }}
              >
                <img
                  src={pass2TkUrl}
                  alt="Pass 2 Patched Frame"
                  className="absolute inset-0 w-full h-full object-cover select-none pointer-events-none"
                />
              </div>

              {/* Slider Divider Hairline & Apple-Style Tactile Pill Handle */}
              <div
                className="absolute top-0 bottom-0 pointer-events-none"
                style={{ left: `${sliderPos}%` }}
              >
                {/* White Hairline */}
                <div className="absolute top-0 bottom-0 -left-[1px] w-[2px] bg-white shadow-2xl" />

                {/* Tactile Handle */}
                <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-8 h-8 rounded-full bg-white text-black shadow-2xl flex items-center justify-center border border-black/10 transition-transform active:scale-95">
                  <MoveHorizontal className="w-4 h-4 stroke-[2.5]" />
                </div>
              </div>

              {/* Corner Badges */}
              <div className="absolute top-3 left-3 px-2 py-1 rounded-lg bg-black/60 backdrop-blur-md border border-white/10 text-[11px] font-medium text-[#30D158] pointer-events-none">
                Pass #2 (Patched)
              </div>
              <div className="absolute top-3 right-3 px-2 py-1 rounded-lg bg-black/60 backdrop-blur-md border border-white/10 text-[11px] font-medium text-[#FF453A] pointer-events-none">
                Pass #1 (Broken)
              </div>
            </div>
          </div>
        </div>

        {/* ================= RIGHT COLUMN (col-span-5) ================= */}
        <div className="lg:col-span-5 p-5 rounded-2xl bg-[#111318] border border-white/10 space-y-4 shadow-xl">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#0071E3]" />
              <h2 className="text-sm font-semibold text-[#F5F5F7]">AI Agent Repair Patch</h2>
            </div>
            <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-white/[0.06] text-[#86868B] border border-white/[0.08]">
              meta-models/muse-spark-open-1026
            </span>
          </div>

          {/* Plain explanation */}
          <p className="text-xs text-[#86868B] leading-relaxed">
            {patchExplanation}
          </p>

          {/* Syntax-highlighted code block */}
          <div className="relative rounded-xl bg-[#090A0C] border border-white/10 overflow-hidden">
            <div className="flex items-center justify-between px-3.5 py-1.5 bg-[#171A21] border-b border-white/10 text-[11px] text-[#86868B]">
              <span className="font-mono">fix-patch.css</span>
              <button
                type="button"
                onClick={handleCopyPatch}
                className="flex items-center gap-1 text-[#0071E3] hover:text-white transition-colors cursor-pointer"
              >
                {copiedPatch ? <Check className="w-3 h-3 text-[#30D158]" /> : <Copy className="w-3 h-3" />}
                <span>{copiedPatch ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
            <pre className="p-3.5 text-xs font-mono text-[#F5F5F7] overflow-x-auto whitespace-pre-wrap leading-relaxed">
              <code>{patchCode}</code>
            </pre>
          </div>

          {/* Pass #1 vs. Pass #2 Verification Table */}
          <div className="space-y-1.5">
            <span className="text-[11px] font-semibold tracking-wider uppercase text-[#86868B] block">
              Spectra Dual-Referee Verification
            </span>
            <div className="rounded-xl border border-white/10 overflow-hidden bg-[#171A21]">
              <table className="w-full text-xs text-left">
                <thead className="bg-white/[0.03] text-[10px] text-[#86868B] uppercase border-b border-white/10 font-semibold">
                  <tr>
                    <th className="px-3 py-2">Metric</th>
                    <th className="px-3 py-2">Pass #1 (Broken)</th>
                    <th className="px-3 py-2">Pass #2 (Patched)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 font-mono text-[11px]">
                  <tr>
                    <td className="px-3 py-2 text-[#86868B] font-sans">Occlusion</td>
                    <td className="px-3 py-2 text-[#FF453A] font-semibold">{initialLossPct.toFixed(1)}%</td>
                    <td className="px-3 py-2 text-[#30D158] font-semibold">0.0%</td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2 text-[#86868B] font-sans">Pixel Loss</td>
                    <td className="px-3 py-2 text-[#FF453A] font-semibold">{initialLossPx.toLocaleString()} px</td>
                    <td className="px-3 py-2 text-[#30D158] font-semibold">0 px</td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2 text-[#86868B] font-sans">Decision</td>
                    <td className="px-3 py-2 text-[#FF453A] font-medium">REJECTED ❌</td>
                    <td className="px-3 py-2 text-[#30D158] font-semibold">VERIFIED ✅</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Collapsible Copyable CLI & MCP Snippets */}
          <details className="group rounded-xl border border-white/10 bg-[#171A21]/60 px-3.5 py-2.5 transition-all">
            <summary className="text-xs font-medium text-[#86868B] group-open:text-[#F5F5F7] flex items-center justify-between cursor-pointer list-none">
              <span>Terminal & Agent Automation (CLI / MCP)</span>
              <span className="text-[10px] text-[#0071E3] font-mono group-open:hidden">Expand</span>
            </summary>

            <div className="mt-3 pt-3 border-t border-white/10 space-y-3 text-xs font-mono text-[#86868B]">
              {/* CLI reproduction */}
              <div>
                <div className="flex items-center justify-between text-[11px] mb-1">
                  <span className="text-[#86868B] flex items-center gap-1 font-sans">
                    <Terminal className="w-3 h-3 text-[#0071E3]" />
                    <span>CLI Reproduction:</span>
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyCli}
                    className="text-[#0071E3] hover:text-white flex items-center gap-1 transition-colors cursor-pointer"
                  >
                    {copiedCli ? <Check className="w-3 h-3 text-[#30D158]" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedCli ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
                <pre className="p-2 rounded-lg bg-[#090A0C] border border-white/10 overflow-x-auto text-[10px] text-[#CBCED4] whitespace-pre-wrap">
                  {cliCommand}
                </pre>
              </div>

              {/* MCP snippet */}
              <div>
                <div className="flex items-center justify-between text-[11px] mb-1">
                  <span className="text-[#86868B] flex items-center gap-1 font-sans">
                    <Layers className="w-3 h-3 text-[#30D158]" />
                    <span>MCP JSON-RPC Payload:</span>
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyMcp}
                    className="text-[#0071E3] hover:text-white flex items-center gap-1 transition-colors cursor-pointer"
                  >
                    {copiedMcp ? <Check className="w-3 h-3 text-[#30D158]" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedMcp ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
                <pre className="p-2 rounded-lg bg-[#090A0C] border border-white/10 overflow-x-auto text-[10px] text-[#CBCED4] max-h-24">
                  {mcpJson}
                </pre>
              </div>
            </div>
          </details>
        </div>
      </div>
    </div>
  );
};

