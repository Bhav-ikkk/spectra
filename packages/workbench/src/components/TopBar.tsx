import React from 'react';
import { ShieldCheck, Layers, BarChart3, Mic, UploadCloud, Eye } from 'lucide-react';

export type TabMode = 'dropzone' | 'arena' | 'benchmark' | 'voice';

interface TopBarProps {
  activeTab: TabMode;
  setActiveTab: (tab: TabMode) => void;
  calibration: {
    sigma_noise: number;
    threshold: number;
    delta: number;
    runIdCitation: string;
  };
  providerStatus?: {
    meta: boolean;
    baseten: boolean;
  };
  onOpenLens?: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  activeTab,
  setActiveTab,
  calibration,
  providerStatus,
  onOpenLens,
}) => {
  const tabs: Array<{ id: TabMode; label: string; icon: React.ReactNode }> = [
    { id: 'dropzone', label: 'Upload & Verify Video', icon: <UploadCloud className="w-3.5 h-3.5" /> },
    { id: 'arena', label: 'Closed-Loop Repair Arena', icon: <Layers className="w-3.5 h-3.5" /> },
    { id: 'benchmark', label: '45-Clip Benchmark', icon: <BarChart3 className="w-3.5 h-3.5" /> },
    { id: 'voice', label: 'Voice Invariants', icon: <Mic className="w-3.5 h-3.5" /> },
  ];

  return (
    <header className="h-12 w-full bg-paper-base border-b border-rule-border flex items-center justify-between px-3 z-50 select-none shrink-0 overflow-x-clip whitespace-nowrap">
      {/* Left: Brand Identity & Subhead (Single Line, Never Wraps) */}
      <div className="flex items-center gap-2.5 shrink-0 whitespace-nowrap">
        <div className="w-6 h-6 rounded bg-paper-surface border border-rule-border flex items-center justify-center shrink-0">
          <ShieldCheck className="w-3.5 h-3.5 text-signal-cool" />
        </div>
        <div className="flex items-center gap-1.5 shrink-0 text-xs">
          <span className="font-semibold text-ink-primary">Spectra</span>
          <span className="px-1 py-0.2 rounded bg-paper-surface border border-rule-border text-ink-muted font-mono text-[10px]">
            v3.0
          </span>
          <span className="text-rule-active text-xs">/</span>
          <span className="text-ink-muted text-xs font-normal hidden md:inline">
            Visual Referee for AI Agents
          </span>
        </div>
      </div>

      {/* Center: 4 Workspaces Tabs (Single Line, Hallmark Restrained) */}
      <nav className="flex items-center gap-1 bg-paper-well p-0.5 rounded border border-rule-border shrink-0 whitespace-nowrap">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs transition-colors shrink-0 whitespace-nowrap ${
                isActive
                  ? 'bg-paper-surface text-ink-primary border border-rule-active font-medium'
                  : 'text-ink-muted hover:text-ink-primary border border-transparent'
              }`}
            >
              {tab.icon}
              <span className="whitespace-nowrap">{tab.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Right: Rule 2 Calibration Citation + Spectra Lens Trigger */}
      <div className="flex items-center gap-2 shrink-0 whitespace-nowrap">
        {/* Spectra Lens Trigger */}
        <button
          onClick={onOpenLens}
          className="flex items-center gap-1.5 px-2 py-1 rounded bg-paper-surface hover:bg-obsidian-800 border border-rule-border hover:border-rule-active text-xs text-ink-primary font-mono transition-colors shrink-0 whitespace-nowrap"
          title="Push-to-capture visual referee overlay (Ctrl+Shift+Space)"
        >
          <Eye className="w-3 h-3 text-signal-cool" />
          <span className="whitespace-nowrap">Lens</span>
          <kbd className="hidden lg:inline-block px-1 py-0.2 rounded bg-paper-well text-[9px] text-ink-muted border border-rule-border whitespace-nowrap">
            Ctrl+Shift+Space
          </kbd>
        </button>

        {/* Rule 2 Calibrated Readout */}
        <div
          title={`Rule 2 Calibrated Measurement: ${calibration.runIdCitation}`}
          className="flex items-center gap-2 px-2.5 py-1 rounded bg-paper-well border border-rule-border text-ink-muted text-[11px] font-mono shrink-0 whitespace-nowrap"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-signal-emerald shrink-0" />
          <span className="hidden sm:inline">
            3σ: <span className="text-ink-primary font-semibold">{(calibration.threshold * 100).toFixed(2)}%</span>
          </span>
          <span className="text-rule-border hidden md:inline">|</span>
          <span className="hidden md:inline">
            σ: <span className="text-ink-primary">{(calibration.sigma_noise * 100).toFixed(2)}%</span>
          </span>
          <span className="text-rule-border hidden lg:inline">|</span>
          <span className="hidden lg:inline">
            Δ: <span className="text-ink-primary">{(calibration.delta * 100).toFixed(2)}%</span>
          </span>
        </div>

        {/* SAM 3.1 & Model Indicators */}
        <div className="hidden xl:flex items-center gap-2 px-2 py-1 rounded bg-paper-well border border-rule-border text-[10px] text-ink-muted font-mono shrink-0 whitespace-nowrap">
          <span className="flex items-center gap-1">
            <span
              className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                providerStatus?.meta ? 'bg-signal-emerald' : 'bg-rule-active'
              }`}
            />
            <span>SAM 3.1</span>
          </span>
          <span className="text-rule-border">/</span>
          <span className="flex items-center gap-1">
            <span
              className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                providerStatus?.baseten ? 'bg-signal-emerald' : 'bg-rule-active'
              }`}
            />
            <span>Spark</span>
          </span>
        </div>
      </div>
    </header>
  );
};
