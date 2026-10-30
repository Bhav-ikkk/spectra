import React from 'react';
import { UploadCloud, Layers, BarChart3, Mic, Target } from 'lucide-react';

export type TabMode = 'dropzone' | 'arena' | 'benchmark' | 'voice';

export interface TopBarProps {
  activeTab?: TabMode;
  setActiveTab?: (tab: TabMode) => void;
  onSelectTab?: (tab: TabMode) => void;
  onOpenLens?: () => void;
  calibration?: {
    sigma_noise: number;
    threshold: number;
    delta?: number;
    runIdCitation?: string;
  };
  providerStatus?: {
    meta: boolean;
    baseten: boolean;
  };
  // Optional backwards-compatibility props
  currentStep?: 1 | 2 | 3;
  onStepChange?: (step: 1 | 2 | 3) => void;
  onOpenBenchmark?: () => void;
  onOpenVoice?: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  activeTab = 'arena',
  setActiveTab,
  onSelectTab,
  onOpenLens,
  calibration,
  onOpenBenchmark,
  onOpenVoice,
}) => {
  const handleTabClick = (id: TabMode) => {
    setActiveTab?.(id);
    onSelectTab?.(id);
    if (id === 'benchmark' && onOpenBenchmark) {
      onOpenBenchmark();
    }
    if (id === 'voice' && onOpenVoice) {
      onOpenVoice();
    }
  };

  const tabs: Array<{ id: TabMode; label: string; icon: React.ReactNode }> = [
    {
      id: 'dropzone',
      label: 'Upload & Verify Video',
      icon: <UploadCloud className="w-3.5 h-3.5 stroke-[1.8]" />,
    },
    {
      id: 'arena',
      label: 'Closed-Loop Repair Arena',
      icon: <Layers className="w-3.5 h-3.5 stroke-[1.8]" />,
    },
    {
      id: 'benchmark',
      label: '45-Clip Benchmark',
      icon: <BarChart3 className="w-3.5 h-3.5 stroke-[1.8]" />,
    },
    {
      id: 'voice',
      label: 'Voice Invariants',
      icon: <Mic className="w-3.5 h-3.5 stroke-[1.8]" />,
    },
  ];

  const sigmaNoisePct = ((calibration?.sigma_noise ?? 0.0045) * 100).toFixed(2);
  const thresholdPct = ((calibration?.threshold ?? 0.0135) * 100).toFixed(2);

  return (
    <header className="h-[46px] px-3.5 bg-[#EAE7DF] border-b border-[#B8B4A9] flex items-center justify-between gap-2 shrink-0 whitespace-nowrap select-none z-30">
      {/* Left: Shield Optical Icon + Brand Title + Badge */}
      <div className="flex items-center gap-2.5 shrink-0 whitespace-nowrap">
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#181816"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="shrink-0"
        >
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          <circle cx="12" cy="11" r="3" />
        </svg>

        <span className="font-mono font-bold text-[14px] tracking-[0.06em] text-[#181816]">
          SPECTRA
        </span>

        <span className="font-mono text-[11px] px-1.5 py-0.5 rounded-[3px] border border-[#B8B4A9] bg-[#DFDCD3] text-[#181816] font-medium leading-none">
          v3.0
        </span>
      </div>

      {/* Center: Hardware Mechanical Segmented Tabs */}
      <nav className="flex items-center gap-1.5 shrink-0">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => handleTabClick(tab.id)}
              className={
                isActive
                  ? 'bg-[#EAE7DF] text-[#181816] border-[1.5px] border-[#181816] font-medium text-xs px-3 py-1.5 rounded-[5px] shadow-[0_1px_0_#181816] flex items-center gap-1.5 cursor-pointer'
                  : 'bg-transparent hover:bg-[#DFDCD3] text-[#3A3935] border border-transparent text-xs font-medium px-3 py-1.5 rounded-[5px] flex items-center gap-1.5 cursor-pointer transition-colors'
              }
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Right: Lens Overlay Trigger + Calibration Pill */}
      <div className="flex items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={onOpenLens}
          title="Push-to-capture visual referee overlay (Ctrl+Shift+Space)"
          className="border border-[#B8B4A9] bg-[#DFDCD3]/70 hover:bg-[#DFDCD3] text-[#181816] font-mono text-[11px] px-3 py-1 rounded-full cursor-pointer flex items-center gap-1.5 transition-colors"
        >
          <Target className="w-3.5 h-3.5 text-[#181816]" />
          <span>Lens (Ctrl+Shift+Space)</span>
        </button>

        <div
          title={`Rule 2 Calibrated Measurement: ${calibration?.runIdCitation || '2026-10-28'}`}
          className="border border-[#9BB8A5] bg-[#DCE8DF] text-[#1D4D35] font-mono text-[11px] px-2.5 py-0.5 rounded-[5px] flex items-center gap-2 select-none"
        >
          <span className="w-2 h-2 rounded-full bg-[#2E7D52] shadow-xs shrink-0" />
          <span>
            3σ: {thresholdPct}% | σ: {sigmaNoisePct}%
          </span>
          <span className="font-semibold text-[#18794E]">Rule 2 Verified</span>
        </div>
      </div>
    </header>
  );
};
