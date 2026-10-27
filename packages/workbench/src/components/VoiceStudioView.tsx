import React, { useState, useEffect, useRef } from 'react';
import {
  Mic,
  MicOff,
  Sparkles,
  Play,
  Pause,
  FileCode,
  Volume2,
  RefreshCw,
  Radio,
  Clock,
  Layers,
  AlertCircle,
} from 'lucide-react';
import { startAudioRecording, type AudioRecordingSession } from '../utils/audio-recorder.js';

interface VoiceStudioViewProps {
  invariants: Record<string, unknown>;
  voiceTranscript: Record<string, unknown>;
}

export const VoiceStudioView: React.FC<VoiceStudioViewProps> = ({
  invariants,
  voiceTranscript,
}) => {
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const defaultTranscript =
    (voiceTranscript?.transcript as string) ||
    'When the cart drawer opens, the complete checkout button must never be covered, and the revenue series legend must stay visible.';

  const defaultSessionId =
    (voiceTranscript?.sessionId as string) || 'voyager/transcribe/6D0FEAC1E93944EB9F057C5DBE136055';

  const [promptText, setPromptText] = useState(defaultTranscript);
  const [activeSessionId, setActiveSessionId] = useState(defaultSessionId);
  const [modelProvider, setModelProvider] = useState<'baseten' | 'meta'>('baseten');
  const [isCompiling, setIsCompiling] = useState(false);
  const [compiledResult, setCompiledResult] = useState<Record<string, unknown>>(invariants);

  // Live Microphone Recording State
  const [isRecording, setIsRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [micLevel, setMicLevel] = useState(0);
  const [micError, setMicError] = useState<string | null>(null);
  const recordingSessionRef = useRef<AudioRecordingSession | null>(null);
  const recordTimerRef = useRef<number | null>(null);

  // Clean up recording timer on unmount
  useEffect(() => {
    return () => {
      if (recordTimerRef.current) clearInterval(recordTimerRef.current);
    };
  }, []);

  // Start in-browser microphone recording
  const handleStartRecording = async () => {
    setMicError(null);
    try {
      const session = await startAudioRecording((level) => {
        setMicLevel(level);
      });
      recordingSessionRef.current = session;
      setIsRecording(true);
      setRecordSeconds(0);

      recordTimerRef.current = window.setInterval(() => {
        setRecordSeconds((sec) => sec + 1);
      }, 1000);
    } catch (err) {
      console.error('[VoiceStudio] Microphone access error:', err);
      setMicError((err as Error).message || 'Microphone access denied or unavailable.');
    }
  };

  // Stop in-browser microphone recording and compile
  const handleStopRecording = async () => {
    if (!recordingSessionRef.current) return;
    if (recordTimerRef.current) {
      clearInterval(recordTimerRef.current);
      recordTimerRef.current = null;
    }

    setIsRecording(false);
    setIsCompiling(true);

    try {
      const { base64Wav } = await recordingSessionRef.current.stop();
      recordingSessionRef.current = null;

      // Post recorded 16kHz mono WAV base64 to /api/compile-voice
      const res = await fetch('/api/compile-voice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          audioBase64: `data:audio/wav;base64,${base64Wav}`,
          provider: modelProvider,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.transcript) {
          setPromptText(data.transcript);
        }
        if (data.sessionId) {
          setActiveSessionId(data.sessionId);
        }
        if (data.document || data.invariants) {
          setCompiledResult(data.document || { invariants: data.invariants });
        }
      }
    } catch (err) {
      console.error('[VoiceStudio] Compile audio error:', err);
      setMicError((err as Error).message || 'Failed to compile audio recording.');
    } finally {
      setIsCompiling(false);
      setMicLevel(0);
    }
  };

  // Toggle record / stop
  const toggleRecording = () => {
    if (isRecording) {
      handleStopRecording();
    } else {
      handleStartRecording();
    }
  };

  // Reset to verified cached fixture ($0.00 spend)
  const handleReplayFixture = () => {
    setPromptText(defaultTranscript);
    setActiveSessionId(defaultSessionId);
    setCompiledResult(invariants);
    setMicError(null);
  };

  // Manual text re-compilation
  const handleCompileText = async () => {
    setIsCompiling(true);
    setMicError(null);
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
        setCompiledResult(data.document || data);
      }
    } catch (err) {
      console.error('[VoiceStudio] Manual compile error:', err);
      setMicError('Compiler offline: using active cached invariants.');
    } finally {
      setIsCompiling(false);
    }
  };

  return (
    <div className="flex-1 h-full flex flex-col bg-[#09090B] overflow-y-auto p-6 space-y-6 select-none">
      {/* Title Header */}
      <div className="flex items-center justify-between pb-4 border-b border-white/[0.08]">
        <div>
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
            Capture user expectations via live 16kHz microphone or natural text and compile them
            into formal visual invariants.
          </p>
        </div>

        {/* Action Controls: Cached Replay vs Live Recording */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleReplayFixture}
            className="px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white text-xs font-semibold border border-white/10 flex items-center gap-1.5 transition-all shadow-sm"
            title="Replay verified fixture with zero network latency"
          >
            <RefreshCw className="w-3.5 h-3.5 text-emerald-400" />
            <span>Replay Verified Fixture ($0.00)</span>
          </button>

          <button
            onClick={toggleRecording}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2 transition-all shadow-md ${
              isRecording
                ? 'bg-rose-600 hover:bg-rose-500 text-white animate-pulse shadow-rose-600/30'
                : 'bg-purple-600 hover:bg-purple-500 text-white shadow-purple-600/30'
            }`}
          >
            {isRecording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            <span>
              {isRecording
                ? `Recording (${recordSeconds}s) — Click to Stop`
                : 'Hold / Click to Record Live Mic (Muse Voice 1.0)'}
            </span>
          </button>
        </div>
      </div>

      {/* Mic Error Banner */}
      {micError && (
        <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{micError}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 flex-1">
        {/* Left: Spoken Audio Turn & Natural Language Expectation */}
        <div className="space-y-4 flex flex-col">
          {/* Spoken Turn Audio Player Card */}
          <div className="p-4 rounded-xl bg-zinc-900/60 border border-white/[0.08] space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-zinc-200 flex items-center gap-1.5">
                <Volume2 className="w-4 h-4 text-purple-400" />
                {isRecording ? 'Live Microphone Audio Feed' : 'Spoken Input Turn Audio'}
              </span>
              <span className="text-[10px] font-mono text-zinc-500 truncate max-w-[260px]">
                Session: {activeSessionId}
              </span>
            </div>

            {/* Audio Waveform Simulator / Live Visualizer */}
            <div className="h-14 rounded-lg bg-black/60 border border-white/[0.06] p-2 flex items-center justify-between gap-1">
              <button
                onClick={() => setIsPlayingAudio(!isPlayingAudio)}
                disabled={isRecording}
                className={`w-10 h-10 rounded-full flex items-center justify-center text-white flex-shrink-0 transition-transform active:scale-95 shadow-md ${
                  isRecording
                    ? 'bg-zinc-800 opacity-50 cursor-not-allowed'
                    : 'bg-purple-600 hover:bg-purple-500 shadow-purple-600/30'
                }`}
              >
                {isPlayingAudio ? (
                  <Pause className="w-4 h-4" />
                ) : (
                  <Play className="w-4 h-4 ml-0.5" />
                )}
              </button>

              <div className="flex-1 flex items-center gap-[3px] h-full px-2 overflow-hidden">
                {Array.from({ length: 48 }).map((_, i) => {
                  const defaultHeights = [30, 45, 75, 90, 60, 40, 85, 100, 70, 50, 65, 80];
                  let height = defaultHeights[i % defaultHeights.length]!;

                  if (isRecording) {
                    // Modulate with live mic level
                    const randomVariation = Math.sin(i * 0.5 + Date.now() * 0.01) * 20;
                    height = Math.max(15, Math.min(100, micLevel * 100 + randomVariation));
                  }

                  return (
                    <div
                      key={i}
                      className={`flex-1 rounded-full transition-all duration-150 ${
                        isRecording
                          ? 'bg-rose-500 animate-pulse'
                          : isPlayingAudio
                            ? 'bg-gradient-to-t from-purple-500 to-indigo-400 animate-pulse'
                            : 'bg-zinc-700'
                      }`}
                      style={{ height: `${height}%` }}
                    />
                  );
                })}
              </div>

              <span className="text-[11px] font-mono text-zinc-400 px-2 flex-shrink-0">
                {isRecording ? `REC 00:0${recordSeconds}` : '08.24s'}
              </span>
            </div>
          </div>

          {/* Transcript / Expectation Text Editor */}
          <div className="p-4 rounded-xl bg-zinc-900/60 border border-white/[0.08] space-y-3 flex-1 flex flex-col">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-zinc-200 flex items-center gap-2">
                <span>Spoken Transcript / User Expectation:</span>
                <span className="px-1.5 py-0.5 rounded bg-zinc-800 text-[10px] font-mono text-zinc-400">
                  Editable
                </span>
              </label>

              <div className="flex items-center gap-2">
                <span className="text-[11px] text-zinc-500">Compiler:</span>
                <select
                  value={modelProvider}
                  onChange={(e) => setModelProvider(e.target.value as 'baseten' | 'meta')}
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
              placeholder="Speak into microphone or type your UI requirement..."
            />

            <button
              onClick={handleCompileText}
              disabled={isCompiling || isRecording}
              className="w-full py-2.5 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-md shadow-purple-600/20 disabled:opacity-50"
            >
              <Sparkles className="w-4 h-4" />
              <span>
                {isCompiling
                  ? 'Compiling Invariants via Muse Spark...'
                  : 'Compile to .spectra/invariants.json'}
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
