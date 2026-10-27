import React, { useState } from 'react';
import {
  Mic,
  Sparkles,
  Play,
  Pause,
  FileCode,
  Volume2,
  CheckCircle2,
  ArrowRight,
  Code2,
} from 'lucide-react';

interface VoiceStudioViewProps {
  invariants: Record<string, any>;
  voiceTranscript: Record<string, any>;
}

export const VoiceStudioView: React.FC<VoiceStudioViewProps> = ({
  invariants,
  voiceTranscript,
}) => {
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [promptText, setPromptText] = useState(
    (voiceTranscript?.transcript as string) ||
      'When the cart drawer opens, the complete checkout button must never be covered, and the revenue series legend must stay visible.',
  );
  const [modelProvider, setModelProvider] = useState<'baseten' | 'meta'>('baseten');
  const [isCompiling, setIsCompiling] = useState(false);
  const [compiledResult, setCompiledResult] = useState<Record<string, any>>(invariants);

  const handleCompile = async () => {
    setIsCompiling(true);
    try {
      const res = await fetch('/api/compile-voice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcript: promptText,
          provider: modelProvider,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setCompiledResult(data);
      }
    } catch {
      // Fallback to current invariants if offline
    } finally {
      setIsCompiling(false);
    }
  };

  return (
    <div className="flex-1 h-full flex flex-col bg-[#09090B] overflow-y-auto p-6 space-y-6 select-none">
      {/* Title Header */}
      <div className="pb-4 border-b border-white/[0.08]">
        <div className="flex items-center gap-2 mb-1">
          <Mic className="w-5 h-5 text-purple-400" />
          <h1 className="text-lg font-bold text-white tracking-tight">
            Voice-to-Invariant Studio (.spectra/invariants.json)
          </h1>
          <span className="px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-400 text-[10px] font-mono border border-purple-500/30">
            muse-voice-transcribe-1.0 + muse-spark-open-1026
          </span>
        </div>
        <p className="text-xs text-zinc-400">
          Capture user expectations via natural voice or text and compile them into formal visual
          and behavioral invariants.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 flex-1">
        {/* Left: Spoken Audio Turn & Natural Language Expectation */}
        <div className="space-y-4 flex flex-col">
          {/* Spoken Turn Audio Player Card */}
          <div className="p-4 rounded-xl bg-zinc-900/60 border border-white/[0.08] space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-zinc-200 flex items-center gap-1.5">
                <Volume2 className="w-4 h-4 text-purple-400" />
                Spoken Input Turn
              </span>
              <span className="text-[10px] font-mono text-zinc-500">
                Session:{' '}
                {String(
                  voiceTranscript?.sessionId ||
                    'voyager/transcribe/6D0FEAC1E93944EB9F057C5DBE136055',
                )}
              </span>
            </div>

            {/* Audio Waveform Simulator */}
            <div className="h-14 rounded-lg bg-black/60 border border-white/[0.06] p-2 flex items-center justify-between gap-1">
              <button
                onClick={() => setIsPlayingAudio(!isPlayingAudio)}
                className="w-10 h-10 rounded-full bg-purple-600 hover:bg-purple-500 flex items-center justify-center text-white flex-shrink-0 transition-transform active:scale-95 shadow-md shadow-purple-600/30"
              >
                {isPlayingAudio ? (
                  <Pause className="w-4 h-4" />
                ) : (
                  <Play className="w-4 h-4 ml-0.5" />
                )}
              </button>

              <div className="flex-1 flex items-center gap-[3px] h-full px-2 overflow-hidden">
                {Array.from({ length: 48 }).map((_, i) => {
                  const heights = [30, 45, 75, 90, 60, 40, 85, 100, 70, 50, 65, 80];
                  const height = heights[i % heights.length];
                  return (
                    <div
                      key={i}
                      className={`flex-1 rounded-full transition-all duration-300 ${
                        isPlayingAudio
                          ? 'bg-gradient-to-t from-purple-500 to-indigo-400 animate-pulse'
                          : 'bg-zinc-700'
                      }`}
                      style={{ height: `${height}%` }}
                    />
                  );
                })}
              </div>

              <span className="text-[11px] font-mono text-zinc-400 px-2 flex-shrink-0">08.24s</span>
            </div>
          </div>

          {/* Transcript / Expectation Text Editor */}
          <div className="p-4 rounded-xl bg-zinc-900/60 border border-white/[0.08] space-y-3 flex-1 flex flex-col">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-zinc-200">
                Spoken Transcript / User Expectation:
              </label>
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-zinc-500">Compiler:</span>
                <select
                  value={modelProvider}
                  onChange={(e) => setModelProvider(e.target.value as any)}
                  className="bg-black/60 border border-white/10 rounded px-2 py-1 text-xs text-zinc-200 font-mono focus:outline-none"
                >
                  <option value="baseten">Baseten (muse-spark-open-1026)</option>
                  <option value="meta">Meta API (muse-spark-1.3)</option>
                </select>
              </div>
            </div>

            <textarea
              value={promptText}
              onChange={(e) => setPromptText(e.target.value)}
              rows={4}
              className="w-full flex-1 bg-black/60 border border-white/10 rounded-lg p-3 text-xs text-zinc-200 leading-relaxed focus:outline-none focus:border-purple-500/50 font-sans resize-none"
            />

            <button
              onClick={handleCompile}
              disabled={isCompiling}
              className="w-full py-2.5 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-md shadow-purple-600/20 disabled:opacity-50"
            >
              <Sparkles className="w-4 h-4" />
              <span>
                {isCompiling ? 'Compiling Invariants...' : 'Compile to .spectra/invariants.json'}
              </span>
            </button>
          </div>
        </div>

        {/* Right: Compiled Invariants Document JSON */}
        <div className="p-4 rounded-xl bg-zinc-900/60 border border-white/[0.08] flex flex-col space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-emerald-300 flex items-center gap-1.5">
              <FileCode className="w-4 h-4 text-emerald-400" />
              .spectra/invariants.json Output
            </span>
            <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-300 text-[10px] font-mono border border-emerald-500/20">
              Valid InvariantsSchema v1.0
            </span>
          </div>

          <pre className="flex-1 p-3.5 rounded-lg bg-black/80 border border-white/[0.08] text-[11px] font-mono text-emerald-300 overflow-auto leading-relaxed">
            <code>{JSON.stringify(compiledResult, null, 2)}</code>
          </pre>
        </div>
      </div>
    </div>
  );
};
