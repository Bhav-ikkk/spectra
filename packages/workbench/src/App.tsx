import React, { useState, useEffect } from 'react';
import initialBundleData from './generated/workbench-data.json' with { type: 'json' };
import type { WorkbenchDataBundle, WorkbenchClipAsset } from './types.js';
import { TopBar, type WizardStep } from './components/TopBar.js';
import { Step1SelectClip, type UploadedClipData } from './components/Step1SelectClip.js';
import { Step2OpticalScan } from './components/Step2OpticalScan.js';
import { Step3VerifyFix } from './components/Step3VerifyFix.js';
import { BenchmarkView } from './components/BenchmarkView.js';
import { VoiceStudioView } from './components/VoiceStudioView.js';
import { SpectraLensOverlay } from './components/SpectraLensOverlay.js';
import type { LiveVideoVerifyApiResponse } from './server/api-middleware.js';

export const App: React.FC = () => {
  const [data, setData] = useState<WorkbenchDataBundle>(
    initialBundleData as unknown as WorkbenchDataBundle,
  );

  // 3-Step Wizard Flow State
  const [currentStep, setCurrentStep] = useState<WizardStep>(1);
  const [activeScenarioId, setActiveScenarioId] = useState<
    's1' | 's2' | 's3' | 'custom' | 'control'
  >('s3');
  const [targetLabel, setTargetLabel] = useState<string>('Complete Checkout');

  // Dynamic Scan & Repair States
  const [liveVerifyResult, setLiveVerifyResult] = useState<LiveVideoVerifyApiResponse | null>(null);
  const [closedLoopResult, setClosedLoopResult] = useState<{
    closedLoopSuccess?: boolean;
    pass2RenderedDataUrl?: string;
    pass2DataUrl?: string;
    summary?: Record<string, unknown>;
  } | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [isPatching, setIsPatching] = useState(false);

  // Modals & Overlays
  const [isBenchmarkOpen, setIsBenchmarkOpen] = useState(false);
  const [isVoiceOpen, setIsVoiceOpen] = useState(false);
  const [isLensOpen, setIsLensOpen] = useState(false);

  // Provider status query
  const [providerStatus, setProviderStatus] = useState<{ meta: boolean; baseten: boolean }>({
    meta: false,
    baseten: false,
  });

  // Global hotkeys: Ctrl+Shift+Space for Lens, Escape to dismiss modals
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && (e.code === 'Space' || e.key === ' ')) {
        e.preventDefault();
        setIsLensOpen((prev) => !prev);
      } else if (e.key === 'Escape') {
        setIsBenchmarkOpen(false);
        setIsVoiceOpen(false);
        setIsLensOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Check local API status
  useEffect(() => {
    fetch('/api/status')
      .then((res) => (res.ok ? res.json() : null))
      .then((status) => {
        if (status?.providers) {
          setProviderStatus({
            meta: Boolean(status.providers.meta?.available),
            baseten: Boolean(status.providers.baseten?.available),
          });
        }
      })
      .catch(() => {
        // Offline fixture fallback is always available
      });
  }, []);

  // Handle Scenario Selection from Step 1
  const handleSelectScenario = (id: 's1' | 's2' | 's3') => {
    setActiveScenarioId(id);
    setLiveVerifyResult(null);
    setClosedLoopResult(null);
    if (id === 's1') {
      setTargetLabel('Revenue Series Legend');
    } else if (id === 's2') {
      setTargetLabel('Pay $149.00');
    } else {
      setTargetLabel('Complete Checkout');
    }
    setCurrentStep(2);
  };

  // Handle Clean Control Scenario Selection
  const handleSelectCleanControl = () => {
    setActiveScenarioId('control');
    setLiveVerifyResult(null);
    setClosedLoopResult(null);
    setTargetLabel('Revenue Series Legend');
    setCurrentStep(2);
  };

  // Handle Custom MP4 Upload Verification
  const handleRunCustomScan = async (clipData: UploadedClipData) => {
    setIsScanning(true);
    try {
      const res = await fetch('/api/verify-live', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videoBase64: clipData.videoBase64,
          videoFileName: clipData.videoFileName,
          targetLabel: clipData.targetLabel,
        }),
      });

      if (res.ok) {
        const verifyJson = (await res.json()) as LiveVideoVerifyApiResponse;
        setLiveVerifyResult(verifyJson);
        setActiveScenarioId('custom');
        setTargetLabel(clipData.targetLabel);
        setCurrentStep(2);
      } else {
        // If API fails or backend offline, fall back to S3 demonstration
        setActiveScenarioId('s3');
        setCurrentStep(2);
      }
    } catch {
      setActiveScenarioId('s3');
      setCurrentStep(2);
    } finally {
      setIsScanning(false);
    }
  };

  // Handle Auto-Patch & Verify (Transitions Step 2 -> Step 3)
  const handleProceedToStep3 = async () => {
    setIsPatching(true);
    try {
      const scenarioTarget =
        activeScenarioId === 's1' || activeScenarioId === 's2' || activeScenarioId === 's3'
          ? activeScenarioId
          : 's3';

      const res = await fetch('/api/closed-loop-live', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenario: scenarioTarget }),
      });

      if (res.ok) {
        const patchJson = await res.json();
        setClosedLoopResult(patchJson);
      }
    } catch {
      // Use preloaded scenario pass2 bundle data
    } finally {
      setIsPatching(false);
      setCurrentStep(3);
    }
  };

  // Resolve current scenario / clip
  const currentScenario =
    activeScenarioId === 's1'
      ? data.scenarios.s1
      : activeScenarioId === 's2'
        ? data.scenarios.s2
        : data.scenarios.s3;

  const activeClip: WorkbenchClipAsset =
    data.clips.find((c) =>
      activeScenarioId === 's1'
        ? c.clipId === 'canvas_015_v1'
        : activeScenarioId === 's2'
          ? c.clipId === 'mobile_mp4_015_v1'
          : c.clipId === 'dom_catch_010_v1',
    ) || data.clips[0];

  return (
    <div className="w-full h-screen flex flex-col bg-[#090A0C] text-[#F5F5F7] overflow-hidden select-none font-sans">
      {/* Apple-Style Translucent Header with 3-Step Wizard Navigation */}
      <TopBar
        currentStep={currentStep}
        onStepChange={(step) => setCurrentStep(step)}
        onOpenBenchmark={() => setIsBenchmarkOpen(true)}
        onOpenVoice={() => setIsVoiceOpen(true)}
        onOpenLens={() => setIsLensOpen(true)}
        calibration={data.calibration}
        providerStatus={providerStatus}
      />

      {/* Main Wizard Stage (Spacious, Zero-Cramp Layout) */}
      <main className="flex-1 w-full overflow-y-auto min-h-0 bg-[#090A0C]">
        {/* STEP 1: Select or Upload Screen Recording */}
        {currentStep === 1 && (
          <Step1SelectClip
            onSelectScenario={handleSelectScenario}
            onSelectCleanControl={handleSelectCleanControl}
            onRunCustomScan={handleRunCustomScan}
            targetLabel={targetLabel}
            setTargetLabel={setTargetLabel}
            isScanning={isScanning}
          />
        )}

        {/* STEP 2: Optical Scan & Defect Catch */}
        {currentStep === 2 && (
          <Step2OpticalScan
            scenarioId={activeScenarioId}
            scenario={currentScenario}
            clip={activeClip}
            liveVerifyResult={liveVerifyResult}
            targetLabel={targetLabel}
            onBackToStep1={() => setCurrentStep(1)}
            onProceedToStep3={handleProceedToStep3}
            isPatching={isPatching}
          />
        )}

        {/* STEP 3: Auto-Patch & Closed-Loop Verification */}
        {currentStep === 3 && (
          <Step3VerifyFix
            scenarioId={activeScenarioId}
            scenario={currentScenario}
            targetLabel={targetLabel}
            onBackToScan={() => setCurrentStep(2)}
            onVerifyAnother={() => {
              setLiveVerifyResult(null);
              setClosedLoopResult(null);
              setCurrentStep(1);
            }}
            closedLoopResult={closedLoopResult}
          />
        )}
      </main>

      {/* Benchmark Data Modal */}
      {isBenchmarkOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-8 bg-black/75 backdrop-blur-md animate-fade-in"
          onClick={() => setIsBenchmarkOpen(false)}
        >
          <div
            className="w-full max-w-6xl max-h-[92vh] bg-[#111318] border border-white/10 rounded-2xl overflow-hidden shadow-2xl flex flex-col animate-scale-in"
            onClick={(e) => e.stopPropagation()}
          >
            <BenchmarkView
              report={data.benchmarkReport}
              onClose={() => setIsBenchmarkOpen(false)}
            />
          </div>
        </div>
      )}

      {/* Voice Rule Studio Modal */}
      {isVoiceOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-8 bg-black/75 backdrop-blur-md animate-fade-in"
          onClick={() => setIsVoiceOpen(false)}
        >
          <div
            className="w-full max-w-5xl max-h-[90vh] bg-[#111318] border border-white/10 rounded-2xl overflow-hidden shadow-2xl flex flex-col animate-scale-in"
            onClick={(e) => e.stopPropagation()}
          >
            <VoiceStudioView
              invariants={data.invariants}
              voiceTranscript={data.voiceTranscript}
              onClose={() => setIsVoiceOpen(false)}
            />
          </div>
        </div>
      )}

      {/* Spectra Lens Region Capture Overlay (Ctrl+Shift+Space) */}
      <SpectraLensOverlay
        isOpen={isLensOpen}
        onClose={() => setIsLensOpen(false)}
        scenarioId={
          activeScenarioId === 's1' || activeScenarioId === 's2' || activeScenarioId === 's3'
            ? activeScenarioId
            : 's3'
        }
        scenario={currentScenario}
        activeClip={activeClip}
        calibration={data.calibration}
        onSendRejectionToRepair={() => {
          setIsLensOpen(false);
          handleProceedToStep3();
        }}
        onInvariantSaved={(newInv) => {
          setData((prev) => ({
            ...prev,
            invariants: {
              ...prev.invariants,
              invariants: [
                ...((prev.invariants as { invariants?: Array<Record<string, unknown>> })
                  ?.invariants || []),
                newInv,
              ],
            },
          }));
        }}
      />
    </div>
  );
};

export default App;
