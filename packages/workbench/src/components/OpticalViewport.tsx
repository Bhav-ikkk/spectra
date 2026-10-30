import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, SlidersHorizontal, Sparkles } from 'lucide-react';
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
  environment?: string;
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
  environment = 'mobile_mp4',
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

  const [showReticle, setShowReticle] = useState(true);
  const [showLoupe, setShowLoupe] = useState(true);
  const [zoomRatio, setZoomRatio] = useState(0.65);
  const [showMask, setShowMask] = useState(true);
  const [activeFrameIndex, setActiveFrameIndex] = useState(7);
  const [isPlaying, setIsPlaying] = useState(false);
  const [splitPos, setSplitPos] = useState(50);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;
    if (isPlaying) {
      timer = setInterval(() => {
        setActiveFrameIndex((prev) => (prev + 1) % 8);
      }, 300);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isPlaying]);

  const isVerifiedPass = passView === 'pass2' || (verdict === 'pass' && passView !== 'pass1');

  const currentImageUrl =
    passView === 'pass2' && repairedUrl
      ? repairedUrl
      : activeFrameIndex === 0
        ? t0Url
        : tkUrl;

  const bboxX = targetBBox?.[0] ?? 475;
  const bboxY = targetBBox?.[1] ?? 610;
  const bboxW = targetBBox?.[2] ?? 330;
  const bboxH = targetBBox?.[3] ?? 52;

  // Active mask area
  const activeMask =
    masks?.find((m) => m.frameIndex === activeFrameIndex) ||
    masks?.[activeFrameIndex] ||
    masks?.[masks.length - 1];

  const currentAreaPx = isVerifiedPass
    ? 17299
    : activeMask?.area ?? (environment === 'dom_catch' ? 15708 : 14878);

  const lossPct = isVerifiedPass
    ? 0.0
    : environment === 'dom_catch'
      ? 9.6
      : environment === 'canvas'
        ? 15.0
        : 15.0;

  const isMobile = environment === 'mobile_mp4' || targetLabel.toLowerCase().includes('pay');

  const handleSplitMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (passView !== 'split' || !containerRef.current) return;
    if (e.buttons !== 1) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    setSplitPos((x / rect.width) * 100);
  };

  return (
    <div className="flex-1 h-full flex flex-col bg-[#EAE7DF] overflow-hidden select-none font-sans">
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
              onClick={() => setPassView('pass1')}
              className={`font-mono text-[11px] px-2 py-0.5 rounded-[3px] transition-colors cursor-pointer ${
                passView === 'pass1'
                  ? 'bg-[#181816] text-white font-medium'
                  : 'bg-[#DFDCD3] hover:bg-[#D5D1C7] text-[#181816] border border-[#B8B4A9]'
              }`}
            >
              Pass #1: Broken
            </button>
            <button
              type="button"
              onClick={() => setPassView('pass2')}
              className={`font-mono text-[11px] px-2 py-0.5 rounded-[3px] transition-colors cursor-pointer ${
                passView === 'pass2'
                  ? 'bg-[#181816] text-white font-medium'
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
                  ? 'bg-[#181816] text-white font-medium'
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
            className={`border px-1.5 py-0.5 rounded-[3px] font-mono text-[10px] font-bold cursor-pointer transition-colors ${
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
        {/* Full-Bleed Technical Rangefinder Reticles */}
        <RangefinderReticleOverlay showCrosshair={showReticle} />

        {/* Viewport Frame */}
        <div
          ref={containerRef}
          onMouseMove={handleSplitMouseMove}
          className={`relative z-10 select-none shadow-2xl transition-all duration-200 ${
            isMobile
              ? 'w-[280px] sm:w-[310px] aspect-[9/18] rounded-[36px] border-[5px] border-[#181816] bg-black overflow-hidden flex flex-col justify-between'
              : 'max-w-[760px] w-full aspect-video rounded-[6px] border border-[#181816] bg-black overflow-hidden'
          }`}
        >
          {/* Display Base Image */}
          <img
            src={currentImageUrl}
            alt="Evaluation Frame"
            className="w-full h-full object-cover pointer-events-none select-none"
          />

          {/* Split-View Slider */}
          {passView === 'split' && repairedUrl && (
            <div
              className="absolute inset-0 overflow-hidden pointer-events-none"
              style={{ clipPath: `polygon(0 0, ${splitPos}% 0, ${splitPos}% 100%, 0 100%)` }}
            >
              <img
                src={repairedUrl}
                alt="Repaired Split Frame"
                className="w-full h-full object-cover"
              />
              <div
                className="absolute top-0 bottom-0 w-[2px] bg-white shadow-lg pointer-events-none"
                style={{ left: `${splitPos}%` }}
              />
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

          {/* BROKEN PASS OCCLUSION STRIP & CALLOUT (Matches image_41bab6.jpg) */}
          {!isVerifiedPass && (
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
                {isMobile
                  ? `15% of the "${targetLabel}"`
                  : environment === 'dom_catch'
                    ? 'THE CATCH: Naive DOM center-point (at true) yet Spectra catches 10.0% visual edge occlusion'
                    : `15.0% collision on "${targetLabel}"`}
              </div>

              {/* 45-Degree Red Diagonal Occlusion Hatch Strip */}
              <div
                className="w-full h-8 fm-red-hatch rounded-[2px] shadow-sm relative flex items-center justify-center"
              >
                <span className="font-sans font-bold text-xs text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]">
                  {targetLabel}
                </span>
              </div>

              {/* Red Pill Below */}
              <div className="mt-2">
                <span className="bg-[#E05246] text-white font-mono text-[11px] font-semibold px-3 py-1 rounded-full shadow-md whitespace-nowrap">
                  {lossPct.toFixed(1)}% Overlap / Occluded
                </span>
              </div>
            </div>
          )}
        </div>

        {/* 3-STATE TARGET ZOOM LOUPE (Floating Hardware Window from image_41bab6.jpg) */}
        {showLoupe && (
          <div className="absolute right-4 bottom-4 sm:right-8 sm:bottom-6 z-30">
            <SubPixelMatrixLoupe
              targetLabel={targetLabel}
              lossPercent={lossPct}
              isRepaired={isVerifiedPass}
              onClose={() => setShowLoupe(false)}
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
                  setActiveFrameIndex(idx);
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
