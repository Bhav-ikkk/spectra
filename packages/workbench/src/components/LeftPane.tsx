import React, { useState } from 'react';
import { Layers, Layout, Monitor, Smartphone, Search, FileCode } from 'lucide-react';
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

export const LeftPane: React.FC<LeftPaneProps> = ({
  activeScenarioId,
  setActiveScenarioId,
  clips,
  activeClipId,
  setActiveClipId,
  viewMode,
  invariants,
}) => {
  const [occlusionFilter, setOcclusionFilter] = useState<number | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const scenarioList: Array<{
    id: 's1' | 's2' | 's3';
    code: string;
    title: string;
    description: string;
    loss: string;
    env: string;
    icon: React.ReactNode;
  }> = [
    {
      id: 's3',
      code: 'S3',
      title: 'Sticky Cart Drawer ("The Catch")',
      description: '10.0% bottom-edge clip where DOM center hit-test (1080, 625) & VLM false-pass.',
      loss: '10.0% Edge',
      env: 'DOM Catch',
      icon: <Layout className="w-3.5 h-3.5 text-signal-cool" />,
    },
    {
      id: 's1',
      code: 'S1',
      title: 'HTML5 Canvas Collision',
      description: '15.0% tooltip collision inside a single <canvas> element with 0 DOM child nodes.',
      loss: '15.0% Collision',
      env: 'Canvas',
      icon: <Monitor className="w-3.5 h-3.5 text-signal-amber" />,
    },
    {
      id: 's2',
      code: 'S2',
      title: 'Raw Mobile MP4 Recording',
      description: '15.0% bottom-sheet overlap on "Pay $149.00" with no browser DOM.',
      loss: '15.0% Overlap',
      env: 'Mobile MP4',
      icon: <Smartphone className="w-3.5 h-3.5 text-signal-emerald" />,
    },
  ];

  const filteredClips = clips.filter((c) => {
    if (occlusionFilter !== 'all' && c.groundTruthOcclusion !== occlusionFilter) return false;
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

  const parsedInvariants = invariants?.invariants || [];

  return (
    <aside className="w-72 shrink-0 h-full bg-paper-base border-r border-rule-border flex flex-col justify-between overflow-y-auto min-h-0 select-none">
      <div className="divide-y divide-rule-border">
        {/* Header Bar */}
        <div className="h-10 px-3 bg-paper-surface flex items-center justify-between shrink-0 whitespace-nowrap">
          <div className="flex items-center gap-1.5 text-xs font-medium text-ink-primary">
            <Layers className="w-3.5 h-3.5 text-signal-cool" />
            <span className="whitespace-nowrap">
              {viewMode === 'arena' ? 'Repair Scenarios' : 'Benchmark Clips'}
            </span>
          </div>
          <span className="text-[10px] font-mono text-ink-muted">
            {viewMode === 'arena' ? '3 Available' : `${filteredClips.length} Clips`}
          </span>
        </div>

        {/* ARENA MODE: 3 Zero-DOM / Edge-Clip Scenarios */}
        {viewMode === 'arena' && (
          <div className="divide-y divide-rule-border">
            {scenarioList.map((sc) => {
              const isSelected = activeScenarioId === sc.id;
              return (
                <button
                  key={sc.id}
                  onClick={() => setActiveScenarioId(sc.id)}
                  className={`w-full text-left p-3 transition-colors ${
                    isSelected
                      ? 'bg-paper-surface border-l-2 border-l-signal-cool'
                      : 'bg-paper-base hover:bg-paper-surface/60 border-l-2 border-l-transparent'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-1.5">
                      {sc.icon}
                      <span className="text-xs font-semibold text-ink-primary font-mono">
                        {sc.code}
                      </span>
                      <span className="text-[10px] font-mono text-ink-muted">· {sc.env}</span>
                    </div>
                    <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-signal-vermilion/10 text-signal-vermilion border border-signal-vermilion/30">
                      {sc.loss}
                    </span>
                  </div>
                  <div className="text-[11px] font-medium text-ink-primary mb-1">
                    {sc.title}
                  </div>
                  <div className="text-[10px] text-ink-muted leading-tight">
                    {sc.description}
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* BENCHMARK MODE: Filter & List of 45 Clips */}
        {viewMode === 'benchmark' && (
          <div className="p-3 space-y-2 bg-paper-base">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-ink-muted absolute left-2 top-2" />
              <input
                type="text"
                placeholder="Search clips..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-paper-well border border-rule-border rounded pl-7 pr-2 py-1 text-xs text-ink-primary font-mono outline-none focus:border-rule-active"
              />
            </div>

            <div className="flex flex-wrap gap-1 pt-1">
              {(['all', 0, 0.05, 0.1, 0.15, 0.25, 0.4, 0.6] as const).map((lvl) => (
                <button
                  key={String(lvl)}
                  onClick={() => setOcclusionFilter(lvl)}
                  className={`px-1.5 py-0.5 rounded text-[10px] font-mono border transition-colors whitespace-nowrap ${
                    occlusionFilter === lvl
                      ? 'bg-paper-surface border-rule-active text-ink-primary'
                      : 'bg-paper-well border-rule-border text-ink-muted hover:text-ink-primary'
                  }`}
                >
                  {lvl === 'all' ? 'All' : `${(lvl * 100).toFixed(0)}%`}
                </button>
              ))}
            </div>

            <div className="divide-y divide-rule-border border border-rule-border rounded bg-paper-well max-h-96 overflow-y-auto">
              {filteredClips.map((clip) => {
                const isSelected = activeClipId === clip.clipId;
                return (
                  <button
                    key={clip.clipId}
                    onClick={() => setActiveClipId(clip.clipId)}
                    className={`w-full text-left p-2 transition-colors flex items-center justify-between text-xs ${
                      isSelected
                        ? 'bg-paper-surface text-ink-primary'
                        : 'text-ink-muted hover:text-ink-primary hover:bg-paper-surface/40'
                    }`}
                  >
                    <div className="truncate pr-2">
                      <div className="font-mono text-[11px] text-ink-primary truncate">
                        {clip.clipId}
                      </div>
                      <div className="text-[10px] text-ink-muted truncate">
                        {clip.targetLabel}
                      </div>
                    </div>
                    <span className="font-mono text-[10px] px-1 py-0.2 rounded bg-paper-base border border-rule-border text-signal-cool shrink-0">
                      {(clip.groundTruthOcclusion * 100).toFixed(0)}%
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Active Contract Summary (.spectra/invariants.json) */}
        <div className="p-3 bg-paper-well space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono text-ink-muted flex items-center gap-1">
              <FileCode className="w-3 h-3 text-signal-cool" />
              <span>.spectra/invariants.json</span>
            </span>
            <span className="text-[9px] font-mono text-signal-emerald">Active Contract</span>
          </div>
          <div className="p-2 rounded bg-paper-base border border-rule-border text-[10px] font-mono text-ink-muted space-y-1">
            <div className="text-ink-primary font-medium truncate">
              {parsedInvariants[0]?.id || 'inv_checkout_visible'}
            </div>
            <div className="truncate text-ink-muted">
              Target: {parsedInvariants[0]?.matcher?.target || 'Complete Checkout'}
            </div>
            <div className="text-signal-cool text-[9px]">
              Compiler: {parsedInvariants[0]?.source?.compiled_by || 'muse-spark-1.3'}
            </div>
          </div>
        </div>
      </div>

      {/* Footer Info */}
      <div className="p-2.5 border-t border-rule-border bg-paper-base text-[10px] font-mono text-ink-muted flex items-center justify-between">
        <span>Spectra Referee</span>
        <span className="text-signal-emerald">Zero-DOM Verified</span>
      </div>
    </aside>
  );
};
