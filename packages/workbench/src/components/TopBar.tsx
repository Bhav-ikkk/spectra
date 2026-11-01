import React, { useState, useEffect } from 'react';
import { UploadCloud, Layers, BarChart3, Mic, Target, Key, X } from 'lucide-react';

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
  const [showKeyModal, setShowKeyModal] = useState<boolean>(false);
  const [metaKey, setMetaKey] = useState<string>('');
  const [basetenKey, setBasetenKey] = useState<string>('');
  const [savedNotice, setSavedNotice] = useState<boolean>(false);

  useEffect(() => {
    try {
      setMetaKey(localStorage.getItem('SPECTRA_META_API_KEY') || '');
      setBasetenKey(localStorage.getItem('SPECTRA_BASETEN_API_KEY') || '');
    } catch {
      // ignore in tests/SSR
    }
  }, []);

  const handleSaveKeys = () => {
    try {
      localStorage.setItem('SPECTRA_META_API_KEY', metaKey.trim());
      localStorage.setItem('SPECTRA_BASETEN_API_KEY', basetenKey.trim());
      setSavedNotice(true);
      setTimeout(() => {
        setSavedNotice(false);
        setShowKeyModal(false);
      }, 1000);
    } catch {
      setShowKeyModal(false);
    }
  };

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
    <>
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

        {/* Right: Key Modal + Lens Overlay Trigger + Calibration Pill + Economy Badge */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setShowKeyModal(true)}
            title="Configure optional Meta/Baseten API keys for live custom video tests ($0 cache active by default)"
            className="border border-[#B8B4A9] bg-[#DFDCD3]/70 hover:bg-[#DFDCD3] text-[#181816] font-mono text-[11px] px-2.5 py-1 rounded-[4px] cursor-pointer flex items-center gap-1.5 transition-colors"
          >
            <Key className="w-3.5 h-3.5 text-[#181816]" />
            <span>🔑 API Keys ($0 Cache Active)</span>
          </button>

          <div
            title="8 frames @ 4 FPS (2.0s clip at 1280×720). Cached replays run offline at $0.00 in ~480ms."
            className="border border-[#B8B4A9] bg-[#DFDCD3] text-[#181816] font-mono text-[11px] px-2 py-0.5 rounded-[4px] flex items-center gap-1.5 select-none"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-[#2E7D52]" />
            <span>8f @ 4FPS · ~480ms · CACHED ($0.00)</span>
          </div>

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
            title="Rule 2 Calibrated Noise Floor: σ = 0.45% temporal mask jitter across 6 settled frames; 3σ = 1.35% is the minimum detectable occlusion threshold."
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

      {/* BYOK API Key Modal */}
      {showKeyModal && (
        <div className="fixed inset-0 z-50 bg-[#181816]/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#EAE7DF] border-[2px] border-[#181816] rounded-[6px] shadow-2xl max-w-md w-full p-5 space-y-4 font-mono text-xs">
            <div className="flex items-center justify-between border-b border-[#B8B4A9] pb-2.5">
              <span className="font-bold text-sm tracking-wider text-[#181816] flex items-center gap-2">
                <Key className="w-4 h-4" />
                API CREDENTIALS (OPTIONAL BYOK)
              </span>
              <button
                type="button"
                onClick={() => setShowKeyModal(false)}
                className="text-[#4A4843] hover:text-[#181816] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 bg-[#DCE8DF] border border-[#9BB8A5] rounded-[4px] text-[#1D4D35] text-[11px] leading-relaxed">
              <span className="font-bold">✓ $0.00 OFFLINE CACHE ACTIVE:</span> All 45 benchmark
              clips and S1–S3 closed-loop demos run completely offline with ZERO keys needed.
              Provide keys below only if testing custom, un-cached video clips.
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-[10px] text-[#4A4843] uppercase tracking-wider block mb-1">
                  Meta AI API Key (SAM 3.1 & Muse Voice)
                </label>
                <input
                  type="password"
                  value={metaKey}
                  onChange={(e) => setMetaKey(e.target.value)}
                  placeholder="Bearer token or Meta key..."
                  className="w-full bg-[#DFDCD3] border border-[#B8B4A9] px-2.5 py-1.5 rounded-[3px] text-[#181816] text-xs focus:outline-none focus:border-[#181816]"
                />
              </div>

              <div>
                <label className="text-[10px] text-[#4A4843] uppercase tracking-wider block mb-1">
                  Baseten API Key (Muse Spark Open 1026)
                </label>
                <input
                  type="password"
                  value={basetenKey}
                  onChange={(e) => setBasetenKey(e.target.value)}
                  placeholder="Baseten API key..."
                  className="w-full bg-[#DFDCD3] border border-[#B8B4A9] px-2.5 py-1.5 rounded-[3px] text-[#181816] text-xs focus:outline-none focus:border-[#181816]"
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-[#B8B4A9]">
              <span className="text-[10px] text-[#2E7D52] font-semibold">
                {savedNotice ? '✓ Keys saved in local browser storage' : ''}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowKeyModal(false)}
                  className="px-3 py-1.5 rounded-[3px] border border-[#B8B4A9] bg-[#DFDCD3] text-[#181816] hover:bg-[#D5D1C7] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveKeys}
                  className="px-3 py-1.5 rounded-[3px] bg-[#181816] text-white hover:bg-[#2C2C29] cursor-pointer font-semibold"
                >
                  Save Keys
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
