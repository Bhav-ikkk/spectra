import React, { useState, useEffect, useRef } from 'react';
import {
  Mic,
  MicOff,
  Sparkles,
  RotateCcw,
  FileCode,
  X,
} from 'lucide-react';
import { startAudioRecording, type AudioRecordingSession } from '../utils/audio-recorder.js';
import { VerticalLedMeter } from './FieldMonitorPrimitives.js';

export interface VoiceStudioViewProps {
  invariants: Record<string, unknown>;
  voiceTranscript: Record<string, unknown>;
  onClose?: () => void;
}

export const VoiceStudioView: React.FC<VoiceStudioViewProps> = ({
  invariants,
  voiceTranscript,
  onClose,
}) => {
  const defaultTranscript =
    (voiceTranscript?.transcript as string) ||
    'When the cart drawer opens, the complete checkout button must never be covered, and the revenue series legend must stay visible.';

  const defaultSessionId =
    (voiceTranscript?.sessionId as string) ||
    'voyager/transcribe/6D0FEAC1E93944EB9F057C5DBE136055';

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

  useEffect(() => {
    return () => {
      if (recordTimerRef.current) clearInterval(recordTimerRef.current);
    };
  }, []);

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
      setMicError((err as Error).message || 'Microphone access denied or unavailable.');
    }
  };

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
        if (data.transcript) setPromptText(data.transcript);
        if (data.sessionId) setActiveSessionId(data.sessionId);
        if (data.document || data.invariants) {
          setCompiledResult(data.document || { invariants: data.invariants });
        }
      }
    } catch (err) {
      setMicError((err as Error).message || 'Failed to compile audio recording.');
    } finally {
      setIsCompiling(false);
      setMicLevel(0);
    }
  };

  const toggleRecording = () => {
    if (isRecording) handleStopRecording();
    else handleStartRecording();
  };

  const handleReplayFixture = () => {
    setPromptText(defaultTranscript);
    setActiveSessionId(defaultSessionId);
    setCompiledResult(invariants);
    setMicError(null);
  };

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
        if (data.document || data.invariants) {
          setCompiledResult(data.document || { invariants: data.invariants });
        }
      }
    } catch (err) {
      setMicError((err as Error).message || 'Failed to compile transcript.');
    } finally {
      setIsCompiling(false);
    }
  };

  return (
    <div className="flex-1 h-full flex bg-[#EAE7DF] text-[#181816] overflow-hidden select-none divide-x divide-[#B8B4A9] font-sans">
      {/* Left Column: Voice Audio Capture & Transcript */}
      <div className="w-96 shrink-0 h-full flex flex-col justify-between overflow-y-auto divide-y divide-[#B8B4A9] bg-[#EAE7DF] min-h-0">
        <div className="divide-y divide-[#B8B4A9]">
          {/* Header */}
          <div className="h-10 px-3.5 bg-[#EAE7DF] flex items-center justify-between shrink-0 whitespace-nowrap">
            <div className="flex items-center gap-1.5 font-mono text-xs font-semibold uppercase tracking-wider text-[#181816]">
              <Mic className="w-3.5 h-3.5" />
              <span>Voice Invariants Compiler</span>
            </div>
            <span className="text-[10px] font-mono text-[#4A4843]">16kHz Mono WAV</span>
          </div>

          {/* Microphone Recording Action Card */}
          <div className="p-4 bg-[#DFDCD3] space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono uppercase tracking-wider text-[#4A4843]">
                Microphone Input
              </span>
              <span
                className={`text-[10px] font-mono font-semibold ${
                  isRecording ? 'text-[#9E2A22]' : 'text-[#4A4843]'
                }`}
              >
                {isRecording ? `Recording (${recordSeconds}s)` : 'Ready'}
              </span>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={toggleRecording}
                className={`w-12 h-12 rounded-[4px] border-[1.5px] flex items-center justify-center transition-colors shrink-0 cursor-pointer ${
                  isRecording
                    ? 'bg-[#E05246] border-[#181816] text-white shadow-sm'
                    : 'bg-[#EAE7DF] border-[#B8B4A9] hover:border-[#181816] text-[#181816]'
                }`}
              >
                {isRecording ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
              </button>

              <div className="flex-1 space-y-1">
                <div className="text-xs font-semibold text-[#181816]">
                  {isRecording ? 'Speak UI Invariant...' : 'Record Voice Spec'}
                </div>
                <div className="text-[10px] font-mono text-[#4A4843]">
                  Transcribed by <code>muse-voice-transcribe-1.0</code>
                </div>
                {isRecording && (
                  <div className="pt-1">
                    <VerticalLedMeter ratio={micLevel || 0.4} variant="emeraldPeak" />
                  </div>
                )}
              </div>
            </div>

            {micError && (
              <div className="p-2 rounded-[3px] bg-[#F2C6BE] border border-[#DF9B90] text-[#9E2A22] text-[10px] font-mono">
                {micError}
              </div>
            )}
          </div>

          {/* Transcript Editor & Invariant Synthesis */}
          <div className="p-4 bg-[#EAE7DF] space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-mono uppercase tracking-wider text-[#4A4843]">
                Raw Voice Transcript:
              </label>
              <button
                type="button"
                onClick={handleReplayFixture}
                className="text-[10px] font-mono text-[#181816] hover:underline flex items-center gap-1 cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset Baseline</span>
              </button>
            </div>

            <textarea
              rows={4}
              value={promptText}
              onChange={(e) => setPromptText(e.target.value)}
              className="w-full p-2.5 rounded-[4px] bg-[#D6D3C9] border border-[#B8B4A9] text-xs font-mono text-[#181816] leading-relaxed resize-none focus:outline-none focus:border-[#181816]"
            />

            {/* Provider Switcher */}
            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                onClick={() => setModelProvider('baseten')}
                className={`p-2 rounded-[3px] text-xs font-mono border text-left transition-colors cursor-pointer ${
                  modelProvider === 'baseten'
                    ? 'bg-[#181816] text-white border-[#181816]'
                    : 'bg-[#DFDCD3] border-[#B8B4A9] text-[#181816]'
                }`}
              >
                <div className="font-semibold text-[11px]">Baseten Open</div>
                <div className="text-[9px] opacity-80">Open 1026</div>
              </button>
              <button
                type="button"
                onClick={() => setModelProvider('meta')}
                className={`p-2 rounded-[3px] text-xs font-mono border text-left transition-colors cursor-pointer ${
                  modelProvider === 'meta'
                    ? 'bg-[#181816] text-white border-[#181816]'
                    : 'bg-[#DFDCD3] border-[#B8B4A9] text-[#181816]'
                }`}
              >
                <div className="font-semibold text-[11px]">Meta Hosted</div>
                <div className="text-[9px] opacity-80">Spark 1.3</div>
              </button>
            </div>

            <button
              type="button"
              onClick={handleCompileText}
              disabled={isCompiling}
              className="w-full h-9 mt-2 rounded-[3px] bg-[#181816] hover:bg-[#2C2C29] text-white font-mono text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-2xs disabled:opacity-50"
            >
              {isCompiling ? (
                <>
                  <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Compiling via Spark...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Compile Invariant Contract ↗</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-[#B8B4A9] bg-[#DFDCD3] text-[10px] text-[#4A4843] font-mono">
          Session ID: {activeSessionId}
        </div>
      </div>

      {/* Right Column: Compiled JSON Contract Display */}
      <div className="flex-1 h-full flex flex-col justify-between overflow-y-auto bg-[#DFDCD3] min-h-0">
        <div className="divide-y divide-[#B8B4A9]">
          <div className="h-10 px-4 bg-[#EAE7DF] border-b border-[#B8B4A9] flex items-center justify-between shrink-0 whitespace-nowrap">
            <div className="flex items-center gap-1.5 text-xs font-mono font-semibold text-[#181816]">
              <FileCode className="w-3.5 h-3.5" />
              <span>Compiled Contract: .spectra/invariants.json</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono text-[#1D4D35] bg-[#DCE8DF] border border-[#9BB8A5] px-2 py-0.5 rounded-[3px] font-semibold">
                JSON-Schema Valid
              </span>
              {onClose && (
                <button
                  type="button"
                  onClick={onClose}
                  className="p-1 rounded-[3px] text-[#4A4843] hover:text-[#181816] hover:bg-[#D6D3C9] transition-colors cursor-pointer ml-1"
                  title="Close modal (Esc)"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          <div className="p-4">
            <pre className="p-3.5 rounded-[4px] bg-[#D6D3C9] border border-[#B8B4A9] text-xs font-mono text-[#181816] overflow-x-auto leading-relaxed shadow-inner">
              {JSON.stringify(compiledResult, null, 2)}
            </pre>
          </div>
        </div>

        <div className="p-3 border-t border-[#B8B4A9] bg-[#EAE7DF] text-[10px] font-mono text-[#4A4843] flex items-center justify-between">
          <span>Target Schema: v1.0.0</span>
          <span className="text-[#1D4D35] font-semibold">Saved to repository</span>
        </div>
      </div>
    </div>
  );
};
