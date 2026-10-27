import React from 'react';
import { ShieldCheck, Activity, Layers, BarChart3, Mic, UploadCloud } from 'lucide-react';

export type TabMode = 'arena' | 'benchmark' | 'voice' | 'dropzone';

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
    { id: 'arena', label: 'Closed-Loop Arena', icon: <Layers className="w-3.5 h-3.5" /> },
    { id: 'benchmark', label: '45-Clip Benchmark', icon: <BarChart3 className="w-3.5 h-3.5" /> },
    { id: 'voice', label: 'Voice-to-Invariant', icon: <Mic className="w-3.5 h-3.5" /> },
    { id: 'dropzone', label: 'Live Dropzone', icon: <UploadCloud className="w-3.5 h-3.5" /> },
  ];

  return (
    <header className="h-[52px] w-full bg-[#0D0D11]/90 backdrop-blur-xl border-b border-white/[0.08] flex items-center justify-between px-4 z-50 select-none flex-shrink-0">
      {/* Left: Window Controls + Brand */}
      <div className="flex items-center gap-3">
        {/* macOS Sequoia Traffic Lights */}
        <div className="flex items-center gap-1.5 mr-2">
          <div className="w-3 h-3 rounded-full bg-[#FF5F56] border border-[#E0443E]/50 shadow-sm" />
          <div className="w-3 h-3 rounded-full bg-[#FFBD2E] border border-[#DEA123]/50 shadow-sm" />
          <div className="w-3 h-3 rounded-full bg-[#27C93F] border border-[#1AAB29]/50 shadow-sm" />
        </div>

        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 p-[1px] flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <div className="w-full h-full bg-[#121216] rounded-[7px] flex items-center justify-center">
              <ShieldCheck className="w-4 h-4 text-indigo-400" />
            </div>
          </div>
          <span className="font-bold tracking-tight text-sm text-zinc-100 flex items-center gap-1.5">
            SPECTRA{' '}
            <span className="text-[10px] px-1 py-0.5 rounded bg-indigo-500/20 text-indigo-300 font-mono font-medium">
              V3.0
            </span>
          </span>
          <span className="text-zinc-600 text-xs hidden md:inline">/</span>
          <span className="text-xs text-zinc-400 font-medium hidden lg:inline">
            The Visual Referee for AI Agents
          </span>
        </div>

        <div className="hidden xl:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/[0.04] border border-white/[0.08] text-[11px] text-zinc-400">
          <span className="text-zinc-300 font-medium italic">
            "Don't trust 'done.' Measure it."
          </span>
        </div>
      </div>

      {/* Center: Mode Switcher Tabs */}
      <div className="flex items-center p-0.5 rounded-lg bg-black/40 border border-white/[0.06]">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                isActive
                  ? 'bg-zinc-800/90 text-white shadow-sm border border-white/10'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.02]'
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Right: Calibration Telemetry Pill + API Beacon + Spectra Lens */}
      <div className="flex items-center gap-2.5">
        {/* Spectra Lens Trigger Pill */}
        <button
          onClick={onOpenLens}
          className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 text-xs font-mono transition-all shadow-sm group active:scale-95"
          title="Push-to-capture visual referee overlay (Ctrl+Shift+Space)"
        >
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500" />
          </span>
          <span className="font-semibold text-white group-hover:text-rose-200">Spectra Lens</span>
          <kbd className="hidden sm:inline-block px-1.5 py-0.2 rounded bg-black/50 text-[10px] text-zinc-400 font-sans border border-white/10">
            Ctrl+Shift+Space
          </kbd>
        </button>

        {/* Rule 2 Calibrated Badge */}
        <div
          title={calibration.runIdCitation}
          className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-emerald-950/40 border border-emerald-500/30 text-emerald-300 text-xs font-mono shadow-sm cursor-help"
        >
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
          </span>
          <span className="hidden sm:inline">
            σ:{' '}
            <span className="font-semibold text-white">
              {(calibration.sigma_noise * 100).toFixed(2)}%
            </span>
          </span>
          <span className="text-emerald-700 hidden sm:inline">|</span>
          <span>
            3σ Thresh:{' '}
            <span className="font-semibold text-white">
              {(calibration.threshold * 100).toFixed(2)}%
            </span>
          </span>
          <span className="text-emerald-700 hidden md:inline">|</span>
          <span className="hidden md:inline">
            Δ Limit:{' '}
            <span className="font-semibold text-white">
              {(calibration.delta * 100).toFixed(2)}%
            </span>
          </span>
          <span className="px-1 py-0.2 rounded bg-emerald-500/20 text-[10px] text-emerald-200 font-sans font-medium hidden lg:inline">
            Rule 2 Verified
          </span>
        </div>

        {/* Live Provider Indicator */}
        <div className="hidden 2xl:flex items-center gap-1.5 px-2 py-1 rounded-md bg-white/[0.03] border border-white/[0.06] text-[11px] text-zinc-400 font-mono">
          <Activity className="w-3 h-3 text-cyan-400" />
          <span>SAM 3.1</span>
          <span
            className={`w-1.5 h-1.5 rounded-full ${providerStatus?.meta ? 'bg-cyan-400' : 'bg-zinc-600'}`}
          />
          <span className="text-zinc-600">|</span>
          <span>Baseten</span>
          <span
            className={`w-1.5 h-1.5 rounded-full ${providerStatus?.baseten ? 'bg-purple-400' : 'bg-zinc-600'}`}
          />
        </div>
      </div>
    </header>
  );
};
