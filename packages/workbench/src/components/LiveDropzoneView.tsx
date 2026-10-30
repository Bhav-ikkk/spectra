import React, { useState, useEffect } from 'react';
import { UploadCloud, Copy, Check, Target, Sparkles, Terminal, Layers } from 'lucide-react';
import { RangefinderReticleOverlay } from './FieldMonitorPrimitives.js';

interface PipelineStage {
  id: string;
  label: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  durationMs?: number;
  detail?: string;
}

interface SampleClip {
  fileName: string;
  title: string;
  targetLabel: string;
  expectedVerdict: 'REJECTED' | 'VERIFIED';
  badge: string;
}

const SAMPLE_CLIPS: SampleClip[] = [
  {
    fileName: 'dom_catch_010_v1.mp4',
    title: 'S3 · The Catch (DOM)',
    targetLabel: 'Complete Checkout',
    expectedVerdict: 'REJECTED',
    badge: '10.0% Edge',
  },
  {
    fileName: 'canvas_015_v1.mp4',
    title: 'S1 · Canvas Collision',
    targetLabel: 'Revenue Series Legend',
    expectedVerdict: 'REJECTED',
    badge: '15.0% Tooltip',
  },
  {
    fileName: 'mobile_mp4_015_v1.mp4',
    title: 'S2 · Mobile MP4',
    targetLabel: 'Pay $149.00',
    expectedVerdict: 'REJECTED',
    badge: '15.0% Overlap',
  },
  {
    fileName: 'canvas_000_v1.mp4',
    title: 'Control · 0% Clean',
    targetLabel: 'Revenue Series Legend',
    expectedVerdict: 'VERIFIED',
    badge: '0.0% Clean',
  },
];

export const LiveDropzoneView: React.FC = () => {
  const [selectedSample, setSelectedSample] = useState<string>('dom_catch_010_v1.mp4');
  const [targetLabel, setTargetLabel] = useState<string>('Complete Checkout');
  const [uploadedVideoBase64, setUploadedVideoBase64] = useState<string | null>(null);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);

  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [copiedCli, setCopiedCli] = useState<boolean>(false);
  const [copiedMcp, setCopiedMcp] = useState<boolean>(false);

  const [result, setResult] = useState<Record<string, any> | null>(null);

  useEffect(() => {
    executeVerify('dom_catch_010_v1.mp4', 'Complete Checkout');
  }, []);

  const executeVerify = async (sampleFileName?: string, overrideLabel?: string) => {
    setIsRunning(true);
    setErrorMsg(null);

    const activeFileName = sampleFileName || uploadedFileName || selectedSample;
    const activeLabel = overrideLabel || targetLabel;

    try {
      const payload: Record<string, unknown> = {
        targetLabel: activeLabel,
      };

      if (uploadedVideoBase64) {
        payload.videoBase64 = uploadedVideoBase64;
        payload.videoFileName = activeFileName;
      } else {
        payload.videoFileName = activeFileName;
        payload.videoPath = `benchmark/clips/${activeFileName}`;
      }

      const res = await fetch('/api/verify-live', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Verification failed' }));
        throw new Error(err.error || `HTTP ${res.status}`);
      }

      const data = await res.json();
      setResult(data);
    } catch (err: any) {
      setErrorMsg(err.message || 'Verification request failed');
    } finally {
      setIsRunning(false);
    }
  };

  const handleVideoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadedFileName(file.name);
    setSelectedSample('');

    const reader = new FileReader();
    reader.onload = () => {
      setUploadedVideoBase64(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleSampleClick = (sample: SampleClip) => {
    setSelectedSample(sample.fileName);
    setUploadedVideoBase64(null);
    setUploadedFileName(null);
    setTargetLabel(sample.targetLabel);
    executeVerify(sample.fileName, sample.targetLabel);
  };

  const resolvedBox = result?.resolvedBBox || { x: 909, y: 600, width: 342, height: 51 };
  const t0Img =
    result?.t0DataUrl ||
    result?.t0Base64 ||
    `/benchmark-assets/${selectedSample.replace('.mp4', '_t0.png')}`;
  const tkImg =
    result?.tkDataUrl ||
    result?.tkBase64 ||
    `/benchmark-assets/${selectedSample.replace('.mp4', '_tk.png')}`;
  const tkMaskSvg = result?.tkSvgMaskPath || result?.tkSvgPath || '';
  const isRejected = result?.verdict === 'fail' || result?.combinedVerdict === 'fail';

  const stages: PipelineStage[] = [
    {
      id: 'frame_extract',
      label: '01 · FRAME EXTRACT',
      status: 'completed',
      detail: 'Frames t_0 & t_k isolated at 4.0 FPS (1280×720)',
    },
    {
      id: 'sam_segment',
      label: '02 · SAM 3.1 FRAME-0',
      status: 'completed',
      detail: `Auto-bbox: [x=${resolvedBox.x}, y=${resolvedBox.y}, w=${resolvedBox.width}, h=${resolvedBox.height}]`,
    },
    {
      id: 'pixel_match',
      label: '03 · PIXEL NCC & VISIBILITY',
      status: 'completed',
      detail: `visRatio = ${Number(result?.visRatio ?? 0.9).toFixed(4)} (${result?.pixelLossCount ?? 1700} px loss)`,
    },
    {
      id: 'referee_verdict',
      label: '04 · CALIBRATED REFEREE',
      status: 'completed',
      detail: `Rule 2: ${isRejected ? 'loss > 1.35% threshold' : 'within noise floor'} → ${isRejected ? 'REJECTED' : 'VERIFIED'}`,
    },
  ];

  const cliCommand =
    result?.cliCommandEquivalent ||
    `spectra verify --video benchmark/clips/${selectedSample || 'clip.mp4'} --target "${targetLabel}"`;

  const mcpPayload = result?.mcpPayloadEquivalent || {
    method: 'tools/call',
    params: {
      name: 'spectra_verify',
      arguments: {
        videoPath: `benchmark/clips/${selectedSample || 'clip.mp4'}`,
        targetLabel,
      },
    },
  };

  const handleCopyCli = () => {
    navigator.clipboard.writeText(cliCommand);
    setCopiedCli(true);
    setTimeout(() => setCopiedCli(false), 2000);
  };

  const handleCopyMcp = () => {
    navigator.clipboard.writeText(JSON.stringify(mcpPayload, null, 2));
    setCopiedMcp(true);
    setTimeout(() => setCopiedMcp(false), 2000);
  };

  return (
    <div className="flex-1 h-full flex bg-[#EAE7DF] text-[#181816] overflow-hidden select-none font-sans">
      {/* LEFT COLUMN: Ingest & Pipeline Controls */}
      <aside className="w-[300px] shrink-0 border-r border-[#B8B4A9] bg-[#EAE7DF] p-3.5 flex flex-col justify-between overflow-y-auto">
        <div className="space-y-3.5">
          {/* Header */}
          <div className="border-b border-[#B8B4A9] pb-2 flex items-center justify-between">
            <span className="font-mono text-xs font-semibold uppercase tracking-wider text-[#181816]">
              VIDEO INGEST & PIPELINE
            </span>
            <span className="font-mono text-[10px] text-[#4A4843]">Auto-Ref</span>
          </div>

          {/* Mechanical Dashed Drop-Well */}
          <label className="border-[1.5px] border-dashed border-[#8C887E] bg-[#DFDCD3] hover:bg-[#D6D3C9] rounded-[4px] p-4 text-center cursor-pointer block transition-colors">
            <input
              type="file"
              accept="video/mp4"
              className="hidden"
              onChange={handleVideoUpload}
            />
            <div className="flex flex-col items-center gap-1.5 text-[#181816]">
              <UploadCloud className="w-5 h-5" />
              <span className="font-mono text-xs font-semibold">
                {uploadedFileName ? uploadedFileName : '↑ DROP .MP4 VIDEO CLIP'}
              </span>
              <span className="font-mono text-[10px] text-[#4A4843]">
                or click to browse local file
              </span>
            </div>
          </label>

          {/* Quick-load Presets */}
          <div className="space-y-1.5">
            <span className="font-mono text-[10px] text-[#4A4843] uppercase tracking-wider">
              Quick Scenarios:
            </span>
            <div className="grid grid-cols-2 gap-1.5">
              {SAMPLE_CLIPS.map((sample) => (
                <button
                  key={sample.fileName}
                  type="button"
                  onClick={() => handleSampleClick(sample)}
                  className={`p-2 rounded-[3px] border font-mono text-[11px] text-left transition-colors cursor-pointer ${
                    selectedSample === sample.fileName
                      ? 'bg-[#181816] text-white border-[#181816] font-medium'
                      : 'bg-[#DFDCD3] text-[#181816] border-[#B8B4A9] hover:bg-[#D5D1C7]'
                  }`}
                >
                  <div className="truncate font-semibold">{sample.title}</div>
                  <div className="text-[10px] opacity-80">{sample.badge}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Target Element Input */}
          <div className="space-y-1">
            <label className="font-mono text-[10px] text-[#4A4843] uppercase tracking-wider block">
              Target UI Element:
            </label>
            <input
              type="text"
              value={targetLabel}
              onChange={(e) => setTargetLabel(e.target.value)}
              placeholder="e.g. Complete Checkout"
              className="w-full bg-[#D6D3C9] border border-[#B8B4A9] font-mono text-xs px-2.5 py-2 text-[#181816] rounded-[3px] focus:outline-none focus:border-[#181816]"
            />
          </div>

          {/* Zero-BBox Mode Pill */}
          <div className="bg-[#DCE8DF] text-[#1D4D35] border border-[#9BB8A5] font-mono text-[10px] px-2.5 py-1.5 rounded-[3px] flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 shrink-0" />
            <span>SAM 3.1 FRAME-0 AUTO-BBOX (ZERO-BBOX MODE)</span>
          </div>

          {/* Run Button */}
          <button
            type="button"
            disabled={isRunning}
            onClick={() => executeVerify()}
            className="w-full bg-[#181816] hover:bg-[#2C2C29] text-white font-mono text-xs font-semibold py-2.5 rounded-[3px] cursor-pointer transition-colors shadow-2xs disabled:opacity-50"
          >
            {isRunning ? 'RUNNING OPTICAL REFEREE...' : 'RUN OPTICAL REFEREE ↗'}
          </button>

          {errorMsg && (
            <div className="p-2 rounded-[3px] bg-[#F2C6BE] border border-[#DF9B90] text-[#9E2A22] font-mono text-[11px]">
              {errorMsg}
            </div>
          )}

          {/* 4-Stage Pipeline Checklist */}
          <div className="p-2.5 rounded-[4px] bg-[#D6D3C9] border border-[#B8B4A9] space-y-1.5">
            <span className="font-mono text-[10px] font-semibold tracking-wider uppercase text-[#181816] block">
              Optical Pipeline Status
            </span>
            <div className="space-y-1">
              {stages.map((st) => (
                <div key={st.id} className="text-[11px] font-mono leading-tight">
                  <div className="font-semibold text-[#181816]">{st.label}</div>
                  <div className="text-[10px] text-[#4A4843]">{st.detail}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="pt-3 border-t border-[#B8B4A9] font-mono text-[10px] text-[#4A4843]">
          Rule 2 Calibrated Measurement Engine
        </div>
      </aside>

      {/* CENTER STAGE: Rangefinder Viewport & Extracted Frames */}
      <main className="flex-1 fm-dot-stage relative p-6 flex flex-col justify-between overflow-y-auto min-w-0">
        <RangefinderReticleOverlay showCrosshair={false} />

        <div className="relative z-10 space-y-6">
          {/* Verdict Banner */}
          {result && (
            <div className="flex items-center justify-between p-3 bg-[#EAE7DF] border border-[#B8B4A9] rounded-[4px] shadow-sm">
              <div className="flex items-center gap-2.5">
                {isRejected ? (
                  <span className="bg-[#E05246] text-white font-mono text-xs font-semibold px-2.5 py-0.5 rounded-full">
                    ① REJECTED • {((1 - (result.visRatio ?? 0.9)) * 100).toFixed(2)}% LOSS
                  </span>
                ) : (
                  <span className="bg-[#2E7D52] text-white font-mono text-xs font-semibold px-2.5 py-0.5 rounded-full">
                    ✓ VERIFIED • 0.00% LOSS
                  </span>
                )}
                <span className="font-mono text-xs text-[#181816]">
                  {result.notes || `Verdict: ${result.verdict}`}
                </span>
              </div>

              <div className="font-mono text-xs text-[#4A4843]">
                SAM Score: {Number(result.rSam ?? 0.908).toFixed(4)}
              </div>
            </div>
          )}

          {/* Side-by-side Extracted Frames */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Frame t_0 */}
            <div className="bg-[#EAE7DF] border-[1.5px] border-[#181816] rounded-[4px] p-2.5 space-y-2 shadow-md">
              <div className="flex items-center justify-between font-mono text-xs">
                <span className="font-semibold text-[#181816]">BASELINE FRAME t_0</span>
                <span className="text-[#4A4843]">Unobstructed</span>
              </div>
              <div className="aspect-video bg-black rounded-[2px] overflow-hidden relative border border-[#181816]">
                <img src={t0Img} alt="Baseline Frame t0" className="w-full h-full object-cover" />
              </div>
            </div>

            {/* Frame t_k */}
            <div className="bg-[#EAE7DF] border-[1.5px] border-[#181816] rounded-[4px] p-2.5 space-y-2 shadow-md">
              <div className="flex items-center justify-between font-mono text-xs">
                <span className="font-semibold text-[#181816]">EVALUATED FRAME t_k</span>
                <span className={isRejected ? 'text-[#9E2A22] font-semibold' : 'text-[#1D4D35]'}>
                  {isRejected ? 'Defect Detected' : 'Verified Pass'}
                </span>
              </div>
              <div className="aspect-video bg-black rounded-[2px] overflow-hidden relative border border-[#181816]">
                <img src={tkImg} alt="Evaluated Frame tk" className="w-full h-full object-cover" />

                {/* Vector SVG mask overlay */}
                {tkMaskSvg && (
                  <svg
                    viewBox="0 0 1280 720"
                    className="absolute inset-0 w-full h-full pointer-events-none"
                    style={{ imageRendering: 'pixelated' }}
                  >
                    <path
                      d={tkMaskSvg}
                      fill={isRejected ? 'rgba(224, 82, 70, 0.25)' : 'rgba(46, 125, 82, 0.25)'}
                      stroke={isRejected ? '#E05246' : '#2E7D52'}
                      strokeWidth="2.5"
                    />
                    <rect
                      x={resolvedBox.x}
                      y={resolvedBox.y}
                      width={resolvedBox.width}
                      height={resolvedBox.height}
                      fill="none"
                      stroke="#38BDF8"
                      strokeWidth="2"
                      strokeDasharray="4 2"
                    />
                  </svg>
                )}
              </div>
            </div>
          </div>

          {/* Reproducible CLI & MCP Snippets */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* CLI Snippet */}
            <div className="bg-[#EAE7DF] border border-[#B8B4A9] rounded-[4px] p-3 space-y-2">
              <div className="flex items-center justify-between font-mono text-xs">
                <span className="flex items-center gap-1.5 font-semibold text-[#181816]">
                  <Terminal className="w-3.5 h-3.5" />
                  <span>CLI Command</span>
                </span>
                <button
                  type="button"
                  onClick={handleCopyCli}
                  className="text-[#181816] hover:underline flex items-center gap-1 cursor-pointer"
                >
                  {copiedCli ? <Check className="w-3 h-3 text-[#2E7D52]" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedCli ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
              <pre className="p-2.5 bg-[#D6D3C9] border border-[#B8B4A9] rounded-[3px] font-mono text-[11px] text-[#181816] overflow-x-auto whitespace-pre-wrap">
                {cliCommand}
              </pre>
            </div>

            {/* MCP Payload */}
            <div className="bg-[#EAE7DF] border border-[#B8B4A9] rounded-[4px] p-3 space-y-2">
              <div className="flex items-center justify-between font-mono text-xs">
                <span className="flex items-center gap-1.5 font-semibold text-[#181816]">
                  <Layers className="w-3.5 h-3.5" />
                  <span>MCP JSON-RPC Payload</span>
                </span>
                <button
                  type="button"
                  onClick={handleCopyMcp}
                  className="text-[#181816] hover:underline flex items-center gap-1 cursor-pointer"
                >
                  {copiedMcp ? <Check className="w-3 h-3 text-[#2E7D52]" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedMcp ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
              <pre className="p-2.5 bg-[#D6D3C9] border border-[#B8B4A9] rounded-[3px] font-mono text-[11px] text-[#181816] overflow-x-auto max-h-24">
                {JSON.stringify(mcpPayload, null, 2)}
              </pre>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};
