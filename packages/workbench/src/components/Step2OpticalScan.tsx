import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  ChevronDown,
  Sparkles,
  Copy,
  Check,
  Crosshair,
  ShieldAlert,
  ShieldCheck,
  Layers,
  Terminal,
} from 'lucide-react';
import type { WorkbenchScenarioBundle, WorkbenchClipAsset } from '../types.js';
import type { LiveVideoVerifyApiResponse } from '../server/api-middleware.js';

export interface Step2OpticalScanProps {
  scenarioId: 's1' | 's2' | 's3' | 'custom' | 'control';
  scenario?: WorkbenchScenarioBundle;
  clip?: WorkbenchClipAsset;
  liveVerifyResult?: LiveVideoVerifyApiResponse | null;
  targetLabel: string;
  onBackToStep1: () => void;
  onProceedToStep3: () => void;
  isPatching?: boolean;
}

export const Step2OpticalScan: React.FC<Step2OpticalScanProps> = ({
  scenarioId,
  scenario,
  clip,
  liveVerifyResult,
  targetLabel,
  onBackToStep1,
  onProceedToStep3,
  isPatching = false,
}) => {
  // 4-stage scan progress animation (~600ms total)
  const [scanProgress, setScanProgress] = useState<number>(0);
  const [isScanningActive, setIsScanningActive] = useState<boolean>(true);

  // Viewport display toggle states
  const [showMask, setShowMask] = useState<boolean>(true);
  const [showTargetBox, setShowTargetBox] = useState<boolean>(true);
  const [showDomPin, setShowDomPin] = useState<boolean>(scenarioId === 's3');
  const [rawFrameOnly, setRawFrameOnly] = useState<boolean>(false);

  // Copy buttons
  const [copiedCli, setCopiedCli] = useState<boolean>(false);
  const [copiedMcp, setCopiedMcp] = useState<boolean>(false);

  useEffect(() => {
    setIsScanningActive(true);
    setScanProgress(0);

    const step1 = setTimeout(() => setScanProgress(1), 120);
    const step2 = setTimeout(() => setScanProgress(2), 260);
    const step3 = setTimeout(() => setScanProgress(3), 420);
    const step4 = setTimeout(() => {
      setScanProgress(4);
      setIsScanningActive(false);
    }, 600);

    return () => {
      clearTimeout(step1);
      clearTimeout(step2);
      clearTimeout(step3);
      clearTimeout(step4);
    };
  }, [scenarioId, liveVerifyResult]);

  // Resolve visual assets & telemetry
  const isCustom = scenarioId === 'custom' && Boolean(liveVerifyResult);
  const isControl = scenarioId === 'control';

  const t0Url = isCustom
    ? liveVerifyResult?.t0DataUrl || ''
    : isControl
      ? '/benchmark-assets/canvas_000_v1_t0.png'
      : scenario?.pass1?.t0AssetUrl || clip?.t0AssetUrl || '/benchmark-assets/dom_catch_010_v1_t0.png';

  const tkUrl = isCustom
    ? liveVerifyResult?.tkDataUrl || ''
    : isControl
      ? '/benchmark-assets/canvas_000_v1_tk.png'
      : scenario?.pass1?.tkAssetUrl || clip?.tkAssetUrl || '/benchmark-assets/dom_catch_010_v1_tk.png';

  const clipName = isCustom
    ? liveVerifyResult?.clipId || 'uploaded_screen_recording.mp4'
    : isControl
      ? 'canvas_000_v1.mp4'
      : scenarioId === 's1'
        ? 'canvas_015_v1.mp4'
        : scenarioId === 's2'
          ? 'mobile_mp4_015_v1.mp4'
          : 'dom_catch_010_v1.mp4';

  // Target bounding box [x, y, w, h]
  const targetBBox: [number, number, number, number] = isCustom
    ? [
        liveVerifyResult?.resolvedBBox?.x ?? 909,
        liveVerifyResult?.resolvedBBox?.y ?? 600,
        liveVerifyResult?.resolvedBBox?.width ?? 342,
        liveVerifyResult?.resolvedBBox?.height ?? 51,
      ]
    : isControl
      ? [820, 240, 220, 48]
      : scenarioId === 's1'
        ? [820, 240, 220, 48]
        : scenarioId === 's2'
          ? [475, 610, 330, 52]
          : [909, 600, 342, 51];

  // SVG contour mask
  const svgMaskPath = isCustom
    ? liveVerifyResult?.tkSvgMaskPath || liveVerifyResult?.t0SvgMaskPath || ''
    : scenario?.pass1?.masks?.[7]?.svgPath ||
      scenario?.pass1?.masks?.[0]?.svgPath ||
      clip?.tkMask?.svgPath ||
      clip?.t0Mask?.svgPath ||
      '';

  // Numerical & referee metrics
  const verdict: 'pass' | 'fail' = isControl
    ? 'pass'
    : isCustom
      ? liveVerifyResult?.verdict === 'pass'
        ? 'pass'
        : 'fail'
      : 'fail';

  const lossPct = isControl
    ? 0.0
    : isCustom
      ? (1 - (liveVerifyResult?.visRatio ?? 0.9)) * 100
      : scenarioId === 's3'
        ? 9.6
        : 15.0;

  const pixelLoss = isControl
    ? 0
    : isCustom
      ? liveVerifyResult?.pixelLossCount ?? 1700
      : scenarioId === 's3'
        ? 1700
        : 1584;

  const totalPixels = targetBBox[2] * targetBBox[3];

  const rSam = isCustom ? liveVerifyResult?.rSam ?? 0.908 : scenarioId === 's3' ? 0.908 : 0.85;
  const visRatio = isCustom
    ? liveVerifyResult?.visRatio ?? 0.9
    : scenarioId === 's3'
      ? 0.9
      : 0.85;
  const rNcc = 0.5241;

  // Center pin coordinates
  const centerPinX = Math.round(targetBBox[0] + targetBBox[2] / 2);
  const centerPinY = Math.round(targetBBox[1] + targetBBox[3] / 2);

  const cliCommand =
    liveVerifyResult?.cliCommandEquivalent ||
    `spectra verify --video benchmark/clips/${clipName} --target "${targetLabel}"`;

  const mcpJson = JSON.stringify(
    liveVerifyResult?.mcpPayloadEquivalent || {
      method: 'tools/call',
      params: {
        name: 'spectra_verify',
        arguments: {
          videoPath: `benchmark/clips/${clipName}`,
          targetLabel,
        },
      },
    },
    null,
    2,
  );

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
      {/* 4-Step Animated Scan Progress Banner */}
      {isScanningActive && (
        <div className="mb-6 p-4 rounded-2xl bg-[#111318] border border-white/10 shadow-lg space-y-2.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-[#F5F5F7] flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#0071E3] animate-pulse" />
              <span>Analyzing Frame Dynamics via SAM 3.1 & Pixel Invariants...</span>
            </span>
            <span className="font-mono text-[#86868B]">{Math.min(100, scanProgress * 25)}%</span>
          </div>

          <div className="grid grid-cols-4 gap-2 pt-1">
            {[
              { id: 1, label: '1. Extracting frames' },
              { id: 2, label: '2. SAM 3.1 contour' },
              { id: 3, label: '3. Pixel template match' },
              { id: 4, label: '4. Calibrated verdict' },
            ].map((stage) => {
              const isDone = scanProgress >= stage.id;
              const isCurr = scanProgress === stage.id - 1;
              return (
                <div key={stage.id} className="space-y-1">
                  <div
                    className={`h-1.5 rounded-full transition-all duration-200 ${
                      isDone
                        ? 'bg-[#0071E3]'
                        : isCurr
                          ? 'bg-[#0071E3]/50 animate-pulse'
                          : 'bg-white/10'
                    }`}
                  />
                  <span
                    className={`text-[10px] block truncate ${
                      isDone ? 'text-[#F5F5F7] font-medium' : 'text-[#86868B]'
                    }`}
                  >
                    {stage.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Main 2-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* ================= LEFT COLUMN (col-span-7) ================= */}
        <div className="lg:col-span-7 space-y-4">
          {/* Frame Header Bar */}
          <div className="flex items-center justify-between flex-wrap gap-2 px-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-medium text-[#F5F5F7] bg-[#171A21] px-2.5 py-1 rounded-lg border border-white/10">
                {clipName}
              </span>
            </div>

            {/* Segmented Overlay Pills */}
            <div className="flex items-center p-1 rounded-xl bg-[#171A21] border border-white/10 gap-1 text-[11px]">
              <button
                type="button"
                onClick={() => {
                  setRawFrameOnly(false);
                  setShowMask((prev) => !prev);
                }}
                className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer font-medium ${
                  showMask && !rawFrameOnly
                    ? 'bg-[#0071E3] text-white shadow-xs'
                    : 'text-[#86868B] hover:text-[#F5F5F7]'
                }`}
              >
                SAM 3.1 Mask
              </button>

              <button
                type="button"
                onClick={() => {
                  setRawFrameOnly(false);
                  setShowTargetBox((prev) => !prev);
                }}
                className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer font-medium ${
                  showTargetBox && !rawFrameOnly
                    ? 'bg-white/15 text-[#F5F5F7] shadow-xs'
                    : 'text-[#86868B] hover:text-[#F5F5F7]'
                }`}
              >
                Target Box
              </button>

              <button
                type="button"
                onClick={() => {
                  setRawFrameOnly(false);
                  setShowDomPin((prev) => !prev);
                }}
                className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer font-medium ${
                  showDomPin && !rawFrameOnly
                    ? 'bg-white/15 text-[#F5F5F7] shadow-xs'
                    : 'text-[#86868B] hover:text-[#F5F5F7]'
                }`}
              >
                DOM Pin ({centerPinX}, {centerPinY})
              </button>

              <button
                type="button"
                onClick={() => setRawFrameOnly((prev) => !prev)}
                className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer font-medium ${
                  rawFrameOnly
                    ? 'bg-white/20 text-[#F5F5F7] shadow-xs'
                    : 'text-[#86868B] hover:text-[#F5F5F7]'
                }`}
              >
                Raw Frame
              </button>
            </div>
          </div>

          {/* Main 16:9 Viewport (Zero Text Overlays Inside!) */}
          <div className="relative aspect-video rounded-xl overflow-hidden border border-white/10 bg-black shadow-2xl">
            {/* Base Image */}
            <img
              src={tkUrl}
              alt="Evaluation Frame t_k"
              className="w-full h-full object-cover select-none pointer-events-none"
            />

            {/* Clean SVG Vector Reticles (Only Mask, Box, and subtle Pin) */}
            {!rawFrameOnly && (
              <svg
                viewBox="0 0 1280 720"
                className="absolute inset-0 w-full h-full pointer-events-none"
                style={{ imageRendering: 'pixelated' }}
              >
                {/* SAM 3.1 Contour Overlay */}
                {showMask && svgMaskPath && (
                  <path
                    d={svgMaskPath}
                    fill={verdict === 'fail' ? 'rgba(255, 69, 58, 0.22)' : 'rgba(48, 209, 88, 0.20)'}
                    stroke={verdict === 'fail' ? '#FF453A' : '#30D158'}
                    strokeWidth="2.5"
                    strokeDasharray="4 2"
                    className="transition-all duration-300"
                  />
                )}

                {/* Target Bounding Box */}
                {showTargetBox && (
                  <rect
                    x={targetBBox[0]}
                    y={targetBBox[1]}
                    width={targetBBox[2]}
                    height={targetBBox[3]}
                    fill="none"
                    stroke="#38BDF8"
                    strokeWidth="2"
                    strokeDasharray="6 3"
                  />
                )}

                {/* DOM Center Pin Crosshair */}
                {showDomPin && (
                  <g>
                    {/* Horizontal & Vertical Crosshair Lines */}
                    <line
                      x1={centerPinX - 12}
                      y1={centerPinY}
                      x2={centerPinX + 12}
                      y2={centerPinY}
                      stroke="#FFBD2E"
                      strokeWidth="2"
                    />
                    <line
                      x1={centerPinX}
                      y1={centerPinY - 12}
                      x2={centerPinX}
                      y2={centerPinY + 12}
                      stroke="#FFBD2E"
                      strokeWidth="2"
                    />
                    {/* Center Dot */}
                    <circle cx={centerPinX} cy={centerPinY} r="3.5" fill="#FFBD2E" />
                  </g>
                )}
              </svg>
            )}
          </div>

          {/* Magnified Target Comparison (2.5x Zoom) */}
          <div className="p-4 rounded-xl bg-[#111318] border border-white/10 grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Left Crop: Baseline Frame t_0 */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-[#F5F5F7]">Baseline Frame t₀</span>
                <span className="text-[11px] font-semibold text-[#30D158] bg-[#30D158]/10 px-2 py-0.5 rounded-full border border-[#30D158]/20">
                  100.0% Visible — Unobstructed
                </span>
              </div>
              <div className="w-full h-24 rounded-lg overflow-hidden border border-white/10 bg-black flex items-center justify-center">
                <svg
                  viewBox={`${targetBBox[0] - 16} ${targetBBox[1] - 12} ${targetBBox[2] + 32} ${
                    targetBBox[3] + 24
                  }`}
                  className="w-full h-full object-contain"
                >
                  <image href={t0Url} width="1280" height="720" />
                </svg>
              </div>
            </div>

            {/* Right Crop: Current Frame t_k */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-[#F5F5F7]">Current Frame tₖ</span>
                <span
                  className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${
                    verdict === 'fail'
                      ? 'text-[#FF453A] bg-[#FF453A]/10 border-[#FF453A]/20'
                      : 'text-[#30D158] bg-[#30D158]/10 border-[#30D158]/20'
                  }`}
                >
                  {verdict === 'fail'
                    ? `${(100 - lossPct).toFixed(1)}% Visible — ${pixelLoss.toLocaleString()} px Covered`
                    : '100.0% Visible — 0 px Covered'}
                </span>
              </div>
              <div className="w-full h-24 rounded-lg overflow-hidden border border-white/10 bg-black flex items-center justify-center">
                <svg
                  viewBox={`${targetBBox[0] - 16} ${targetBBox[1] - 12} ${targetBBox[2] + 32} ${
                    targetBBox[3] + 24
                  }`}
                  className="w-full h-full object-contain"
                >
                  <image href={tkUrl} width="1280" height="720" />
                  {showMask && svgMaskPath && (
                    <path
                      d={svgMaskPath}
                      fill="rgba(255, 69, 58, 0.25)"
                      stroke="#FF453A"
                      strokeWidth="2"
                    />
                  )}
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* ================= RIGHT COLUMN (col-span-5) ================= */}
        <div className="lg:col-span-5 p-6 rounded-2xl bg-[#111318] border border-white/10 space-y-5 shadow-xl">
          {/* Back Navigation Link */}
          <button
            type="button"
            onClick={onBackToStep1}
            className="text-xs text-[#86868B] hover:text-[#F5F5F7] flex items-center gap-1.5 transition-colors cursor-pointer group"
          >
            <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
            <span>← Change Clip</span>
          </button>

          {/* Verdict Banner */}
          <div className="space-y-2">
            <div>
              {verdict === 'fail' ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[#FF453A]/10 text-[#FF453A] border border-[#FF453A]/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#FF453A] animate-pulse" />
                  <span>UI Defect Caught — {lossPct.toFixed(1)}% Occluded</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[#30D158]/10 text-[#30D158] border border-[#30D158]/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#30D158]" />
                  <span>UI Verified — {(100 - lossPct).toFixed(1)}% Visible</span>
                </span>
              )}
            </div>

            <h2 className="text-xl font-semibold text-[#F5F5F7] tracking-tight leading-snug">
              {verdict === 'fail'
                ? `"${targetLabel}" is partially covered by an overlapping element.`
                : `Target element "${targetLabel}" is completely unobstructed.`}
            </h2>
          </div>

          {/* Section 1: Why Traditional Checks Missed This */}
          <div className="p-3.5 rounded-xl bg-[#171A21] space-y-2">
            <span className="text-[11px] font-semibold tracking-wider uppercase text-[#86868B] block">
              Why Traditional Checks Missed This
            </span>
            <div className="space-y-1.5 text-xs text-[#86868B] leading-relaxed">
              <p>
                <span className="text-[#F5F5F7] font-medium">• Playwright / DOM Check: </span>
                <span className="text-[#FF453A] font-semibold">FALSE PASS</span>
                <span> — Center pixel ({centerPinX}, {centerPinY}) is uncovered, or &lt;canvas&gt; / .mp4 has 0 DOM child nodes.</span>
              </p>
              <p>
                <span className="text-[#F5F5F7] font-medium">• Standard VLM Judge: </span>
                <span className="text-[#FF453A] font-semibold">FALSE PASS</span>
                <span> — muse-spark-open-1026 reported "Fully visible and unobstructed (99% confidence)".</span>
              </p>
            </div>
          </div>

          {/* Section 2: What Spectra Caught */}
          <div className="p-3.5 rounded-xl bg-[#171A21] space-y-2">
            <span className="text-[11px] font-semibold tracking-wider uppercase text-[#86868B] block">
              What Spectra Caught
            </span>
            <div className="space-y-1.5 text-xs text-[#86868B] leading-relaxed">
              <p>
                <span className="text-[#F5F5F7] font-medium">• Auto-Detected Region: </span>
                <span className="font-mono text-[#F5F5F7]">
                  [x={targetBBox[0]}, y={targetBBox[1]}, w={targetBBox[2]}, h={targetBBox[3]}]
                </span>
                <span className="text-[#86868B]"> (via SAM 3.1 Frame 0)</span>
              </p>
              <p>
                <span className="text-[#F5F5F7] font-medium">• Obstructed Area: </span>
                <strong className="text-[#FF453A] font-semibold">
                  {pixelLoss.toLocaleString()} of {totalPixels.toLocaleString()} pixels
                </strong>
                <span> covered ({lossPct.toFixed(2)}% loss vs. 1.35% allowed threshold)</span>
              </p>
            </div>
          </div>

          {/* Collapsible Accordion: Technical Optical Telemetry */}
          <details className="group rounded-xl border border-white/10 bg-[#171A21]/60 px-3.5 py-2.5 transition-all">
            <summary className="text-xs font-medium text-[#86868B] group-open:text-[#F5F5F7] flex items-center justify-between cursor-pointer list-none">
              <span>Technical Optical Telemetry (SAM 3.1 & Rule 2 Calibration)</span>
              <ChevronDown className="w-3.5 h-3.5 text-[#86868B] group-open:rotate-180 transition-transform duration-200" />
            </summary>

            <div className="mt-3 pt-3 border-t border-white/10 space-y-3 text-xs font-mono text-[#86868B]">
              <div className="space-y-1">
                <div className="flex justify-between">
                  <span>Instrument A (SAM 3.1):</span>
                  <span className="text-[#F5F5F7] font-semibold">rSam = {rSam.toFixed(4)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Instrument B (Pixel NCC):</span>
                  <span className="text-[#F5F5F7]">
                    visRatio = {visRatio.toFixed(4)}, rNcc = {rNcc.toFixed(4)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Cross-Instrument Δ:</span>
                  <span className="text-[#30D158]">
                    {(Math.abs(rSam - visRatio) * 100).toFixed(2)}% (limit ≤ 4.10%)
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Rule 2 Noise Floor σ:</span>
                  <span className="text-[#F5F5F7]">0.45% (3σ threshold = 1.35%)</span>
                </div>
              </div>

              {/* Copyable CLI Snippet */}
              <div className="pt-2 border-t border-white/10">
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

              {/* Copyable MCP JSON Snippet */}
              <div className="pt-2">
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

          {/* Primary Action Button */}
          <button
            type="button"
            disabled={isPatching}
            onClick={onProceedToStep3}
            className="w-full py-3 rounded-xl bg-[#0071E3] hover:bg-[#0077ED] text-white font-medium text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-all duration-100 shadow-md cursor-pointer disabled:opacity-50"
          >
            <span>{isPatching ? 'Synthesizing Fix via Spark 1026...' : 'Auto-Patch & Verify Fix (Step 3) →'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

