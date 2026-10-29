import React, { useState, useRef } from 'react';
import { UploadCloud, CheckCircle2, Film, ArrowRight, Sparkles, FileVideo } from 'lucide-react';
import type { WorkbenchScenarioBundle } from '../types.js';

export interface UploadedClipData {
  videoBase64: string;
  videoFileName: string;
  targetLabel: string;
  fileSize: number;
}

export interface Step1SelectClipProps {
  onSelectScenario: (scenarioId: 's1' | 's2' | 's3') => void;
  onSelectCleanControl: () => void;
  onRunCustomScan: (clipData: UploadedClipData) => void;
  targetLabel: string;
  setTargetLabel: (label: string) => void;
  isScanning?: boolean;
}

export const Step1SelectClip: React.FC<Step1SelectClipProps> = ({
  onSelectScenario,
  onSelectCleanControl,
  onRunCustomScan,
  targetLabel,
  setTargetLabel,
  isScanning = false,
}) => {
  const [uploadedFile, setUploadedFile] = useState<{
    name: string;
    size: number;
    base64: string;
  } | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileProcess = (file: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const b64 = reader.result as string;
      setUploadedFile({
        name: file.name,
        size: file.size,
        base64: b64,
      });
      // Suggest reasonable target label if empty
      if (!targetLabel.trim()) {
        setTargetLabel('Complete Checkout');
      }
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileProcess(e.dataTransfer.files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleScanClick = () => {
    if (uploadedFile) {
      onRunCustomScan({
        videoBase64: uploadedFile.base64,
        videoFileName: uploadedFile.name,
        targetLabel: targetLabel.trim() || 'Complete Checkout',
        fileSize: uploadedFile.size,
      });
    } else {
      // If user hasn't dropped a file, run the primary S3 demonstration
      onSelectScenario('s3');
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto py-10 px-6 select-none animate-fade-in">
      {/* 1. Hero Title */}
      <div className="text-center">
        <h1 className="text-2xl font-semibold text-[#F5F5F7] tracking-tight text-center">
          What UI interaction should Spectra verify?
        </h1>
        <p className="text-sm text-[#86868B] text-center mt-1.5 leading-relaxed">
          Upload any .mp4 screen recording or select a built-in failure scenario below.
        </p>
      </div>

      {/* 2. Primary Video Upload Card */}
      <div className="mt-8 p-6 rounded-2xl bg-[#111318] border border-white/10 shadow-xl space-y-5">
        {/* Drag-and-drop .mp4 area */}
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => fileInputRef.current?.click()}
          className={`relative rounded-xl border border-dashed transition-all duration-200 cursor-pointer p-8 flex flex-col items-center justify-center text-center ${
            isDragOver
              ? 'border-[#0071E3] bg-[#0071E3]/10 scale-[1.005]'
              : uploadedFile
                ? 'border-[#30D158]/50 bg-[#30D158]/5'
                : 'border-white/15 bg-[#171A21]/50 hover:bg-[#171A21] hover:border-white/30'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="video/mp4,.mp4,image/png"
            className="hidden"
            onChange={(e) => {
              if (e.target.files?.[0]) {
                handleFileProcess(e.target.files[0]);
              }
            }}
          />

          {uploadedFile ? (
            <div className="flex flex-col items-center gap-2">
              <div className="w-12 h-12 rounded-full bg-[#30D158]/10 border border-[#30D158]/30 flex items-center justify-center text-[#30D158]">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div className="mt-1">
                <span className="text-sm font-medium text-[#F5F5F7]">{uploadedFile.name}</span>
                <span className="text-xs text-[#86868B] ml-2 font-mono">
                  ({(uploadedFile.size / 1024).toFixed(0)} KB)
                </span>
              </div>
              <p className="text-xs text-[#30D158] font-medium">Ready for SAM 3.1 optical verification</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2.5">
              <div className="w-12 h-12 rounded-full bg-white/[0.04] border border-white/10 flex items-center justify-center text-[#0071E3]">
                <UploadCloud className="w-6 h-6 text-[#0071E3]" />
              </div>
              <div>
                <span className="text-sm font-medium text-[#F5F5F7]">
                  Drop any screen recording (.mp4) here
                </span>
                <span className="text-xs text-[#86868B] block mt-0.5">
                  or click to browse from your computer (8 frames @ 4 FPS recommended)
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Input Row: Target UI Element + Auto-detect label + Primary Button */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center pt-2">
          <div className="md:col-span-6 space-y-1">
            <label className="text-xs font-medium text-[#86868B] flex items-center gap-1.5">
              <span>Target UI Element:</span>
              <span className="text-[10px] text-[#86868B]/80 font-normal">
                (element AI agent must keep visible)
              </span>
            </label>
            <input
              type="text"
              value={targetLabel}
              onChange={(e) => setTargetLabel(e.target.value)}
              placeholder="e.g. Complete Checkout"
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#171A21] border border-white/10 text-sm text-[#F5F5F7] placeholder-[#86868B]/60 focus:outline-none focus:border-[#0071E3] transition-colors font-sans"
            />
          </div>

          <div className="md:col-span-3 text-center md:text-left">
            <div className="text-[11px] text-[#86868B] flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-[#0071E3] shrink-0" />
              <span>Auto-detect coordinates via SAM 3.1 Frame 0</span>
            </div>
          </div>

          <div className="md:col-span-3 flex justify-end">
            <button
              type="button"
              disabled={isScanning}
              onClick={handleScanClick}
              className="w-full md:w-auto px-5 py-2.5 rounded-xl bg-[#0071E3] hover:bg-[#0077ED] text-white font-medium text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-all duration-100 shadow-md cursor-pointer disabled:opacity-50"
            >
              <span>{isScanning ? 'Scanning...' : 'Run Optical Scan →'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* 3. Three Clean Scenario Cards */}
      <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Card 1: S3 Sticky Cart Drawer */}
        <div className="p-5 rounded-2xl bg-[#111318] border border-white/10 flex flex-col justify-between hover:border-white/20 transition-all duration-150">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-[#FF453A]/10 text-[#FF453A] border border-[#FF453A]/20">
                10% Bottom Clip
              </span>
              <span className="text-[10px] font-mono text-[#86868B]">S3 · DOM Catch</span>
            </div>

            <h3 className="text-base font-semibold text-[#F5F5F7] mt-3">
              E-Commerce Checkout Drawer
            </h3>
            <p className="text-xs text-[#86868B] mt-1.5 leading-relaxed">
              Sticky footer clips the bottom 10% of "Complete Checkout" while center pixel (1080, 625) passes DOM hit-tests.
            </p>

            <div className="mt-3.5 rounded-xl overflow-hidden border border-white/10 bg-black aspect-video relative">
              <img
                src="/benchmark-assets/dom_catch_010_v1_tk.png"
                alt="S3 Preview"
                className="w-full h-full object-cover"
                loading="lazy"
              />
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              setTargetLabel('Complete Checkout');
              onSelectScenario('s3');
            }}
            className="mt-4 w-full py-2.5 rounded-xl text-xs font-medium bg-white/[0.06] hover:bg-white/[0.12] text-[#F5F5F7] border border-white/10 active:scale-[0.98] transition-all flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <span>Inspect Scenario →</span>
          </button>
        </div>

        {/* Card 2: S1 HTML5 Canvas Chart */}
        <div className="p-5 rounded-2xl bg-[#111318] border border-white/10 flex flex-col justify-between hover:border-white/20 transition-all duration-150">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
                15% Tooltip Overlap
              </span>
              <span className="text-[10px] font-mono text-[#86868B]">S1 · Canvas</span>
            </div>

            <h3 className="text-base font-semibold text-[#F5F5F7] mt-3">
              Financial Telemetry Canvas
            </h3>
            <p className="text-xs text-[#86868B] mt-1.5 leading-relaxed">
              Floating hover tooltip covers 15% of "Revenue Series Legend" inside a single &lt;canvas&gt; node.
            </p>

            <div className="mt-3.5 rounded-xl overflow-hidden border border-white/10 bg-black aspect-video relative">
              <img
                src="/benchmark-assets/canvas_015_v1_tk.png"
                alt="S1 Preview"
                className="w-full h-full object-cover"
                loading="lazy"
              />
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              setTargetLabel('Revenue Series Legend');
              onSelectScenario('s1');
            }}
            className="mt-4 w-full py-2.5 rounded-xl text-xs font-medium bg-white/[0.06] hover:bg-white/[0.12] text-[#F5F5F7] border border-white/10 active:scale-[0.98] transition-all flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <span>Inspect Scenario →</span>
          </button>
        </div>

        {/* Card 3: S2 Mobile Recording */}
        <div className="p-5 rounded-2xl bg-[#111318] border border-white/10 flex flex-col justify-between hover:border-white/20 transition-all duration-150">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20">
                15% Sheet Overlap
              </span>
              <span className="text-[10px] font-mono text-[#86868B]">S2 · MP4 Video</span>
            </div>

            <h3 className="text-base font-semibold text-[#F5F5F7] mt-3">
              Mobile Checkout MP4
            </h3>
            <p className="text-xs text-[#86868B] mt-1.5 leading-relaxed">
              Promo bottom-sheet slides up over 15% of the "Pay $149.00" CTA button on a raw MP4 recording.
            </p>

            <div className="mt-3.5 rounded-xl overflow-hidden border border-white/10 bg-black aspect-video relative">
              <img
                src="/benchmark-assets/mobile_mp4_015_v1_tk.png"
                alt="S2 Preview"
                className="w-full h-full object-cover"
                loading="lazy"
              />
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              setTargetLabel('Pay $149.00');
              onSelectScenario('s2');
            }}
            className="mt-4 w-full py-2.5 rounded-xl text-xs font-medium bg-white/[0.06] hover:bg-white/[0.12] text-[#F5F5F7] border border-white/10 active:scale-[0.98] transition-all flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <span>Inspect Scenario →</span>
          </button>
        </div>
      </div>

      {/* Clean Control Clip Link */}
      <div className="mt-6 text-center">
        <button
          type="button"
          onClick={onSelectCleanControl}
          className="text-xs text-[#86868B] hover:text-[#30D158] transition-colors cursor-pointer inline-flex items-center gap-1"
        >
          <span>Or run the 0% Clean Control clip (canvas_000_v1.mp4) to see a Verified Pass →</span>
        </button>
      </div>
    </div>
  );
};

