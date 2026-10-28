import React, { useState, useRef, useEffect } from 'react';
import {
  SlidersHorizontal,
  Play,
  Pause,
  Target,
  Crosshair,
  Maximize2,
  Sparkles,
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
  scenarioPhase?: 1 | 2 | 3 | 4;
  environment?: string;
}

export const OpticalViewport: React.FC<OpticalViewportProps> = ({
  t0Url,
  tkUrl,
  repairedUrl,
  masks,
  targetBBox,
  targetLabel: _targetLabel,
  verdict,
  scenarioPhase = 1,
  environment = 'dom_catch',
}) => {
  const [passView, setPassView] = useState<'pass1' | 'pass2' | 'split'>(
    scenarioPhase >= 4 ? 'pass2' : 'pass1',
  );

  useEffect(() => {
    if (scenarioPhase >= 4) {
      setPassView('pass2');
    } else {
      setPassView('pass1');
    }
  }, [scenarioPhase]);

  const [showMask, setShowMask] = useState(true);
  const [showBBox, setShowBBox] = useState(true);
  const [showCrosshair, setShowCrosshair] = useState(true);

  const [activeFrameIndex, setActiveFrameIndex] = useState(7);
  const [isPlaying, setIsPlaying] = useState(false);

  const [splitPos, setSplitPos] = useState(50);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;
    if (isPlaying) {
      timer = setInterval(() => {
        setActiveFrameIndex((prev) => (prev + 1) % 8);
      }, 250);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isPlaying]);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (passView !== 'split' || !containerRef.current) return;
    if (e.buttons !== 1) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    setSplitPos((x / rect.width) * 100);
  };

  const isVerifiedPass = passView === 'pass2' || (verdict === 'pass' && passView !== 'pass1');

  const activeMask =
    masks?.find((m) => m.frameIndex === activeFrameIndex) ||
    (isVerifiedPass ? masks?.[0] : masks?.[masks.length - 1]);

  const currentImageUrl =
    passView === 'pass2' && repairedUrl
      ? repairedUrl
      : activeFrameIndex === 0
        ? t0Url
        : tkUrl;

  const bboxX = targetBBox?.[0] ?? 909;
  const bboxY = targetBBox?.[1] ?? 600;
  const bboxW = targetBBox?.[2] ?? 342;
  const bboxH = targetBBox?.[3] ?? 51;

  const hitX = bboxX + Math.round(bboxW / 2);
  const hitY = bboxY + Math.round(bboxH / 2);

  return (
    <div className="flex-1 h-full flex flex-col bg-paper-well border-r border-rule-border overflow-hidden select-none">
      {/* TOP TOOLBAR (40px, Single Line, No Wrapping) */}
      <div className="h-10 px-3 bg-paper-base border-b border-rule-border flex items-center justify-between shrink-0 whitespace-nowrap overflow-x-clip">
        {/* Pass Switcher */}
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-[10px] font-mono text-ink-muted">Pass:</span>
          <div className="flex items-center bg-paper-well rounded border border-rule-border p-0.5">
            <button
              onClick={() => setPassView('pass1')}
              className={`px-2 py-0.5 text-xs font-mono rounded transition-colors whitespace-nowrap ${
                passView === 'pass1'
                  ? 'bg-paper-surface text-signal-vermilion border border-signal-vermilion/40 font-medium'
                  : 'text-ink-muted hover:text-ink-primary'
              }`}
            >
              Pass #1: Broken
            </button>
            <button
              onClick={() => setPassView('pass2')}
              className={`px-2 py-0.5 text-xs font-mono rounded transition-colors whitespace-nowrap ${
                passView === 'pass2'
                  ? 'bg-paper-surface text-signal-emerald border border-signal-emerald/40 font-medium'
                  : 'text-ink-muted hover:text-ink-primary'
              }`}
            >
              Pass #2: Repaired
            </button>
            <button
              onClick={() => setPassView('split')}
              className={`px-2 py-0.5 text-xs font-mono rounded transition-colors flex items-center gap-1 whitespace-nowrap ${
                passView === 'split'
                  ? 'bg-paper-surface text-signal-cool border border-signal-cool/40 font-medium'
                  : 'text-ink-muted hover:text-ink-primary'
              }`}
            >
              <SlidersHorizontal className="w-3 h-3" />
              <span className="whitespace-nowrap">Split View</span>
            </button>
          </div>
        </div>

        {/* Vector Layer Toggles */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setShowMask(!showMask)}
            className={`px-2 py-0.5 rounded text-[11px] font-mono border transition-colors flex items-center gap-1 whitespace-nowrap ${
              showMask
                ? isVerifiedPass
                  ? 'bg-signal-emerald/10 text-signal-emerald border-signal-emerald/40'
                  : 'bg-signal-vermilion/10 text-signal-vermilion border-signal-vermilion/40'
                : 'bg-paper-well border-rule-border text-ink-muted'
            }`}
          >
            <Sparkles className="w-3 h-3" />
            <span className="whitespace-nowrap">SAM 3.1 Mask</span>
          </button>

          <button
            onClick={() => setShowBBox(!showBBox)}
            className={`px-2 py-0.5 rounded text-[11px] font-mono border transition-colors flex items-center gap-1 whitespace-nowrap ${
              showBBox
                ? 'bg-signal-cool/10 text-signal-cool border-signal-cool/40'
                : 'bg-paper-well border-rule-border text-ink-muted'
            }`}
          >
            <Target className="w-3 h-3" />
            <span className="whitespace-nowrap">Target Reticle</span>
          </button>

          <button
            onClick={() => setShowCrosshair(!showCrosshair)}
            className={`px-2 py-0.5 rounded text-[11px] font-mono border transition-colors flex items-center gap-1 whitespace-nowrap ${
              showCrosshair
                ? 'bg-signal-amber/10 text-signal-amber border-signal-amber/40'
                : 'bg-paper-well border-rule-border text-ink-muted'
            }`}
          >
            <Crosshair className="w-3 h-3" />
            <span className="whitespace-nowrap">DOM Hit Pin</span>
          </button>
        </div>

        {/* 8-Frame Scrubber */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className="p-1 rounded bg-paper-surface border border-rule-border text-ink-muted hover:text-ink-primary whitespace-nowrap"
            title={isPlaying ? 'Pause' : 'Play 8-Frame Sequence'}
          >
            {isPlaying ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
          </button>
          <div className="flex items-center bg-paper-well rounded border border-rule-border p-0.5">
            {[0, 1, 2, 3, 4, 5, 6, 7].map((idx) => (
              <button
                key={idx}
                onClick={() => {
                  setActiveFrameIndex(idx);
                  setIsPlaying(false);
                }}
                className={`px-1.5 py-0.5 text-[10px] font-mono rounded whitespace-nowrap ${
                  activeFrameIndex === idx
                    ? 'bg-paper-surface text-ink-primary border border-rule-active'
                    : 'text-ink-muted hover:text-ink-primary'
                }`}
              >
                t_{idx}
              </button>
            ))}
          </div>
          <span className="text-[10px] font-mono text-ink-muted pl-1 whitespace-nowrap">
            {environment.toUpperCase()}
          </span>
        </div>
      </div>

      {/* MAIN 16:9 VIEWPORT (ZERO FLOATING TEXT BANNERS INSIDE) */}
      <div
        ref={containerRef}
        onMouseMove={handleMouseMove}
        className="flex-1 w-full bg-paper-well flex items-center justify-center p-3 overflow-hidden relative"
      >
        <div className="relative w-full max-w-5xl aspect-video bg-black rounded border border-rule-border overflow-hidden">
          <img
            src={currentImageUrl}
            alt="Optical Frame"
            className="w-full h-full object-contain block select-none pointer-events-none"
          />

          {passView === 'split' && (
            <>
              <div
                className="absolute inset-0 overflow-hidden pointer-events-none"
                style={{ clipPath: `inset(0 ${100 - splitPos}% 0 0)` }}
              >
                <img
                  src={repairedUrl || t0Url}
                  alt="Repaired Frame"
                  className="w-full h-full object-contain block select-none"
                />
              </div>
              <div
                className="absolute top-0 bottom-0 w-0.5 bg-ink-primary cursor-ew-resize z-30"
                style={{ left: `${splitPos}%` }}
              >
                <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-5 h-5 rounded bg-paper-surface border border-rule-border text-ink-primary flex items-center justify-center text-[9px] font-mono">
                  ↔
                </div>
              </div>
            </>
          )}

          {/* SVG Overlays Only */}
          <svg
            aria-hidden="true"
            viewBox="0 0 1280 720"
            className="absolute inset-0 w-full h-full pointer-events-none z-10"
          >
            {showMask && activeMask && (
              <g transform={`translate(${activeMask.bounds.left}, ${activeMask.bounds.top})`}>
                <path
                  d={activeMask.svgPath}
                  fill={isVerifiedPass ? 'rgba(48, 209, 88, 0.40)' : 'rgba(255, 69, 58, 0.45)'}
                  stroke={isVerifiedPass ? '#30D158' : '#FF453A'}
                  strokeWidth="2"
                  strokeLinejoin="round"
                />
              </g>
            )}

            {showBBox && (
              <g>
                <rect
                  x={bboxX}
                  y={bboxY}
                  width={bboxW}
                  height={bboxH}
                  fill="none"
                  stroke="#38BDF8"
                  strokeWidth="2"
                  strokeDasharray="4 2"
                />
                <circle cx={bboxX} cy={bboxY} r="3" fill="#38BDF8" />
                <circle cx={bboxX + bboxW} cy={bboxY} r="3" fill="#38BDF8" />
                <circle cx={bboxX} cy={bboxY + bboxH} r="3" fill="#38BDF8" />
                <circle cx={bboxX + bboxW} cy={bboxY + bboxH} r="3" fill="#38BDF8" />
              </g>
            )}

            {showCrosshair && (
              <g>
                <line
                  x1={hitX - 12}
                  y1={hitY}
                  x2={hitX + 12}
                  y2={hitY}
                  stroke="#F59E0B"
                  strokeWidth="1.5"
                />
                <line
                  x1={hitX}
                  y1={hitY - 12}
                  x2={hitX}
                  y2={hitY + 12}
                  stroke="#F59E0B"
                  strokeWidth="1.5"
                />
                <circle cx={hitX} cy={hitY} r="4" fill="none" stroke="#F59E0B" strokeWidth="1.5" />
                <circle cx={hitX} cy={hitY} r="1.5" fill="#FFFFFF" />
              </g>
            )}
          </svg>
        </div>
      </div>

      {/* 3-COLUMN MAGNIFIED TARGET STRIP */}
      <div className="px-4 py-2.5 bg-paper-base border-t border-rule-border shrink-0">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Maximize2 className="w-3.5 h-3.5 text-signal-cool" />
            <span className="text-[11px] font-mono text-ink-primary font-medium">
              3-State Target Zoom Loupe
            </span>
            <span className="text-[10px] font-mono text-ink-muted">
              BBox [{bboxX}, {bboxY}, {bboxW}, {bboxH}] · Center Hit ({hitX}, {hitY})
            </span>
          </div>
          <span className="text-[10px] font-mono text-ink-muted">
            Sub-pixel 10% bottom-edge clipping isolated
          </span>
        </div>

        <div className="grid grid-cols-3 gap-3">
          {/* Column 1: Baseline t0 */}
          <div className="p-2 rounded bg-paper-well border border-rule-border space-y-1">
            <div className="flex items-center justify-between text-[10px] font-mono">
              <span className="text-ink-muted">1. Baseline (t_0)</span>
              <span className="text-signal-emerald">100.0% Visible</span>
            </div>
            <div className="w-full h-20 bg-black rounded border border-rule-border overflow-hidden flex items-center justify-center">
              <svg
                aria-hidden="true"
                viewBox={`${bboxX - 15} ${bboxY - 8} ${bboxW + 30} ${bboxH + 16}`}
                className="w-full h-full object-contain"
              >
                <image href={t0Url} width="1280" height="720" />
                <rect
                  x={bboxX}
                  y={bboxY}
                  width={bboxW}
                  height={bboxH}
                  fill="none"
                  stroke="#38BDF8"
                  strokeWidth="1.5"
                  strokeDasharray="3 2"
                />
              </svg>
            </div>
            <div className="text-[9px] font-mono text-ink-muted text-center">
              Unobstructed 17,000 px contract
            </div>
          </div>

          {/* Column 2: Pass #1 Broken */}
          <div className="p-2 rounded bg-paper-well border border-rule-border space-y-1">
            <div className="flex items-center justify-between text-[10px] font-mono">
              <span className="text-ink-muted">2. Pass #1 (Broken)</span>
              <span className="text-signal-vermilion">90.0% Visible (1,700 px lost)</span>
            </div>
            <div className="w-full h-20 bg-black rounded border border-rule-border overflow-hidden flex items-center justify-center">
              <svg
                aria-hidden="true"
                viewBox={`${bboxX - 15} ${bboxY - 8} ${bboxW + 30} ${bboxH + 16}`}
                className="w-full h-full object-contain"
              >
                <image href={tkUrl} width="1280" height="720" />
                {masks && masks.length > 0 && masks[masks.length - 1]?.svgPath && (
                  <g
                    transform={`translate(${masks[masks.length - 1].bounds.left}, ${masks[masks.length - 1].bounds.top})`}
                  >
                    <path
                      d={masks[masks.length - 1].svgPath}
                      fill="rgba(255, 69, 58, 0.40)"
                      stroke="#FF453A"
                      strokeWidth="1.5"
                    />
                  </g>
                )}
                <rect
                  x={bboxX}
                  y={bboxY}
                  width={bboxW}
                  height={bboxH}
                  fill="none"
                  stroke="#38BDF8"
                  strokeWidth="1.5"
                  strokeDasharray="3 2"
                />
                <circle cx={hitX} cy={hitY} r="3" fill="#F59E0B" />
              </svg>
            </div>
            <div className="text-[9px] font-mono text-signal-vermilion text-center">
              10% bottom-edge occluded by drawer
            </div>
          </div>

          {/* Column 3: Pass #2 Repaired */}
          <div className="p-2 rounded bg-paper-well border border-rule-border space-y-1">
            <div className="flex items-center justify-between text-[10px] font-mono">
              <span className="text-ink-muted">3. Pass #2 (Repaired)</span>
              <span className="text-signal-emerald">100.0% Visible (0 px lost)</span>
            </div>
            <div className="w-full h-20 bg-black rounded border border-rule-border overflow-hidden flex items-center justify-center">
              <svg
                aria-hidden="true"
                viewBox={`${bboxX - 15} ${bboxY - 8} ${bboxW + 30} ${bboxH + 16}`}
                className="w-full h-full object-contain"
              >
                <image href={repairedUrl || t0Url} width="1280" height="720" />
                {masks && masks.length > 0 && masks[0]?.svgPath && (
                  <g transform={`translate(${masks[0].bounds.left}, ${masks[0].bounds.top})`}>
                    <path
                      d={masks[0].svgPath}
                      fill="rgba(48, 209, 88, 0.35)"
                      stroke="#30D158"
                      strokeWidth="1.5"
                    />
                  </g>
                )}
                <rect
                  x={bboxX}
                  y={bboxY}
                  width={bboxW}
                  height={bboxH}
                  fill="none"
                  stroke="#30D158"
                  strokeWidth="1.5"
                  strokeDasharray="3 2"
                />
              </svg>
            </div>
            <div className="text-[9px] font-mono text-signal-emerald text-center">
              Patched z-index & margin verified
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
