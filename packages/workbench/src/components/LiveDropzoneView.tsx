import React, { useState, useEffect } from 'react';
import {
  UploadCloud,
  Play,
  Copy,
  Check,
  Target,
  Maximize2,
  ChevronDown,
  ChevronRight,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react';

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
  lossText: string;
  badge: string;
}

const SAMPLE_CLIPS: SampleClip[] = [
  {
    fileName: 'dom_catch_010_v1.mp4',
    title: 'The Catch (S3)',
    targetLabel: 'Complete Checkout',
    expectedVerdict: 'REJECTED',
    lossText: '10.0% Edge Clip',
    badge: 'FAIL · 10%',
  },
  {
    fileName: 'canvas_015_v1.mp4',
    title: 'HTML5 Canvas (S1)',
    targetLabel: 'Revenue Series Legend',
    expectedVerdict: 'REJECTED',
    lossText: '15.0% Tooltip Collision',
    badge: 'FAIL · 15%',
  },
  {
    fileName: 'mobile_mp4_015_v1.mp4',
    title: 'Mobile MP4 (S2)',
    targetLabel: 'Pay $149.00',
    expectedVerdict: 'REJECTED',
    lossText: '15.0% Bottom Sheet Overlap',
    badge: 'FAIL · 15%',
  },
  {
    fileName: 'canvas_000_v1.mp4',
    title: 'Control Benchmark',
    targetLabel: 'Revenue Series Legend',
    expectedVerdict: 'VERIFIED',
    lossText: '0.0% Clean Unobstructed',
    badge: 'PASS · 0%',
  },
];

export const LiveDropzoneView: React.FC = () => {
  const [selectedSample, setSelectedSample] = useState<string>('dom_catch_010_v1.mp4');
  const [targetLabel, setTargetLabel] = useState<string>('Complete Checkout');
  const [uploadedVideoBase64, setUploadedVideoBase64] = useState<string | null>(null);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [showManualBBox, setShowManualBBox] = useState<boolean>(false);
  const [manualBBox, setManualBBox] = useState({ x: 909, y: 600, width: 342, height: 51 });
  const [useAutoBBox, setUseAutoBBox] = useState<boolean>(true);

  const [activeFrameView, setActiveFrameView] = useState<'tk' | 't0' | 'split'>('tk');
  const [showMaskOverlay, setShowMaskOverlay] = useState<boolean>(true);
  const [showReticle, setShowReticle] = useState<boolean>(true);

  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [copiedCli, setCopiedCli] = useState<boolean>(false);
  const [copiedMcp, setCopiedMcp] = useState<boolean>(false);

  const [result, setResult] = useState<Record<string, any> | null>(null);

  useEffect(() => {
    executeVerify('dom_catch_010_v1.mp4', 'Complete Checkout', true);
  }, []);

  const executeVerify = async (
    sampleFileName?: string,
    overrideLabel?: string,
    useAuto: boolean = useAutoBBox,
  ) => {
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

      if (!useAuto) {
        payload.targetBBox = manualBBox;
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
    executeVerify(sample.fileName, sample.targetLabel, true);
  };

  const resolvedBox = result?.resolvedBBox || { x: 909, y: 600, width: 342, height: 51 };
  const t0Img = result?.t0Base64 || `/benchmark-assets/${selectedSample.replace('.mp4', '_t0.png')}`;
  const tkImg = result?.tkBase64 || `/benchmark-assets/${selectedSample.replace('.mp4', '_tk.png')}`;
  const tkMaskSvg = result?.tkSvgMaskPath || '';
  const isRejected = result?.verdict === 'fail' || result?.combinedVerdict === 'fail';

  const defaultStages: PipelineStage[] = [
    {
      id: 'frame_extract',
      label: '01 · EXTRACT',
      status: 'completed',
      durationMs: 14,
      detail: 'Frames t_0 & t_k isolated at 4.0 FPS (1280×720)',
    },
    {
      id: 'sam_segment',
      label: '02 · SAM 3.1',
      status: 'completed',
      durationMs: 182,
      detail: `Frame-0 zero-bbox decoded: [${resolvedBox.x}, ${resolvedBox.y}, ${resolvedBox.width}, ${resolvedBox.height}]`,
    },
    {
      id: 'pixel_match',
      label: '03 · PIXEL NCC',
      status: 'completed',
      durationMs: 24,
      detail: `Instrument B: visRatio = ${Number(result?.visRatio ?? 0.9).toFixed(4)} (${result?.pixelLossCount ?? 1700} px lost)`,
    },
    {
      id: 'referee_verdict',
      label: '04 · VERDICT',
      status: 'completed',
      durationMs: 6,
      detail: `Rule 2 calibrated: ${isRejected ? 'loss > 1.35% 3σ threshold' : 'within 3σ noise floor'} → ${isRejected ? 'REJECTED' : 'VERIFIED'}`,
    },
  ];

  const stages: PipelineStage[] = result?.pipelineStages?.length
    ? result.pipelineStages
    : defaultStages;

  const cliCommand =
    result?.cliCommandEquivalent ||
    `spectra verify --video benchmark/clips/${selectedSample || 'clip.mp4'} --target "${targetLabel}"`;
  const mcpPayload = result?.mcpPayloadEquivalent
    ? JSON.stringify(result.mcpPayloadEquivalent, null, 2)
    : JSON.stringify(
        {
          jsonrpc: '2.0',
          id: 1,
          method: 'tools/call',
          params: {
            name: 'spectra_verify',
            arguments: {
              videoPath: `benchmark/clips/${selectedSample || 'clip.mp4'}`,
              targetLabel,
            },
          },
        },
        null,
        2,
      );

  return (
    <div className="flex-1 h-full flex bg-paper-base text-ink-primary overflow-hidden select-none">
      {/* LEFT CONTROL COLUMN (320px Fixed Width) */}
      <aside className="w-80 shrink-0 h-full border-r border-rule-border bg-paper-base flex flex-col justify-between overflow-y-auto min-h-0">
        <div className="divide-y divide-rule-border">
          {/* Section Header */}
          <div className="px-3 py-2.5 bg-paper-surface">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono text-ink-muted">Input Video Clip</span>
              <span className="text-[10px] font-mono text-signal-cool">MP4 / H.264</span>
            </div>
          </div>

          {/* Video Dropzone */}
          <div className="p-3 bg-paper-base">
            <label
              htmlFor="video-file-input"
              className="w-full h-20 rounded border border-dashed border-rule-border hover:border-signal-cool bg-paper-well flex flex-col items-center justify-center cursor-pointer transition-colors px-2 text-center"
            >
              <input
                id="video-file-input"
                type="file"
                accept="video/mp4,video/*,image/png"
                onChange={handleVideoUpload}
                className="hidden"
              />
              <UploadCloud className="w-4 h-4 text-ink-muted mb-1" />
              <div className="text-[11px] text-ink-primary font-medium">
                {uploadedFileName ? uploadedFileName : 'Drop .mp4 video clip here'}
              </div>
              <div className="text-[10px] text-ink-muted font-mono mt-0.5">
                {uploadedFileName ? 'Ready to verify' : 'or click to browse files'}
              </div>
            </label>
          </div>

          {/* 4 Instant Benchmark Sample Clips */}
          <div className="p-3 bg-paper-base space-y-2">
            <div className="text-[10px] font-mono text-ink-muted">Instant Benchmark Clips</div>
            <div className="space-y-1">
              {SAMPLE_CLIPS.map((sample) => {
                const isSelected = selectedSample === sample.fileName && !uploadedFileName;
                return (
                  <button
                    key={sample.fileName}
                    onClick={() => handleSampleClick(sample)}
                    className={`w-full text-left px-2.5 py-1.5 rounded text-xs transition-colors border flex items-center justify-between ${
                      isSelected
                        ? 'bg-paper-surface border-rule-active text-ink-primary'
                        : 'bg-paper-well border-rule-border text-ink-muted hover:text-ink-primary hover:border-rule-active'
                    }`}
                  >
                    <div className="truncate pr-2">
                      <div className="font-medium text-[11px] text-ink-primary truncate">
                        {sample.title}
                      </div>
                      <div className="text-[10px] text-ink-muted truncate font-mono">
                        "{sample.targetLabel}"
                      </div>
                    </div>
                    <span
                      className={`text-[9px] font-mono px-1 py-0.5 rounded border shrink-0 ${
                        sample.expectedVerdict === 'REJECTED'
                          ? 'bg-signal-vermilion/10 text-signal-vermilion border-signal-vermilion/30'
                          : 'bg-signal-emerald/10 text-signal-emerald border-signal-emerald/30'
                      }`}
                    >
                      {sample.badge}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Target Element Input */}
          <div className="p-3 bg-paper-base space-y-2">
            <div className="flex items-center justify-between">
              <label htmlFor="target-element-input" className="text-[10px] font-mono text-ink-muted">
                Target Invariant Element
              </label>
              <Target className="w-3 h-3 text-signal-cool" />
            </div>
            <input
              id="target-element-input"
              type="text"
              value={targetLabel}
              onChange={(e) => setTargetLabel(e.target.value)}
              placeholder="e.g. Complete Checkout"
              className="w-full bg-paper-well border border-rule-border focus:border-rule-active rounded px-2.5 py-1.5 text-xs text-ink-primary font-mono outline-none"
            />

            {/* Zero-BBox Auto-Detect Mode Badge */}
            <div className="pt-1">
              <div className="flex items-center justify-between p-2 rounded bg-paper-well border border-rule-border">
                <div className="flex flex-col">
                  <span className="text-[10px] font-medium text-ink-primary">
                    SAM 3.1 Frame-0 Auto-Detect
                  </span>
                  <span className="text-[9px] font-mono text-signal-emerald">Zero-BBox Mode Active</span>
                </div>
                <button
                  onClick={() => setShowManualBBox(!showManualBBox)}
                  className="text-[10px] font-mono text-ink-muted hover:text-ink-primary flex items-center gap-0.5"
                >
                  <span>Manual</span>
                  {showManualBBox ? (
                    <ChevronDown className="w-3 h-3" />
                  ) : (
                    <ChevronRight className="w-3 h-3" />
                  )}
                </button>
              </div>

              {/* Collapsed Manual Coordinates */}
              {showManualBBox && (
                <div className="mt-2 p-2 rounded bg-paper-surface border border-rule-border space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-ink-muted font-mono">Explicit BBox (px)</span>
                    <label className="flex items-center gap-1 text-[10px] text-ink-muted cursor-pointer">
                      <input
                        type="checkbox"
                        checked={!useAutoBBox}
                        onChange={(e) => setUseAutoBBox(!e.target.checked)}
                        className="rounded bg-paper-well border-rule-border"
                      />
                      <span>Override</span>
                    </label>
                  </div>
                  <div className="grid grid-cols-4 gap-1">
                    {(['x', 'y', 'width', 'height'] as const).map((axis) => (
                      <div key={axis}>
                        <span className="text-[9px] font-mono text-ink-muted block">
                          {axis[0]}
                        </span>
                        <input
                          type="number"
                          value={manualBBox[axis]}
                          onChange={(e) =>
                            setManualBBox({ ...manualBBox, [axis]: Number(e.target.value) })
                          }
                          disabled={useAutoBBox}
                          className="w-full bg-paper-well border border-rule-border rounded px-1.5 py-0.5 text-[10px] text-ink-primary font-mono disabled:opacity-40"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Primary Action Button */}
          <div className="p-3 bg-paper-base">
            <button
              onClick={() => executeVerify()}
              disabled={isRunning}
              className="w-full h-9 rounded bg-ink-primary hover:bg-white text-paper-base font-medium text-xs flex items-center justify-center gap-1.5 shadow-none transition-colors disabled:opacity-50 whitespace-nowrap"
            >
              {isRunning ? (
                <>
                  <span className="w-3 h-3 border-2 border-paper-base border-t-transparent rounded-full animate-spin" />
                  <span className="whitespace-nowrap">Arbitrating…</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span className="whitespace-nowrap">Run Referee</span>
                </>
              )}
            </button>
            {errorMsg && (
              <div className="mt-2 p-2 rounded bg-signal-vermilion/10 border border-signal-vermilion/30 text-signal-vermilion text-[10px] font-mono">
                {errorMsg}
              </div>
            )}
          </div>

          {/* 4-Stage Live Pipeline Trace */}
          <div className="p-3 bg-paper-base space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono text-ink-muted">Pipeline Latency Trace</span>
              <span className="text-[10px] font-mono text-signal-emerald">
                {stages.reduce((acc, s) => acc + (s.durationMs || 0), 0)} ms
              </span>
            </div>
            <div className="divide-y divide-rule-border border border-rule-border rounded bg-paper-well">
              {stages.map((stage, idx) => (
                <div key={stage.id || idx} className="p-2 space-y-0.5">
                  <div className="flex items-center justify-between text-[11px] font-mono">
                    <span className="text-ink-primary font-medium">
                      {stage.label || `0${idx + 1} · ${stage.id.toUpperCase()}`}
                    </span>
                    <span className="text-ink-muted text-[10px]">{stage.durationMs ?? 0} ms</span>
                  </div>
                  {stage.detail && (
                    <div className="text-[10px] font-mono text-ink-muted truncate">
                      {stage.detail}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer Calibration Note */}
        <div className="p-3 border-t border-rule-border bg-paper-well text-[10px] text-ink-muted font-mono">
          Spectra v3.0 · Calibrated 3σ: 1.35%
        </div>
      </aside>

      {/* CENTER / RIGHT INSPECTION AREA */}
      <main className="flex-1 h-full flex flex-col bg-paper-well overflow-y-auto min-h-0 divide-y divide-rule-border">
        {/* Top Viewport Toolbar */}
        <div className="h-10 px-4 bg-paper-base border-b border-rule-border flex items-center justify-between shrink-0 whitespace-nowrap">
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-[10px] font-mono text-ink-muted">Inspect Stage:</span>
            <div className="flex items-center bg-paper-well rounded border border-rule-border p-0.5">
              <button
                onClick={() => setActiveFrameView('tk')}
                className={`px-2 py-0.5 text-xs rounded transition-colors whitespace-nowrap ${
                  activeFrameView === 'tk'
                    ? 'bg-paper-surface text-ink-primary border border-rule-active font-medium'
                    : 'text-ink-muted hover:text-ink-primary'
                }`}
              >
                Settled (t_k)
              </button>
              <button
                onClick={() => setActiveFrameView('t0')}
                className={`px-2 py-0.5 text-xs rounded transition-colors whitespace-nowrap ${
                  activeFrameView === 't0'
                    ? 'bg-paper-surface text-ink-primary border border-rule-active font-medium'
                    : 'text-ink-muted hover:text-ink-primary'
                }`}
              >
                Baseline (t_0)
              </button>
              <button
                onClick={() => setActiveFrameView('split')}
                className={`px-2 py-0.5 text-xs rounded transition-colors whitespace-nowrap ${
                  activeFrameView === 'split'
                    ? 'bg-paper-surface text-ink-primary border border-rule-active font-medium'
                    : 'text-ink-muted hover:text-ink-primary'
                }`}
              >
                Split View
              </button>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <label className="flex items-center gap-1.5 text-xs text-ink-muted cursor-pointer whitespace-nowrap">
              <input
                type="checkbox"
                checked={showMaskOverlay}
                onChange={(e) => setShowMaskOverlay(e.target.checked)}
                className="rounded bg-paper-well border-rule-border"
              />
              <span>SAM 3.1 Mask</span>
            </label>

            <label className="flex items-center gap-1.5 text-xs text-ink-muted cursor-pointer whitespace-nowrap">
              <input
                type="checkbox"
                checked={showReticle}
                onChange={(e) => setShowReticle(e.target.checked)}
                className="rounded bg-paper-well border-rule-border"
              />
              <span>Target Reticle</span>
            </label>

            <span className="text-[11px] font-mono text-ink-muted border-l border-rule-border pl-3 whitespace-nowrap">
              1280 × 720 @ 4 FPS
            </span>
          </div>
        </div>

        {/* Viewport Canvas (16:9 Aspect Ratio) */}
        <div className="p-4 flex items-center justify-center bg-paper-well">
          <div className="w-full max-w-4xl relative aspect-video bg-black rounded border border-rule-border overflow-hidden">
            {activeFrameView === 'split' ? (
              <div className="w-full h-full grid grid-cols-2 divide-x divide-rule-border">
                {/* Baseline t0 */}
                <div className="relative w-full h-full">
                  <img src={t0Img} alt="t0 frame" className="w-full h-full object-contain" />
                  <div className="absolute top-2 left-2 px-1.5 py-0.5 bg-paper-base/90 border border-rule-border text-[10px] font-mono text-ink-primary rounded">
                    t_0 (Baseline)
                  </div>
                </div>
                {/* Evaluated tk with overlays */}
                <div className="relative w-full h-full">
                  <img src={tkImg} alt="tk frame" className="w-full h-full object-contain" />
                  <div className="absolute top-2 left-2 px-1.5 py-0.5 bg-paper-base/90 border border-rule-border text-[10px] font-mono text-ink-primary rounded">
                    t_k (Settled)
                  </div>
                  {/* SVG Overlays */}
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 1280 720"
                    className="absolute inset-0 w-full h-full pointer-events-none"
                  >
                    {showMaskOverlay && tkMaskSvg && (
                      <path
                        d={tkMaskSvg}
                        fill="rgba(255, 69, 58, 0.35)"
                        stroke="#FF453A"
                        strokeWidth="1.5"
                      />
                    )}
                    {showReticle && (
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
                    )}
                  </svg>
                </div>
              </div>
            ) : (
              <div className="relative w-full h-full">
                <img
                  src={activeFrameView === 'tk' ? tkImg : t0Img}
                  alt="Inspection Frame"
                  className="w-full h-full object-contain"
                />
                <svg
                  aria-hidden="true"
                  viewBox="0 0 1280 720"
                  className="absolute inset-0 w-full h-full pointer-events-none"
                >
                  {activeFrameView === 'tk' && showMaskOverlay && tkMaskSvg && (
                    <path
                      d={tkMaskSvg}
                      fill="rgba(255, 69, 58, 0.40)"
                      stroke="#FF453A"
                      strokeWidth="1.5"
                    />
                  )}
                  {showReticle && (
                    <g>
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
                      <circle cx={resolvedBox.x} cy={resolvedBox.y} r="3" fill="#38BDF8" />
                      <circle
                        cx={resolvedBox.x + resolvedBox.width}
                        cy={resolvedBox.y + resolvedBox.height}
                        r="3"
                        fill="#38BDF8"
                      />
                    </g>
                  )}
                </svg>
              </div>
            )}
          </div>
        </div>

        {/* 2.5× TARGET ZOOM LOUPE STRIP */}
        <div className="px-4 py-3 bg-paper-base">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Maximize2 className="w-3.5 h-3.5 text-signal-cool" />
              <span className="text-[11px] font-mono text-ink-primary font-medium">
                2.5× Target Zoom Loupe
              </span>
              <span className="text-[10px] font-mono text-ink-muted">
                BBox [{resolvedBox.x}, {resolvedBox.y}, {resolvedBox.width}, {resolvedBox.height}]
              </span>
            </div>
            <span className="text-[10px] font-mono text-ink-muted">
              Sub-pixel edge alignment comparison
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Loupe 1: t0 Baseline */}
            <div className="border border-rule-border rounded bg-paper-well p-2 space-y-1">
              <div className="flex items-center justify-between text-[10px] font-mono">
                <span className="text-ink-muted">Baseline (t_0)</span>
                <span className="text-signal-emerald">100.0% Visible (0 px clipped)</span>
              </div>
              <div className="w-full h-24 bg-black rounded border border-rule-border overflow-hidden flex items-center justify-center">
                <svg
                  aria-hidden="true"
                  viewBox={`${resolvedBox.x - 20} ${resolvedBox.y - 10} ${resolvedBox.width + 40} ${resolvedBox.height + 20}`}
                  className="w-full h-full object-contain"
                >
                  <image href={t0Img} width="1280" height="720" />
                  <rect
                    x={resolvedBox.x}
                    y={resolvedBox.y}
                    width={resolvedBox.width}
                    height={resolvedBox.height}
                    fill="none"
                    stroke="#38BDF8"
                    strokeWidth="1.5"
                    strokeDasharray="3 2"
                  />
                </svg>
              </div>
            </div>

            {/* Loupe 2: tk Settled + Mask */}
            <div className="border border-rule-border rounded bg-paper-well p-2 space-y-1">
              <div className="flex items-center justify-between text-[10px] font-mono">
                <span className="text-ink-muted">Settled (t_k)</span>
                <span className={isRejected ? 'text-signal-vermilion' : 'text-signal-emerald'}>
                  {isRejected
                    ? `${(Number(result?.visRatio ?? 0.9) * 100).toFixed(1)}% Visible (${result?.pixelLossCount ?? 1700} px clipped)`
                    : '100.0% Visible'}
                </span>
              </div>
              <div className="w-full h-24 bg-black rounded border border-rule-border overflow-hidden flex items-center justify-center">
                <svg
                  aria-hidden="true"
                  viewBox={`${resolvedBox.x - 20} ${resolvedBox.y - 10} ${resolvedBox.width + 40} ${resolvedBox.height + 20}`}
                  className="w-full h-full object-contain"
                >
                  <image href={tkImg} width="1280" height="720" />
                  {tkMaskSvg && (
                    <path
                      d={tkMaskSvg}
                      fill="rgba(255, 69, 58, 0.40)"
                      stroke="#FF453A"
                      strokeWidth="1.5"
                    />
                  )}
                  <rect
                    x={resolvedBox.x}
                    y={resolvedBox.y}
                    width={resolvedBox.width}
                    height={resolvedBox.height}
                    fill="none"
                    stroke="#38BDF8"
                    strokeWidth="1.5"
                    strokeDasharray="3 2"
                  />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* BOTTOM: STRUCTURED TABULAR VERDICT & CLI/MCP COPIERS */}
        <div className="p-4 bg-paper-base space-y-3">
          <div className="flex items-center justify-between p-3 rounded bg-paper-well border border-rule-border">
            <div className="flex items-center gap-3">
              {isRejected ? (
                <ShieldAlert className="w-5 h-5 text-signal-vermilion" />
              ) : (
                <ShieldCheck className="w-5 h-5 text-signal-emerald" />
              )}
              <div>
                <div className="flex items-center gap-2">
                  <span
                    className={`text-xs font-mono font-bold ${
                      isRejected ? 'text-signal-vermilion' : 'text-signal-emerald'
                    }`}
                  >
                    {isRejected ? 'REJECTED' : 'VERIFIED'}
                  </span>
                  <span className="text-ink-muted text-xs font-mono">·</span>
                  <span className="text-xs font-mono text-ink-primary">
                    {isRejected
                      ? `${((1 - Number(result?.visRatio ?? 0.9)) * 100).toFixed(2)}% Occlusion Detected`
                      : '0.00% Occlusion (Within Noise Floor)'}
                  </span>
                </div>
                <div className="text-[11px] font-mono text-ink-muted mt-0.5">
                  {result?.reason ||
                    (isRejected
                      ? 'Loss exceeds calibrated 3σ threshold (1.35%). Visual obstruction verified.'
                      : 'Visibility loss within 3σ calibrated noise floor (0.45%). Element verified clean.')}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4 text-right font-mono text-xs">
              <div>
                <div className="text-[10px] text-ink-muted">Pixel Loss</div>
                <div className="text-ink-primary font-semibold">
                  {result?.pixelLossCount ?? (isRejected ? '1,700 px' : '0 px')}
                </div>
              </div>
              <div className="border-l border-rule-border pl-4">
                <div className="text-[10px] text-ink-muted">3σ Floor</div>
                <div className="text-signal-emerald font-semibold">1.35%</div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="p-2.5 rounded bg-paper-well border border-rule-border space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono text-ink-muted">CLI Command Equivalent</span>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(cliCommand);
                    setCopiedCli(true);
                    setTimeout(() => setCopiedCli(false), 2000);
                  }}
                  className="flex items-center gap-1 text-[10px] font-mono text-ink-muted hover:text-ink-primary whitespace-nowrap"
                >
                  {copiedCli ? <Check className="w-3 h-3 text-signal-emerald" /> : <Copy className="w-3 h-3" />}
                  <span className="whitespace-nowrap">{copiedCli ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
              <pre className="text-[11px] font-mono text-signal-cool overflow-x-auto whitespace-pre-wrap p-1.5 rounded bg-paper-base border border-rule-border">
                {cliCommand}
              </pre>
            </div>

            <div className="p-2.5 rounded bg-paper-well border border-rule-border space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono text-ink-muted">MCP JSON-RPC Tool Call</span>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(mcpPayload);
                    setCopiedMcp(true);
                    setTimeout(() => setCopiedMcp(false), 2000);
                  }}
                  className="flex items-center gap-1 text-[10px] font-mono text-ink-muted hover:text-ink-primary whitespace-nowrap"
                >
                  {copiedMcp ? <Check className="w-3 h-3 text-signal-emerald" /> : <Copy className="w-3 h-3" />}
                  <span className="whitespace-nowrap">{copiedMcp ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
              <pre className="text-[10px] font-mono text-ink-muted overflow-x-auto max-h-16 p-1.5 rounded bg-paper-base border border-rule-border">
                {mcpPayload}
              </pre>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};
