import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, SlidersHorizontal } from 'lucide-react';
import type { DecodedMaskFrame } from '../types.js';
import {
  HardwareToggle,
  HardwareMiniSlider,
  RangefinderReticleOverlay,
  SubPixelMatrixLoupe,
  MiniDescendingSparkline,
} from './FieldMonitorPrimitives.js';

export interface OpticalViewportProps {
  t0Url: string;
  tkUrl: string;
  repairedUrl?: string;
  videoUrl?: string;
  masks?: DecodedMaskFrame[];
  targetBBox?: [number, number, number, number];
  targetLabel: string;
  verdict: 'pass' | 'fail' | 'inconclusive';
  scenarioPhase?: 1 | 2 | 3 | 4;
  scenarioId?: 's1' | 's2' | 's3';
  environment?: string;
  activeFrameIndex?: number;
  onFrameChange?: (index: number) => void;
  onTogglePass?: (pass: 'pass1' | 'pass2') => void;
}

export const OpticalViewport: React.FC<OpticalViewportProps> = ({
  t0Url,
  tkUrl,
  repairedUrl,
  masks,
  targetBBox,
  targetLabel,
  verdict,
  scenarioPhase = 2,
  scenarioId = 's2',
  environment = 'mobile_mp4',
  activeFrameIndex: propFrameIndex,
  onFrameChange,
  onTogglePass,
}) => {
  const [internalFrameIndex, setInternalFrameIndex] = useState(7);
  const activeFrameIndex = propFrameIndex !== undefined ? propFrameIndex : internalFrameIndex;

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

  const [showReticle, setShowReticle] = useState(true);
  const [showLoupe, setShowLoupe] = useState(true);
  const [zoomRatio, setZoomRatio] = useState(0.65);
  const [showMask, setShowMask] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [splitPos, setSplitPos] = useState(50);
  const [isDraggingSplit, setIsDraggingSplit] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-play timeline loop
  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;
    if (isPlaying) {
      timer = setInterval(() => {
        const next = (activeFrameIndex + 1) % 8;
        if (onFrameChange) onFrameChange(next);
        else setInternalFrameIndex(next);
      }, 300);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isPlaying, activeFrameIndex, onFrameChange]);

  const isVerifiedPass = passView === 'pass2' || (verdict === 'pass' && passView !== 'pass1');

  // Master per-scenario sequences for live frame scrub interpolation
  const scenarioSequences = {
    s2: {
      areas: [17536, 17480, 17350, 16900, 16300, 15600, 15050, 14878],
      t0Area: 17536,
      lossPct: 15.18,
      bbox: [475, 610, 330, 52] as [number, number, number, number],
      rSam: 0.8464,
      visRatio: 0.85,
    },
    s3: {
      areas: [17299, 17258, 17273, 16665, 16130, 15756, 15759, 15708],
      t0Area: 17299,
      lossPct: 9.6,
      bbox: [910, 600, 340, 50] as [number, number, number, number],
      rSam: 0.908,
      visRatio: 0.9,
    },
    s1: {
      areas: [10560, 10510, 10420, 10180, 9820, 9510, 9240, 9134],
      t0Area: 10560,
      lossPct: 14.25,
      bbox: [820, 240, 220, 48] as [number, number, number, number],
      rSam: 0.852,
      visRatio: 0.85,
    },
  };

  const seq = scenarioSequences[scenarioId as 's1' | 's2' | 's3'] || scenarioSequences.s2;
  const currentAreaPx = isVerifiedPass
    ? seq.t0Area
    : seq.areas[Math.min(7, Math.max(0, activeFrameIndex))];

  const currentImageUrl =
    passView === 'pass2' && repairedUrl
      ? repairedUrl
      : activeFrameIndex === 0
        ? t0Url
        : tkUrl;

  const resolvedBBox = targetBBox ?? seq.bbox;
  const [bboxX, bboxY, bboxW, bboxH] = resolvedBBox;

  // Active SAM mask if provided
  const activeMask =
    masks?.find((m) => m.frameIndex === activeFrameIndex) ||
    masks?.[activeFrameIndex] ||
    masks?.[masks.length - 1];

  const isMobile = scenarioId === 's2' || environment === 'mobile_mp4' || targetLabel.toLowerCase().includes('pay');

  // Split view dragging
  const updateSplitFromEvent = (clientX: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
    setSplitPos(Math.round((x / rect.width) * 100));
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (passView !== 'split') return;
    setIsDraggingSplit(true);
    updateSplitFromEvent(e.clientX);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isDraggingSplit && passView === 'split') {
      updateSplitFromEvent(e.clientX);
    }
  };

  const handlePointerUp = () => {
    if (isDraggingSplit) setIsDraggingSplit(false);
  };

  return (
    <div
      className="flex-1 h-full flex flex-col bg-[#EAE7DF] overflow-hidden select-none font-sans"
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      {/* 1. TOP SUB-HEADER (36px, Flush Hairline) */}
      <div className="h-9 px-4 bg-[#EAE7DF] border-b border-[#B8B4A9] flex items-center justify-between shrink-0 whitespace-nowrap z-20">
        {/* Left: Viewport Title + Pass Switcher Keycaps */}
        <div className="flex items-center gap-3">
          <span className="font-mono text-xs font-semibold text-[#181816]">
            Optical Viewport [1280x720]
          </span>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => {
                setPassView('pass1');
                onTogglePass?.('pass1');
              }}
              className={`font-mono text-[11px] px-2 py-0.5 rounded-[3px] transition-colors cursor-pointer ${
                passView === 'pass1'
                  ? 'bg-[#181816] text-white font-medium shadow-2xs'
                  : 'bg-[#DFDCD3] hover:bg-[#D5D1C7] text-[#181816] border border-[#B8B4A9]'
              }`}
            >
              Pass #1: Broken
            </button>
            <button
              type="button"
              onClick={() => {
                setPassView('pass2');
                onTogglePass?.('pass2');
              }}
              className={`font-mono text-[11px] px-2 py-0.5 rounded-[3px] transition-colors cursor-pointer ${
                passView === 'pass2'
                  ? 'bg-[#181816] text-white font-medium shadow-2xs'
                  : 'bg-[#DFDCD3] hover:bg-[#D5D1C7] text-[#181816] border border-[#B8B4A9]'
              }`}
            >
              Pass #2: Repaired
            </button>
            <button
              type="button"
              onClick={() => setPassView('split')}
              className={`font-mono text-[11px] px-2 py-0.5 rounded-[3px] transition-colors flex items-center gap-1 cursor-pointer ${
                passView === 'split'
                  ? 'bg-[#181816] text-white font-medium shadow-2xs'
                  : 'bg-[#DFDCD3] hover:bg-[#D5D1C7] text-[#181816] border border-[#B8B4A9]'
              }`}
            >
              <SlidersHorizontal className="w-3 h-3" />
              <span>Split View</span>
            </button>
          </div>
        </div>

        {/* Right: Reticle Controls & Loupe Trigger */}
        <div className="flex items-center gap-3">
          {/* Loupe Toggle Keycap */}
          <button
            type="button"
            onClick={() => setShowLoupe(!showLoupe)}
            title="Toggle 3-State Target Zoom Loupe"
            className={`border px-1.5 py-0.5 rounded-[3px] font-mono text-[10px] font-bold cursor-pointer transition-colors shadow-2xs ${
              showLoupe
                ? 'bg-[#181816] text-white border-[#181816]'
                : 'bg-[#DFDCD3] text-[#181816] border-[#B8B4A9] hover:bg-[#D5D1C7]'
            }`}
          >
            [3x]
          </button>

          {/* Mini Slider */}
          <HardwareMiniSlider value={zoomRatio} onChange={setZoomRatio} />

          {/* Status Dots */}
          <span className="font-mono text-xs text-[#181816] tracking-widest hidden sm:inline" aria-hidden="true">
            • • ◦
          </span>

          {/* Rangefinder Reticle Toggle */}
          <HardwareToggle
            active={showReticle}
            onChange={setShowReticle}
            label="Toggle Rangefinder Reticle"
          />
        </div>
      </div>

      {/* 2. MAIN RANGEFINDER STAGE WITH DOT GRID */}
      <div className="flex-1 min-h-0 relative fm-dot-stage flex items-center justify-center p-4 sm:p-6 overflow-hidden">
        {/* Technical Rangefinder Reticles */}
        <RangefinderReticleOverlay showCrosshair={showReticle} />

        {/* Viewport Frame Container */}
        <div
          ref={containerRef}
          onPointerDown={handlePointerDown}
          className={`relative z-10 select-none shadow-2xl transition-all duration-200 ${
            passView === 'split' ? 'cursor-ew-resize' : ''
          } ${
            isMobile
              ? 'w-[280px] sm:w-[310px] aspect-[9/18] rounded-[36px] border-[5px] border-[#181816] bg-black overflow-hidden flex flex-col justify-between'
              : 'max-w-[760px] w-full aspect-video rounded-[6px] border border-[#181816] bg-black overflow-hidden'
          }`}
        >
          {/* Base Frame Image */}
          <img
            src={currentImageUrl}
            alt="Evaluation Frame"
            className="w-full h-full object-cover pointer-events-none select-none"
            draggable={false}
          />

          {/* Interactive Split-View Comparison Slider */}
          {passView === 'split' && (
            <div
              className="absolute inset-0 overflow-hidden pointer-events-none"
              style={{ clipPath: `polygon(0 0, ${splitPos}% 0, ${splitPos}% 100%, 0 100%)` }}
            >
              <img
                src={repairedUrl || t0Url}
                alt="Repaired Split Frame"
                className="w-full h-full object-cover"
                draggable={false}
              />
              <div
                className="absolute top-0 bottom-0 w-[2.5px] bg-[#FFFFFF] shadow-[0_0_8px_rgba(0,0,0,0.8)] pointer-events-none flex items-center justify-center"
                style={{ left: `calc(${splitPos}% - 1.25px)` }}
              >
                <div className="w-5 h-5 rounded-full bg-[#181816] border border-white text-white font-mono text-[9px] flex items-center justify-center shadow-md">
                  ⇄
                </div>
              </div>
            </div>
          )}

          {/* SAM Mask Vector Overlay */}
          {showMask && activeMask?.svgPath && (
            <svg
              viewBox="0 0 1280 720"
              className="absolute inset-0 w-full h-full pointer-events-none z-10"
              style={{ imageRendering: 'pixelated' }}
            >
              <path
                d={activeMask.svgPath}
                fill={isVerifiedPass ? 'rgba(46, 125, 82, 0.22)' : 'rgba(224, 82, 70, 0.24)'}
                stroke={isVerifiedPass ? '#2E7D52' : '#E05246'}
                strokeWidth="2.5"
                strokeDasharray="4 2"
              />
            </svg>
          )}

          {/* PASS #1 OCCLUSION STRIP & CALLOUT */}
          {!isVerifiedPass ? (
            <div
              className="absolute pointer-events-none z-20 flex flex-col items-center"
              style={
                isMobile
                  ? { bottom: '48px', left: '16px', right: '16px' }
                  : {
                      left: `${(bboxX / 1280) * 100}%`,
                      top: `${((bboxY + bboxH * 0.7) / 720) * 100}%`,
                      width: `${(bboxW / 1280) * 100}%`,
                    }
              }
            >
              {/* Callout Tooltip */}
              <div className="mb-1.5 px-2.5 py-1 rounded-[3px] bg-[#181816] text-white font-mono text-[10px] font-medium shadow-md whitespace-nowrap">
                {scenarioId === 's2'
                  ? `15% of the "${targetLabel}"`
                  : scenarioId === 's3'
                    ? 'THE CATCH: Naive DOM center-point (at true) yet Spectra catches 10.0% visual edge occlusion'
                    : `15.0% collision on "${targetLabel}"`}
              </div>

              {/* 45-Degree Red Diagonal Occlusion Hatch Strip */}
              <div className="w-full h-8 fm-red-hatch rounded-[2px] shadow-sm relative flex items-center justify-center">
                <span className="font-sans font-bold text-xs text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]">
                  {targetLabel}
                </span>
              </div>

              {/* Red Pill Below */}
              <div className="mt-2">
                <span className="bg-[#E05246] text-white font-mono text-[11px] font-semibold px-3 py-1 rounded-full shadow-md whitespace-nowrap">
                  {scenarioId === 's3'
                    ? '9.6% Occluded (1,700 px)'
                    : `${seq.lossPct.toFixed(1)}% Overlap / Occluded`}
                </span>
              </div>
            </div>
          ) : (
            /* PASS #2 VERIFIED UNOBSTRUCTED TARGET CONTOUR */
            <div
              className="absolute pointer-events-none z-20 flex flex-col items-center"
              style={
                isMobile
                  ? { bottom: '48px', left: '16px', right: '16px' }
                  : {
                      left: `${(bboxX / 1280) * 100}%`,
                      top: `${(bboxY / 720) * 100}%`,
                      width: `${(bboxW / 1280) * 100}%`,
                      height: `${(bboxH / 720) * 100}%`,
                    }
              }
            >
              <div className="w-full h-full border-2 border-[#2E7D52] bg-[#2E7D52]/15 rounded-[3px] shadow-sm flex items-center justify-center p-1">
                <span className="bg-[#2E7D52] text-white font-mono text-[10px] font-bold px-2 py-0.5 rounded-[2px] shadow-sm whitespace-nowrap">
                  ✓ SAM 3.1: 100% Unobstructed (0% Loss)
                </span>
              </div>
            </div>
          )}
        </div>

        {/* 3-STATE TARGET ZOOM LOUPE (With Live Pixel Sampling & Interactive Tabs) */}
        {showLoupe && (
          <div className="absolute right-4 bottom-4 sm:right-8 sm:bottom-6 z-30">
            <SubPixelMatrixLoupe
              targetLabel={targetLabel}
              lossPercent={isVerifiedPass ? 0 : seq.lossPct}
              isRepaired={isVerifiedPass}
              onClose={() => setShowLoupe(false)}
              targetBBox={resolvedBBox}
              t0Area={seq.t0Area}
              tkArea={currentAreaPx}
              rSam={isVerifiedPass ? 1.0 : seq.rSam}
              visRatio={isVerifiedPass ? 1.0 : seq.visRatio}
              activeImageSrc={currentImageUrl}
            />
          </div>
        )}
      </div>

      {/* 3. BOTTOM MECHANICAL KEYCAP TIMELINE (46px, Flush Hairline) */}
      <div className="h-[46px] px-3.5 bg-[#EAE7DF] border-t border-[#B8B4A9] flex items-center justify-between gap-2 shrink-0 select-none z-20">
        {/* Play/Pause Keycap + 8 Frame Keycaps */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => setIsPlaying(!isPlaying)}
            title={isPlaying ? 'Pause Timeline' : 'Play Timeline'}
            className="w-7 h-6 rounded-[3px] border border-[#B8B4A9] bg-[#DFDCD3] hover:bg-[#D5D1C7] flex items-center justify-center text-[#181816] cursor-pointer transition-colors shadow-2xs"
          >
            {isPlaying ? (
              <Pause className="w-3 h-3 fill-current" />
            ) : (
              <Play className="w-3 h-3 fill-current ml-0.5" />
            )}
          </button>

          {/* 8 Mechanical Frame Keycaps: t_0(ts), t_1..t_7 */}
          {Array.from({ length: 8 }).map((_, idx) => {
            const isActive = activeFrameIndex === idx;
            const label = idx === 0 ? 't_0(ts)' : idx === 7 ? 't_7(%)' : `t_${idx}`;

            return (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  setIsPlaying(false);
                  if (onFrameChange) onFrameChange(idx);
                  else setInternalFrameIndex(idx);
                }}
                className={`font-mono text-[11px] px-2 py-0.5 rounded-[3px] transition-colors cursor-pointer ${
                  isActive
                    ? 'bg-[#181816] text-white font-semibold border border-[#181816] shadow-2xs'
                    : 'bg-[#DFDCD3] hover:bg-[#D5D1C7] text-[#181816] border border-[#B8B4A9]'
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>

        {/* Right Active Frame Telemetry & Mini Sparkline */}
        <div className="flex items-center gap-2.5 shrink-0 font-mono text-[10px] leading-tight text-[#181816]">
          <div className="flex flex-col text-right">
            <span className="text-[#6E6B64]">Active Frame:</span>
            <span className="font-semibold text-[#181816]">t {activeFrameIndex}</span>
          </div>

          <MiniDescendingSparkline />

          <div className="flex flex-col text-left">
            <span className="text-[#6E6B64]">SAM Mask Area:</span>
            <span className="font-semibold text-[#181816] tabular-nums">
              {currentAreaPx.toLocaleString()} px
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
