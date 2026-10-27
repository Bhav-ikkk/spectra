import React, { useState } from 'react';
import {
  UploadCloud,
  FileImage,
  ShieldCheck,
  ShieldAlert,
  Target,
  ArrowRight,
  Sparkles,
  Layers,
  AlertCircle,
} from 'lucide-react';

export const LiveDropzoneView: React.FC = () => {
  const [targetLabel, setTargetLabel] = useState('Complete Checkout Button');
  const [bboxX, setBboxX] = useState(910);
  const [bboxY, setBboxY] = useState(600);
  const [bboxW, setBboxW] = useState(340);
  const [bboxH, setBboxH] = useState(50);
  const [t0Name, setT0Name] = useState<string>('baseline_frame_t0.png');
  const [tkName, setTkName] = useState<string>('evaluated_frame_tk.png');
  const [t0Base64, setT0Base64] = useState<string | null>(null);
  const [tkBase64, setTkBase64] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [result, setResult] = useState<Record<string, any> | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, type: 't0' | 'tk') => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (type === 't0') {
        setT0Name(file.name);
        setT0Base64(reader.result as string);
      } else {
        setTkName(file.name);
        setTkBase64(reader.result as string);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleRunVerification = async () => {
    setIsVerifying(true);
    setErrorMsg(null);
    try {
      const res = await fetch('/api/verify-live', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          t0Base64: t0Base64 || undefined,
          tkBase64: tkBase64 || undefined,
          // Fallback to canonical assets if none dropped
          t0FramePath: !t0Base64 ? 'benchmark/clips/dom_catch_010_v1_t0.png' : undefined,
          tkFramePath: !tkBase64 ? 'benchmark/clips/dom_catch_010_v1_tk.png' : undefined,
          cachedSamResponsePath: !t0Base64
            ? 'benchmark/responses/benchmark-sam/dom_catch_010_v1_sam.json'
            : undefined,
          targetLabel,
          targetBBox: {
            x: Number(bboxX),
            y: Number(bboxY),
            width: Number(bboxW),
            height: Number(bboxH),
          },
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Verification request failed');
      }

      const data = await res.json();
      setResult(data);
    } catch (err: any) {
      setErrorMsg(err.message || 'Verification error');
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div className="flex-1 h-full flex flex-col bg-[#09090B] overflow-y-auto p-6 space-y-6 select-none">
      {/* Title Header */}
      <div className="pb-4 border-b border-white/[0.08]">
        <div className="flex items-center gap-2 mb-1">
          <UploadCloud className="w-5 h-5 text-cyan-400" />
          <h1 className="text-lg font-bold text-white tracking-tight">
            Live Referee Dropzone — Test Any Frame Pair or Video Clip
          </h1>
          <span className="px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 text-[10px] font-mono border border-cyan-500/30">
            Local Dual-Instrument API Bridge
          </span>
        </div>
        <p className="text-xs text-zinc-400">
          Upload any $t_0$ baseline and $t_k$ evaluation frame to measure pixel loss and SAM 3.1
          vector segmentation masks in real time.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 flex-1">
        {/* Left: Dropzone Inputs & Bounding Box Controls */}
        <div className="space-y-4">
          {/* Dual Frame Drop Boxes */}
          <div className="grid grid-cols-2 gap-4">
            {/* t0 Dropzone */}
            <div className="p-4 rounded-xl bg-zinc-900/60 border border-dashed border-white/20 hover:border-cyan-500/50 flex flex-col items-center justify-center text-center cursor-pointer relative group transition-all">
              <input
                type="file"
                accept="image/*"
                onChange={(e) => handleFileChange(e, 't0')}
                className="absolute inset-0 opacity-0 cursor-pointer"
              />
              <FileImage className="w-8 h-8 text-zinc-500 group-hover:text-cyan-400 transition-colors mb-2" />
              <div className="text-xs font-bold text-zinc-200">Baseline Frame ($t_0$)</div>
              <div className="text-[10px] text-zinc-400 truncate max-w-full px-2 mt-1">
                {t0Name}
              </div>
            </div>

            {/* tk Dropzone */}
            <div className="p-4 rounded-xl bg-zinc-900/60 border border-dashed border-white/20 hover:border-purple-500/50 flex flex-col items-center justify-center text-center cursor-pointer relative group transition-all">
              <input
                type="file"
                accept="image/*"
                onChange={(e) => handleFileChange(e, 'tk')}
                className="absolute inset-0 opacity-0 cursor-pointer"
              />
              <FileImage className="w-8 h-8 text-zinc-500 group-hover:text-purple-400 transition-colors mb-2" />
              <div className="text-xs font-bold text-zinc-200">Evaluation Frame ($t_k$)</div>
              <div className="text-[10px] text-zinc-400 truncate max-w-full px-2 mt-1">
                {tkName}
              </div>
            </div>
          </div>

          {/* Target Region Controls */}
          <div className="p-4 rounded-xl bg-zinc-900/60 border border-white/[0.08] space-y-3">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-200">
              <Target className="w-4 h-4 text-amber-400" />
              Target Invariant Bounding Box (Pixels)
            </div>

            <div>
              <label className="text-[11px] text-zinc-400 block mb-1">Target Element Label:</label>
              <input
                type="text"
                value={targetLabel}
                onChange={(e) => setTargetLabel(e.target.value)}
                className="w-full bg-black/60 border border-white/10 rounded px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500/50"
              />
            </div>

            <div className="grid grid-cols-4 gap-2">
              <div>
                <label className="text-[10px] font-mono text-zinc-500 block mb-0.5">X</label>
                <input
                  type="number"
                  value={bboxX}
                  onChange={(e) => setBboxX(Number(e.target.value))}
                  className="w-full bg-black/60 border border-white/10 rounded px-2 py-1 text-xs text-white font-mono focus:outline-none"
                />
              </div>
              <div>
                <label className="text-[10px] font-mono text-zinc-500 block mb-0.5">Y</label>
                <input
                  type="number"
                  value={bboxY}
                  onChange={(e) => setBboxY(Number(e.target.value))}
                  className="w-full bg-black/60 border border-white/10 rounded px-2 py-1 text-xs text-white font-mono focus:outline-none"
                />
              </div>
              <div>
                <label className="text-[10px] font-mono text-zinc-500 block mb-0.5">WIDTH</label>
                <input
                  type="number"
                  value={bboxW}
                  onChange={(e) => setBboxW(Number(e.target.value))}
                  className="w-full bg-black/60 border border-white/10 rounded px-2 py-1 text-xs text-white font-mono focus:outline-none"
                />
              </div>
              <div>
                <label className="text-[10px] font-mono text-zinc-500 block mb-0.5">HEIGHT</label>
                <input
                  type="number"
                  value={bboxH}
                  onChange={(e) => setBboxH(Number(e.target.value))}
                  className="w-full bg-black/60 border border-white/10 rounded px-2 py-1 text-xs text-white font-mono focus:outline-none"
                />
              </div>
            </div>

            <button
              onClick={handleRunVerification}
              disabled={isVerifying}
              className="w-full mt-2 py-2.5 rounded-lg bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-md shadow-cyan-600/20 disabled:opacity-50"
            >
              <Sparkles className="w-4 h-4" />
              <span>
                {isVerifying
                  ? 'Measuring Optical Visibility...'
                  : 'Run Spectra Referee Verification'}
              </span>
            </button>
          </div>

          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-950/50 border border-rose-500/40 text-xs text-rose-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}
        </div>

        {/* Right: Live Measurement Telemetry Result */}
        <div className="p-4 rounded-xl bg-zinc-900/60 border border-white/[0.08] flex flex-col space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-zinc-200 flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-indigo-400" />
              Measurement Verdict Telemetry
            </span>
            {result && (
              <span
                className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase font-mono ${
                  result.combinedVerdict === 'pass'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                }`}
              >
                {result.combinedVerdict === 'pass' ? 'VERIFIED' : 'REJECTED'}
              </span>
            )}
          </div>

          {result ? (
            <div className="space-y-4 flex-1">
              {/* Verdict Summary Box */}
              <div
                className={`p-3 rounded-lg border ${
                  result.combinedVerdict === 'pass'
                    ? 'bg-emerald-950/40 border-emerald-500/40'
                    : 'bg-rose-950/40 border-rose-500/40'
                }`}
              >
                <div className="text-xs font-bold text-white mb-1">
                  {result.notes || 'Optical verification completed.'}
                </div>
                <div className="text-[11px] text-zinc-300 font-mono">
                  Confidence: {((result.confidence ?? 1) * 100).toFixed(2)}% | Noise Delta:{' '}
                  {((result.noiseDelta ?? 0) * 100).toFixed(2)}%
                </div>
              </div>

              {/* Instrument Details */}
              <div className="space-y-2 text-xs font-mono">
                <div className="p-2.5 rounded-lg bg-black/60 border border-white/[0.06] flex justify-between">
                  <span className="text-zinc-400">Instrument A (SAM 3.1):</span>
                  <span className="text-white font-bold">{result.instrumentA?.details}</span>
                </div>
                <div className="p-2.5 rounded-lg bg-black/60 border border-white/[0.06] flex justify-between">
                  <span className="text-zinc-400">Instrument B (Pixel):</span>
                  <span className="text-white font-bold">{result.instrumentB?.details}</span>
                </div>
                <div className="p-2.5 rounded-lg bg-black/60 border border-white/[0.06] flex justify-between">
                  <span className="text-zinc-400">Pixel Loss Count:</span>
                  <span className="text-rose-400 font-bold">
                    {result.instrumentB?.raw?.pixelLossCount ?? 0} px
                  </span>
                </div>
              </div>

              {/* Raw JSON Preview */}
              <pre className="p-2.5 rounded-lg bg-black/80 border border-white/[0.06] text-[10px] font-mono text-zinc-400 overflow-auto max-h-[160px]">
                <code>{JSON.stringify(result, null, 2)}</code>
              </pre>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-zinc-500">
              <UploadCloud className="w-12 h-12 stroke-1 mb-2 opacity-50" />
              <div className="text-xs font-medium text-zinc-400">No verification result yet</div>
              <div className="text-[11px] mt-1 max-w-[240px]">
                Click "Run Spectra Referee Verification" to execute live dual-instrument
                measurement.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
