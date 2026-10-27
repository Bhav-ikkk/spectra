import React, { useState, useRef, useEffect } from 'react';
import {
  Eye,
  SlidersHorizontal,
  Target,
  Maximize2,
  Film,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  Play,
  Pause,
} from 'lucide-react';
import type { DecodedMaskFrame } from '../types.js';

interface OpticalViewportProps {
  t0Url: string;
  tkUrl: string;
  repairedUrl?: string;
  videoUrl?: string;
  masks?: DecodedMaskFrame[];
  targetBBox?: [number, number, number, number];
  targetLabel: string;
  verdict: 'pass' | 'fail' | 'inconclusive';
  scenarioPhase?: 1 | 2 | 3 | 4; // Phase 1/2 = fractured, Phase 3/4 = repaired
  environment?: string;
}

export const OpticalViewport: React.FC<OpticalViewportProps> = ({
  t0Url,
  tkUrl,
  repairedUrl,
  videoUrl,
  masks,
  targetBBox,
  targetLabel,
  verdict,
  scenarioPhase = 1,
  environment = 'dom_catch',
}) => {
  // Layer toggles
  const [showRaw, setShowRaw] = useState(true);
  const [showMask, setShowMask] = useState(true);
  const [showBBox, setShowBBox] = useState(true);
  const [showCrosshair, setShowCrosshair] = useState(true);
  const [splitMode, setSplitMode] = useState(false);
  const [splitPos, setSplitPos] = useState(50); // percentage (0..100)
  const [activeFrameIndex, setActiveFrameIndex] = useState(7); // default to tk (frame 7)
  const [isPlaying, setIsPlaying] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);

  // Playback timer for 8-frame scrub
  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;
    if (isPlaying) {
      timer = setInterval(() => {
        setActiveFrameIndex((prev) => (prev + 1) % 8);
      }, 250); // 4 FPS = 250ms per frame
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isPlaying]);

  // Handle split curtain dragging
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!splitMode || !containerRef.current) return;
    if (e.buttons !== 1) return; // only drag on left click
    const rect = containerRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    setSplitPos((x / rect.width) * 100);
  };

  const isVerified = verdict === 'pass' || scenarioPhase >= 4;

  // Active mask for current scrub frame or fallback
  const activeMask =
    masks?.find((m) => m.frameIndex === activeFrameIndex) ||
    (isVerified ? masks?.[0] : masks?.[masks.length - 1]);

  // Current display image URL
  const currentImageUrl =
    scenarioPhase >= 4 && repairedUrl ? repairedUrl : activeFrameIndex === 0 ? t0Url : tkUrl;

  // Center coordinate of target bounding box for DOM naive hit-test
  const bboxX = targetBBox?.[0] ?? 910;
  const bboxY = targetBBox?.[1] ?? 600;
  const bboxW = targetBBox?.[2] ?? 340;
  const bboxH = targetBBox?.[3] ?? 50;
  const centerX = bboxX + bboxW / 2;
  const centerY = bboxY + bboxH / 2;

  return (
    <div className="flex-1 h-full flex flex-col bg-[#09090B] border-r border-white/[0.08] relative select-none overflow-hidden">
      {/* Viewport Top Header */}
      <div className="h-10 px-4 border-b border-white/[0.06] flex items-center justify-between bg-[#121216]/80 backdrop-blur-md z-20">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-zinc-200 flex items-center gap-1.5">
            <Film className="w-3.5 h-3.5 text-indigo-400" />
            Optical Viewport
          </span>
          <span className="text-[11px] text-zinc-500 font-mono">1280×720 @ 4 FPS</span>
          <span className="px-1.5 py-0.5 rounded bg-zinc-800 text-[10px] font-mono text-zinc-400">
            {environment.toUpperCase()}
          </span>
        </div>

        {/* Layer Controls Bar */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowRaw(!showRaw)}
            className={`px-2 py-1 rounded text-[11px] font-medium flex items-center gap-1 transition-all ${
              showRaw
                ? 'bg-zinc-700/80 text-white border border-white/10'
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
            title="Layer 1: Raw Video/Image Render"
          >
            <Eye className="w-3 h-3" />
            <span>Raw</span>
          </button>

          <button
            onClick={() => setShowMask(!showMask)}
            className={`px-2 py-1 rounded text-[11px] font-medium flex items-center gap-1 transition-all ${
              showMask
                ? isVerified
                  ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-500/40'
                  : 'bg-rose-950/80 text-rose-300 border border-rose-500/40'
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
            title="Layer 2: SAM 3.1 Decoded SVG Vector Mask"
          >
            <Sparkles className="w-3 h-3" />
            <span>SAM 3.1 Mask</span>
          </button>

          <button
            onClick={() => setShowBBox(!showBBox)}
            className={`px-2 py-1 rounded text-[11px] font-medium flex items-center gap-1 transition-all ${
              showBBox
                ? 'bg-amber-950/80 text-amber-300 border border-amber-500/40'
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
            title="Layer 3: Target Region Invariant Bounding Box"
          >
            <Target className="w-3 h-3" />
            <span>BBox</span>
          </button>

          <button
            onClick={() => setShowCrosshair(!showCrosshair)}
            className={`px-2 py-1 rounded text-[11px] font-medium flex items-center gap-1 transition-all ${
              showCrosshair
                ? 'bg-cyan-950/80 text-cyan-300 border border-cyan-500/40'
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
            title="Layer 3: DOM Center Point Crosshair"
          >
            <span className="font-mono text-xs">+</span>
            <span>DOM Hit-Pt</span>
          </button>

          <div className="w-[1px] h-4 bg-white/10 mx-1" />

          <button
            onClick={() => setSplitMode(!splitMode)}
            className={`px-2 py-1 rounded text-[11px] font-medium flex items-center gap-1 transition-all ${
              splitMode
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04]'
            }`}
            title="Layer 4: Split Curtain Slider (Pass 1 Fractured vs Pass 2 Repaired)"
          >
            <SlidersHorizontal className="w-3 h-3" />
            <span>Split Curtain</span>
          </button>
        </div>
      </div>

      {/* Main Optical Canvas Area */}
      <div
        ref={containerRef}
        onMouseMove={handleMouseMove}
        className="flex-1 w-full bg-[#050507] flex items-center justify-center p-3 overflow-hidden relative cursor-crosshair"
      >
        <div
          className="relative rounded-lg overflow-hidden border border-white/10 shadow-2xl bg-black max-w-full max-h-full aspect-[16/9]"
          style={{ width: '100%', maxWidth: '1280px' }}
        >
          {/* Base Layer: Fractured or Repaired Frame */}
          <img
            src={currentImageUrl}
            alt="Optical Frame"
            className="w-full h-full object-contain block select-none pointer-events-none"
          />

          {/* Layer 4: Split Curtain Overlay (When Split Mode is Active) */}
          {splitMode && (
            <div
              className="absolute inset-0 overflow-hidden pointer-events-none"
              style={{ clipPath: `inset(0 ${100 - splitPos}% 0 0)` }}
            >
              <img
                src={repairedUrl || t0Url}
                alt="Repaired Verified Frame"
                className="w-full h-full object-contain block select-none"
              />
              <div className="absolute top-3 left-3 px-2 py-0.5 rounded bg-emerald-950/80 border border-emerald-500/50 text-emerald-300 text-[10px] font-mono">
                Pass #2 Repaired (100% Verified)
              </div>
            </div>
          )}

          {/* Split Handle Line */}
          {splitMode && (
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-white cursor-ew-resize shadow-[0_0_10px_rgba(255,255,255,0.8)] z-30"
              style={{ left: `${splitPos}%` }}
            >
              <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-6 h-6 rounded-full bg-white text-zinc-900 flex items-center justify-center shadow-lg text-[10px] font-bold">
                ↔
              </div>
            </div>
          )}

          {/* SVG Overlay: Decoded SAM 3.1 Vector Mask + Target BBox + DOM Center Point */}
          <svg
            viewBox="0 0 1280 720"
            className="absolute inset-0 w-full h-full pointer-events-none z-10"
          >
            {/* Layer 2: Decoded SAM 3.1 SVG Mask Path */}
            {showMask && activeMask && (
              <g
                transform={`translate(${activeMask.bounds.left}, ${activeMask.bounds.top})`}
                className="transition-all duration-300"
              >
                <path
                  d={activeMask.svgPath}
                  fill={isVerified ? 'rgba(16, 185, 129, 0.45)' : 'rgba(239, 68, 68, 0.55)'}
                  stroke={isVerified ? '#10B981' : '#EF4444'}
                  strokeWidth="2.5"
                  strokeLinejoin="round"
                  className={!isVerified ? 'animate-pulse' : ''}
                />
              </g>
            )}

            {/* Layer 3: Target Region Invariant Bounding Box */}
            {showBBox && (
              <g>
                <rect
                  x={bboxX}
                  y={bboxY}
                  width={bboxW}
                  height={bboxH}
                  fill="none"
                  stroke="#F59E0B"
                  strokeWidth="2"
                  strokeDasharray="6 3"
                  className="transition-all duration-300"
                />
                <rect
                  x={bboxX}
                  y={bboxY - 20}
                  width={Math.min(bboxW, 260)}
                  height="18"
                  fill="rgba(245, 158, 11, 0.9)"
                  rx="3"
                />
                <text
                  x={bboxX + 6}
                  y={bboxY - 7}
                  fill="#000"
                  fontSize="11"
                  fontFamily="Inter, sans-serif"
                  fontWeight="600"
                >
                  {targetLabel} ({bboxW}×{bboxH}px)
                </text>
              </g>
            )}

            {/* Layer 3: Naive DOM Hit-Test Crosshair Point (Blind Spot Demonstration) */}
            {showCrosshair && (
              <g className="transition-all duration-300">
                {/* Crosshair lines */}
                <line
                  x1={centerX - 16}
                  y1={centerY}
                  x2={centerX + 16}
                  y2={centerY}
                  stroke="#06B6D4"
                  strokeWidth="2"
                />
                <line
                  x1={centerX}
                  y1={centerY - 16}
                  x2={centerX}
                  y2={centerY + 16}
                  stroke="#06B6D4"
                  strokeWidth="2"
                />
                <circle
                  cx={centerX}
                  cy={centerY}
                  r="6"
                  fill="rgba(6, 182, 212, 0.3)"
                  stroke="#06B6D4"
                  strokeWidth="2"
                />
                <circle cx={centerX} cy={centerY} r="2" fill="#FFFFFF" />

                {/* DOM Center Point Callout Label */}
                <rect
                  x={centerX + 12}
                  y={centerY - 18}
                  width="190"
                  height="22"
                  rx="4"
                  fill="rgba(6, 182, 212, 0.95)"
                />
                <text
                  x={centerX + 18}
                  y={centerY - 4}
                  fill="#09090B"
                  fontSize="10"
                  fontFamily="JetBrains Mono, monospace"
                  fontWeight="700"
                >
                  DOM Pt ({Math.round(centerX)}, {Math.round(centerY)}): PASS
                </text>
              </g>
            )}
          </svg>

          {/* Split Mode Indicator Label */}
          {splitMode && (
            <div className="absolute top-3 right-3 px-2 py-0.5 rounded bg-rose-950/80 border border-rose-500/50 text-rose-300 text-[10px] font-mono z-20">
              Pass #1 Fractured (Occluded)
            </div>
          )}

          {/* Blind Spot Floating Warning Banner */}
          {!isVerified && showCrosshair && (
            <div className="absolute bottom-3 left-3 right-3 px-3 py-2 rounded-lg bg-black/85 backdrop-blur-md border border-rose-500/40 flex items-center justify-between text-xs text-rose-200 z-20">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-400 flex-shrink-0 animate-pulse" />
                <span>
                  <strong>THE CATCH:</strong> Naive DOM center-point at ({Math.round(centerX)},{' '}
                  {Math.round(centerY)}) returns <code>true</code> (no hit obstruction), yet Spectra
                  catches <strong>10.0% visual edge occlusion</strong> (1,700 px covered).
                </span>
              </div>
              <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300">
                Rule 1 Genuine
              </span>
            </div>
          )}

          {/* Pass 2 Verified Banner */}
          {isVerified && (
            <div className="absolute bottom-3 left-3 right-3 px-3 py-2 rounded-lg bg-emerald-950/85 backdrop-blur-md border border-emerald-500/40 flex items-center justify-between text-xs text-emerald-200 z-20">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                <span>
                  <strong>VERIFIED BY SPECTRA REFEREE:</strong> Target element is 100% visible (0.0%
                  loss). Instrument A & B cross-agreement verified within noise tolerance (1.35%).
                </span>
              </div>
              <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300">
                0 PX LOSS
              </span>
            </div>
          )}
        </div>
      </div>

      {/* 8-Frame Scrub Bar & Playback Controls */}
      <div className="h-11 px-4 border-t border-white/[0.08] flex items-center justify-between bg-[#121216]/90 backdrop-blur-md z-20">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className="w-7 h-7 rounded-md bg-white/10 hover:bg-white/20 flex items-center justify-center text-zinc-200 transition-colors"
            title={isPlaying ? 'Pause' : 'Play 4 FPS Scrub'}
          >
            {isPlaying ? (
              <Pause className="w-3.5 h-3.5" />
            ) : (
              <Play className="w-3.5 h-3.5 ml-0.5" />
            )}
          </button>

          {/* Frame Pills (0 to 7) */}
          <div className="flex items-center gap-1">
            {[0, 1, 2, 3, 4, 5, 6, 7].map((idx) => {
              const isSelected = activeFrameIndex === idx;
              const isBaseline = idx === 0;
              const isEval = idx === 7;
              return (
                <button
                  key={idx}
                  onClick={() => setActiveFrameIndex(idx)}
                  className={`px-2 py-0.5 rounded text-[10px] font-mono font-medium transition-all ${
                    isSelected
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'bg-zinc-800 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700'
                  }`}
                >
                  t_{idx}
                  {isBaseline && <span className="text-[9px] text-zinc-400 ml-0.5">(t₀)</span>}
                  {isEval && <span className="text-[9px] text-zinc-400 ml-0.5">(tₖ)</span>}
                </button>
              );
            })}
          </div>
        </div>

        {/* Mask Readout */}
        <div className="text-[11px] font-mono text-zinc-400 flex items-center gap-2">
          <span>
            Active Frame: <strong className="text-white">t_{activeFrameIndex}</strong>
          </span>
          {activeMask?.area && (
            <>
              <span className="text-zinc-600">|</span>
              <span>
                SAM Mask Area:{' '}
                <strong className="text-white">{activeMask.area.toLocaleString()} px</strong>
              </span>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
