import React from 'react';
import { BarChart3, Mic, Eye, Check } from 'lucide-react';

export type WizardStep = 1 | 2 | 3;
export type TabMode = 'dropzone' | 'arena' | 'benchmark' | 'voice';

export interface TopBarProps {
  currentStep: WizardStep;
  onStepChange: (step: WizardStep) => void;
  onOpenBenchmark: () => void;
  onOpenVoice: () => void;
  onOpenLens: () => void;
  calibration?: {
    sigma_noise: number;
    threshold: number;
    delta: number;
    runIdCitation: string;
  };
  providerStatus?: {
    meta: boolean;
    baseten: boolean;
  };
  // Optional legacy props for backward compatibility
  activeTab?: TabMode;
  setActiveTab?: (tab: TabMode) => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  currentStep,
  onStepChange,
  onOpenBenchmark,
  onOpenVoice,
  onOpenLens,
  calibration,
}) => {
  const steps: Array<{ step: WizardStep; label: string; shortLabel: string }> = [
    { step: 1, label: 'Step 1 · Select or Upload Clip', shortLabel: '1 · Select Clip' },
    { step: 2, label: 'Step 2 · Optical Scan & Catch', shortLabel: '2 · Optical Scan' },
    { step: 3, label: 'Step 3 · Auto-Patch & Verify', shortLabel: '3 · Auto-Patch' },
  ];

  return (
    <header className="h-14 w-full px-6 border-b border-white/[0.08] bg-[#090A0C]/90 backdrop-blur-xl sticky top-0 z-40 flex items-center justify-between select-none shrink-0">
      {/* Left: macOS Window Controls & Title */}
      <div className="flex items-center gap-3 shrink-0">
        <div className="flex items-center gap-1.5" aria-hidden="true">
          <div className="w-3 h-3 rounded-full bg-[#FF5F56] border border-[#E0443E]/60 shadow-xs" />
          <div className="w-3 h-3 rounded-full bg-[#FFBD2E] border border-[#DEA123]/60 shadow-xs" />
          <div className="w-3 h-3 rounded-full bg-[#27C93F] border border-[#1AAB29]/60 shadow-xs" />
        </div>

        <div className="flex items-center gap-2 ml-1">
          <span className="text-base font-semibold tracking-tight text-[#F5F5F7]">Spectra</span>
          <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-white/[0.06] text-[#86868B] border border-white/[0.08]">
            Visual Referee
          </span>
        </div>
      </div>

      {/* Center: Interactive 3-Step Segmented Stepper */}
      <nav
        aria-label="Wizard Steps"
        className="flex items-center p-1 rounded-xl bg-[#171A21] border border-white/[0.08] shadow-inner"
      >
        {steps.map(({ step, label, shortLabel }) => {
          const isActive = currentStep === step;
          const isCompleted = currentStep > step;

          return (
            <button
              key={step}
              type="button"
              onClick={() => onStepChange(step)}
              className={`relative flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all duration-150 active:scale-[0.98] cursor-pointer whitespace-nowrap ${
                isActive
                  ? 'bg-[#0071E3] text-white shadow-sm'
                  : isCompleted
                    ? 'text-[#F5F5F7] hover:bg-white/[0.06]'
                    : 'text-[#86868B] hover:text-[#F5F5F7] hover:bg-white/[0.04]'
              }`}
            >
              {isCompleted ? (
                <Check className="w-3 h-3 text-[#30D158] stroke-[2.5]" />
              ) : (
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    isActive ? 'bg-white' : 'bg-white/20'
                  }`}
                />
              )}
              <span className="hidden md:inline">{label}</span>
              <span className="md:hidden">{shortLabel}</span>
            </button>
          );
        })}
      </nav>

      {/* Right: Modals & Tool Triggers */}
      <div className="flex items-center gap-2 shrink-0">
        {/* Benchmark Data Modal Trigger */}
        <button
          type="button"
          onClick={onOpenBenchmark}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.10] border border-white/[0.08] text-xs font-medium text-[#F5F5F7] active:scale-[0.98] transition-all cursor-pointer"
        >
          <BarChart3 className="w-3.5 h-3.5 text-[#0071E3]" />
          <span className="hidden lg:inline">Benchmark Data (45 Clips)</span>
          <span className="lg:hidden">Benchmark</span>
        </button>

        {/* Voice Rule Modal Trigger */}
        <button
          type="button"
          onClick={onOpenVoice}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.10] border border-white/[0.08] text-xs font-medium text-[#F5F5F7] active:scale-[0.98] transition-all cursor-pointer"
        >
          <Mic className="w-3.5 h-3.5 text-[#30D158]" />
          <span>Voice Rule</span>
        </button>

        {/* Lens Trigger */}
        <button
          type="button"
          onClick={onOpenLens}
          title="Spectra Lens Push-to-Capture (Ctrl+Shift+Space)"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.10] border border-white/[0.08] text-xs font-medium text-[#F5F5F7] active:scale-[0.98] transition-all cursor-pointer"
        >
          <Eye className="w-3.5 h-3.5 text-[#38BDF8]" />
          <span>Lens</span>
          <kbd className="hidden xl:inline-block px-1.5 py-0.2 rounded bg-white/[0.06] text-[10px] text-[#86868B] font-mono border border-white/[0.08]">
            Ctrl+Shift+Space
          </kbd>
        </button>

        {/* Subtle Rule 2 Noise Floor Indicator */}
        {calibration && (
          <div
            title={`Rule 2 Measured Calibration: ${calibration.runIdCitation}`}
            className="hidden 2xl:flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-[#171A21] border border-white/[0.08] text-[11px] font-mono text-[#86868B]"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-[#30D158]" />
            <span>3σ: {(calibration.threshold * 100).toFixed(2)}%</span>
          </div>
        )}
      </div>
    </header>
  );
};
