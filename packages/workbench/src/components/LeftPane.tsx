import React, { useState } from 'react';
import { Layers, FileCode, Mic, Monitor, Smartphone, Layout, Search } from 'lucide-react';
import type { WorkbenchScenarioBundle, WorkbenchClipAsset } from '../types.js';

interface LeftPaneProps {
  scenarios: {
    s1: WorkbenchScenarioBundle;
    s2: WorkbenchScenarioBundle;
    s3: WorkbenchScenarioBundle;
  };
  activeScenarioId: 's1' | 's2' | 's3';
  setActiveScenarioId: (id: 's1' | 's2' | 's3') => void;
  clips: WorkbenchClipAsset[];
  activeClipId: string;
  setActiveClipId: (id: string) => void;
  viewMode: 'arena' | 'benchmark';
  invariants: {
    invariants?: Array<{
      id: string;
      description: string;
      type: string;
      matcher?: { target: string };
      source?: { compiled_by?: string };
    }>;
  };
  voiceTranscript?: {
    transcript?: string;
    audioDurationMs?: number;
    sessionId?: string;
  };
}

export function LeftPane({
  scenarios: _scenarios,
  activeScenarioId,
  setActiveScenarioId,
  clips,
  activeClipId,
  setActiveClipId,
  viewMode,
  invariants,
  voiceTranscript,
}: LeftPaneProps) {
  const [occlusionFilter, setOcclusionFilter] = useState<number | 'all'>('all');
  const [envFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const scenarioList: Array<{
    id: 's1' | 's2' | 's3';
    title: string;
    subtitle: string;
    env: string;
    icon: React.ReactNode;
    loss: string;
  }> = [
    {
      id: 's1',
      title: 'Scenario S1',
      subtitle: 'HTML5 Canvas Chart Collision',
      env: 'canvas',
      icon: <Monitor className="w-3.5 h-3.5 text-blue-400" />,
      loss: '15% Occlusion',
    },
    {
      id: 's2',
      title: 'Scenario S2',
      subtitle: 'Mobile Bottom-Sheet (Raw MP4)',
      env: 'mobile_mp4',
      icon: <Smartphone className="w-3.5 h-3.5 text-emerald-400" />,
      loss: '15% Occlusion',
    },
    {
      id: 's3',
      title: 'Scenario S3 ("The Catch")',
      subtitle: 'Sticky Cart Drawer Edge Occlusion',
      env: 'dom_catch',
      icon: <Layout className="w-3.5 h-3.5 text-purple-400" />,
      loss: '10% Subtle Edge',
    },
  ];

  // Filter clips for benchmark mode
  const filteredClips = clips.filter((c) => {
    if (occlusionFilter !== 'all' && c.groundTruthOcclusion !== occlusionFilter) return false;
    if (envFilter !== 'all' && c.environment !== envFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        c.clipId.toLowerCase().includes(q) ||
        c.targetLabel.toLowerCase().includes(q) ||
        c.environment.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const parsedInvariants = invariants.invariants || [];

  return (
    <div className="w-[26%] min-w-[300px] max-w-[380px] h-full flex flex-col bg-[#0D0D11]/95 border-r border-white/[0.08] select-none overflow-hidden z-20">
      {/* Pane Top Header */}
      <div className="h-10 px-4 border-b border-white/[0.06] flex items-center justify-between bg-[#121216]/80 flex-shrink-0">
        <span className="text-xs font-semibold text-zinc-200 flex items-center gap-1.5">
          <Layers className="w-3.5 h-3.5 text-indigo-400" />
          {viewMode === 'arena' ? 'Closed-Loop Arena Scenarios' : 'Benchmark Clip Navigator'}
        </span>
        <span className="text-[10px] font-mono text-zinc-500">
          {viewMode === 'arena' ? '3 Scenarios' : `${filteredClips.length} / 45 Clips`}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {/* Arena Mode: Closed-Loop Scenarios List */}
        {viewMode === 'arena' && (
          <div className="space-y-2">
            <div className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider px-1">
              Select Closed-Loop Scenario
            </div>

            {scenarioList.map((sc) => {
              const isSelected = activeScenarioId === sc.id;
              return (
                <button
                  key={sc.id}
                  onClick={() => setActiveScenarioId(sc.id)}
                  className={`w-full text-left p-3 rounded-xl border transition-all ${
                    isSelected
                      ? 'bg-zinc-800/90 border-indigo-500/50 shadow-lg shadow-indigo-500/10'
                      : 'bg-zinc-900/50 border-white/[0.06] hover:bg-zinc-800/50 hover:border-white/10'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-zinc-100">
                      {sc.icon}
                      <span>{sc.title}</span>
                    </div>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-300 border border-rose-500/20">
                      {sc.loss}
                    </span>
                  </div>

                  <div className="text-xs text-zinc-300 font-medium leading-tight mb-2">
                    {sc.subtitle}
                  </div>

                  <div className="flex items-center justify-between text-[10px] text-zinc-400 pt-1.5 border-t border-white/[0.04] font-mono">
                    <span className="flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
                      Pass 1: Rejected
                    </span>
                    <span className="flex items-center gap-1 text-emerald-400 font-semibold">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                      Pass 2: Repaired
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* Benchmark Mode: Search & Filter Clips */}
        {viewMode === 'benchmark' && (
          <div className="space-y-2.5">
            {/* Search Input */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search clips or targets..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-black/50 border border-white/10 rounded-lg pl-8 pr-3 py-1.5 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-indigo-500/50"
              />
            </div>

            {/* Occlusion Level Filter Pills */}
            <div className="space-y-1">
              <div className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">
                Filter Occlusion Level
              </div>
              <div className="flex flex-wrap gap-1">
                {(['all', 0, 0.05, 0.1, 0.15, 0.25, 0.4, 0.6] as const).map((lvl) => {
                  const isSel = occlusionFilter === lvl;
                  const label = lvl === 'all' ? 'All' : `${Math.round((lvl as number) * 100)}%`;
                  return (
                    <button
                      key={String(lvl)}
                      onClick={() => setOcclusionFilter(lvl)}
                      className={`px-2 py-0.5 rounded text-[10px] font-mono transition-all ${
                        isSel
                          ? 'bg-indigo-600 text-white font-bold'
                          : 'bg-zinc-800/80 text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Clips List */}
            <div className="space-y-1.5 max-h-[340px] overflow-y-auto pr-1">
              {filteredClips.map((c) => {
                const isSelected = activeClipId === c.clipId;
                const occ = Math.round(c.groundTruthOcclusion * 100);
                return (
                  <button
                    key={c.clipId}
                    onClick={() => setActiveClipId(c.clipId)}
                    className={`w-full text-left p-2 rounded-lg border text-xs transition-all ${
                      isSelected
                        ? 'bg-zinc-800 border-indigo-500/50 text-white shadow-sm'
                        : 'bg-zinc-900/40 border-white/[0.04] text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="font-mono text-[11px] font-medium text-zinc-200">
                        {c.clipId}
                      </span>
                      <span
                        className={`text-[10px] font-mono px-1 py-0.2 rounded ${
                          occ === 0
                            ? 'bg-emerald-500/10 text-emerald-300'
                            : 'bg-rose-500/10 text-rose-300'
                        }`}
                      >
                        {occ}% Occ
                      </span>
                    </div>
                    <div className="text-[10px] text-zinc-400 truncate">{c.targetLabel}</div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Section: Active Visual Invariants (.spectra/invariants.json) */}
        <div className="p-3 rounded-xl bg-zinc-900/50 border border-white/[0.08] space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-zinc-200 flex items-center gap-1.5">
              <FileCode className="w-3.5 h-3.5 text-emerald-400" />
              Active Invariants (.spectra)
            </span>
            <span className="text-[10px] font-mono text-zinc-500">
              {parsedInvariants.length} Rules
            </span>
          </div>

          <div className="space-y-2">
            {parsedInvariants.map((inv) => (
              <div
                key={inv.id}
                className="p-2 rounded-lg bg-black/40 border border-white/[0.04] text-[11px] space-y-1"
              >
                <div className="font-mono text-[10px] text-indigo-300 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                  {inv.id}
                </div>
                <div className="text-zinc-300 font-medium leading-snug">{inv.description}</div>
                {inv.source?.compiled_by && (
                  <div className="text-[9px] text-zinc-500 font-mono">
                    Compiler: {inv.source.compiled_by}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Section: Voice Transcript Audio Telemetry */}
        {Boolean(voiceTranscript?.transcript) && (
          <div className="p-3 rounded-xl bg-zinc-900/50 border border-white/[0.08] space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-zinc-200 flex items-center gap-1.5">
                <Mic className="w-3.5 h-3.5 text-purple-400" />
                Spoken Expectation Turn
              </span>
              <span className="text-[10px] font-mono text-zinc-500">
                {voiceTranscript?.audioDurationMs
                  ? `${(voiceTranscript.audioDurationMs / 1000).toFixed(1)}s`
                  : ''}
              </span>
            </div>

            <p className="text-[11px] text-zinc-300 italic leading-relaxed bg-black/40 p-2 rounded-lg border border-white/[0.04]">
              "{voiceTranscript?.transcript}"
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
