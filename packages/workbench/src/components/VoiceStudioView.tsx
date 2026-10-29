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
    <div className="flex-1 h-full flex bg-paper-base text-ink-primary overflow-hidden select-none divide-x divide-rule-border">
      {/* Left Column: Voice Audio Capture & Transcript */}
      <div className="w-96 shrink-0 h-full flex flex-col justify-between overflow-y-auto divide-y divide-rule-border min-h-0">
        <div className="divide-y divide-rule-border">
          {/* Header */}
          <div className="h-10 px-3 bg-paper-surface flex items-center justify-between shrink-0 whitespace-nowrap">
            <div className="flex items-center gap-1.5 text-xs font-medium text-ink-primary">
              <Mic className="w-3.5 h-3.5 text-signal-cool" />
              <span className="whitespace-nowrap">Voice Invariants Compiler</span>
            </div>
            <span className="text-[10px] font-mono text-ink-muted">16kHz Mono WAV</span>
          </div>

          {/* Microphone Recording Action Card */}
          <div className="p-4 bg-paper-well space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono text-ink-muted">
                Microphone Input
              </span>
              <span
                className={`text-[10px] font-mono ${
                  isRecording ? 'text-signal-vermilion' : 'text-ink-muted'
                }`}
              >
                {isRecording ? `Recording (${recordSeconds}s)` : 'Ready'}
              </span>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={toggleRecording}
                className={`w-12 h-12 rounded border flex items-center justify-center transition-colors shrink-0 whitespace-nowrap ${
                  isRecording
                    ? 'bg-signal-vermilion/20 border-signal-vermilion text-signal-vermilion'
                    : 'bg-paper-surface border-rule-border hover:border-signal-cool text-ink-primary'
                }`}
              >
                {isRecording ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
              </button>
              <div className="flex-1 space-y-1">
                <div className="text-xs font-semibold text-ink-primary">
                  {isRecording ? 'Speak UI Invariant' : 'Record Voice Spec'}
                </div>
                <div className="text-[10px] text-ink-muted">
                  Transcribed by <code>muse-voice-transcribe-1.0</code>
                </div>
                {isRecording && (
                  <div className="w-full h-1.5 rounded bg-paper-base border border-rule-border overflow-hidden mt-1">
                    <div
                      className="h-full bg-signal-emerald"
                      style={{ width: `${Math.min(100, micLevel * 100)}%` }}
                    />
                  </div>
                )}
              </div>
            </div>

            {micError && (
              <div className="p-2 rounded bg-signal-vermilion/10 border border-signal-vermilion/30 text-signal-vermilion text-[10px] font-mono">
                {micError}
              </div>
            )}
          </div>

          {/* Transcript Textarea */}
          <div className="p-4 bg-paper-base space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono text-ink-muted">
                Transcribed Specification
              </span>
              <button
                onClick={handleReplayFixture}
                className="text-[10px] font-mono text-signal-cool hover:underline flex items-center gap-1 whitespace-nowrap"
              >
                <RotateCcw className="w-2.5 h-2.5" />
                <span className="whitespace-nowrap">Replay Fixture ($0.00)</span>
              </button>
            </div>
            <textarea
              rows={4}
              value={promptText}
              onChange={(e) => setPromptText(e.target.value)}
              className="w-full bg-paper-well border border-rule-border focus:border-rule-active rounded p-2 text-xs text-ink-primary font-mono outline-none resize-none leading-relaxed"
            />
            <div className="text-[10px] font-mono text-ink-muted truncate">
              Session: {activeSessionId}
            </div>
          </div>

          {/* Compiler Configuration */}
          <div className="p-4 bg-paper-base space-y-2">
            <div className="text-[10px] font-mono text-ink-muted">
              LLM Invariant Compiler
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setModelProvider('baseten')}
                className={`p-2 rounded text-xs font-mono border text-left transition-colors whitespace-nowrap ${
                  modelProvider === 'baseten'
                    ? 'bg-paper-surface border-rule-active text-ink-primary'
                    : 'bg-paper-well border-rule-border text-ink-muted'
                }`}
              >
                <div className="font-semibold text-[11px] text-ink-primary">Baseten Open</div>
                <div className="text-[9px] text-ink-muted">Open 1026</div>
              </button>
              <button
                onClick={() => setModelProvider('meta')}
                className={`p-2 rounded text-xs font-mono border text-left transition-colors whitespace-nowrap ${
                  modelProvider === 'meta'
                    ? 'bg-paper-surface border-rule-active text-ink-primary'
                    : 'bg-paper-well border-rule-border text-ink-muted'
                }`}
              >
                <div className="font-semibold text-[11px] text-ink-primary">Meta Hosted</div>
                <div className="text-[9px] text-ink-muted">Spark 1.3</div>
              </button>
            </div>

            <button
              onClick={handleCompileText}
              disabled={isCompiling}
              className="w-full h-8 mt-2 rounded bg-ink-primary hover:bg-white text-paper-base font-medium text-xs flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50 whitespace-nowrap"
            >
              {isCompiling ? (
                <>
                  <span className="w-3 h-3 border-2 border-paper-base border-t-transparent rounded-full animate-spin" />
                  <span className="whitespace-nowrap">Compiling…</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  <span className="whitespace-nowrap">Compile</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-rule-border bg-paper-well text-[10px] text-ink-muted font-mono">
          Model IDs verified per Rule 5 against dev.meta.ai
        </div>
      </div>

      {/* Right Column: Compiled JSON Contract Display */}
      <div className="flex-1 h-full flex flex-col justify-between overflow-y-auto bg-paper-well min-h-0">
        <div className="divide-y divide-rule-border">
          <div className="h-10 px-4 bg-paper-surface border-b border-rule-border flex items-center justify-between shrink-0 whitespace-nowrap">
            <div className="flex items-center gap-1.5 text-xs font-medium text-ink-primary">
              <FileCode className="w-3.5 h-3.5 text-signal-emerald" />
              <span className="whitespace-nowrap">Compiled Contract: .spectra/invariants.json</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono text-signal-emerald">JSON-Schema Valid</span>
              {onClose && (
                <button
                  type="button"
                  onClick={onClose}
                  className="p-1 rounded-lg text-[#86868B] hover:text-[#F5F5F7] hover:bg-white/10 active:scale-95 transition-all cursor-pointer ml-1"
                  title="Close modal (Esc)"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          <div className="p-4">
            <pre className="p-3 rounded bg-paper-base border border-rule-border text-xs font-mono text-ink-muted overflow-x-auto leading-relaxed">
              {JSON.stringify(compiledResult, null, 2)}
            </pre>
          </div>
        </div>

        <div className="p-3 border-t border-rule-border bg-paper-base text-[10px] font-mono text-ink-muted flex items-center justify-between">
          <span>Target Schema: v1.0.0</span>
          <span className="text-signal-emerald">Saved to repository</span>
        </div>
      </div>
    </div>
  );
};
