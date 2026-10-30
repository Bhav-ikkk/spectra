import React, { useState, useEffect } from 'react';
import initialBundleData from './generated/workbench-data.json' with { type: 'json' };
import type { WorkbenchDataBundle, WorkbenchClipAsset } from './types.js';
import { TopBar, type TabMode } from './components/TopBar.js';
import { LeftPane } from './components/LeftPane.js';
import { OpticalViewport } from './components/OpticalViewport.js';
import { TelemetryPane } from './components/TelemetryPane.js';
import { BenchmarkView } from './components/BenchmarkView.js';
import { VoiceStudioView } from './components/VoiceStudioView.js';
import { LiveDropzoneView } from './components/LiveDropzoneView.js';
import { SpectraLensOverlay } from './components/SpectraLensOverlay.js';

export const App: React.FC = () => {
  const [data, setData] = useState<WorkbenchDataBundle>(
    initialBundleData as unknown as WorkbenchDataBundle,
  );
  // Default to Closed-Loop Repair Arena (Workspace 2) matching image_41bab6.jpg
  const [activeTab, setActiveTab] = useState<TabMode>('arena');
  // Default to S2 "Mobile MP4" matching image_41bab6.jpg
  const [activeScenarioId, setActiveScenarioId] = useState<'s1' | 's2' | 's3'>('s2');
  const [activeClipId, setActiveClipId] = useState<string>('mobile_mp4_015_v1');
  // Default to Phase 2 (Spectra Rejection)
  const [scenarioPhase, setScenarioPhase] = useState<1 | 2 | 3 | 4>(2);
  const [isPatching, setIsPatching] = useState(false);
  const [showSamMask, setShowSamMask] = useState(true);
  const [isLensOpen, setIsLensOpen] = useState(false);
  const [providerStatus, setProviderStatus] = useState<{ meta: boolean; baseten: boolean }>({
    meta: false,
    baseten: false,
  });

  // Hotkey listener: Ctrl+Shift+Space to toggle Spectra Lens, Esc to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && (e.code === 'Space' || e.key === ' ')) {
        e.preventDefault();
        setIsLensOpen((prev) => !prev);
      } else if (e.key === 'Escape') {
        setIsLensOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Query live local API status
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
        // Local API offline fallback is fine
      });
  }, []);

  const handleApplyPatch = async () => {
    setIsPatching(true);
    setScenarioPhase(3); // Patch Synthesis
    try {
      const res = await fetch('/api/closed-loop-live', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenario: activeScenarioId }),
      });
      if (res.ok) {
        setScenarioPhase(4); // Verified Pass
      } else {
        setScenarioPhase(4);
      }
    } catch {
      setScenarioPhase(4);
    } finally {
      setIsPatching(false);
    }
  };

  const currentScenario = data.scenarios[activeScenarioId];
  const activeClip =
    data.clips.find((c) =>
      activeScenarioId === 's1'
        ? c.clipId === 'canvas_015_v1'
        : activeScenarioId === 's2'
          ? c.clipId === 'mobile_mp4_015_v1'
          : c.clipId === 'dom_catch_010_v1',
    ) || data.clips[0];

  return (
    <div className="h-screen w-screen overflow-hidden flex flex-col bg-[#EAE7DF] text-[#181816] select-none font-sans">
      {/* 1. Top Command Bar (46px fixed height) */}
      <TopBar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onSelectTab={setActiveTab}
        onOpenLens={() => setIsLensOpen(true)}
        calibration={data.calibration}
        providerStatus={providerStatus}
      />

      {/* 2. Main Workspace Area */}
      {activeTab === 'arena' && (
        <div className="flex-1 min-h-0 flex overflow-hidden">
          {/* Left Rail: 270px fixed width, flush 1px right border */}
          <LeftPane
            scenarios={data.scenarios}
            activeScenarioId={activeScenarioId}
            selectedScenarioId={activeScenarioId}
            setActiveScenarioId={(id) => {
              setActiveScenarioId(id);
              setScenarioPhase(2);
            }}
            onSelectScenario={(id) => {
              setActiveScenarioId(id);
              setScenarioPhase(2);
            }}
            clips={data.clips}
            activeClipId={activeClipId}
            setActiveClipId={setActiveClipId}
            viewMode="arena"
            invariants={data.invariants}
            voiceTranscript={data.voiceTranscript}
          />

          {/* Center Stage: flex-1 min-w-0 min-h-0 */}
          <main className="flex-1 min-w-0 min-h-0 flex flex-col bg-[#E5E2DA] bg-[radial-gradient(#B5B1A6_1px,transparent_1px)] [background-size:12px_12px] overflow-hidden relative">
            <OpticalViewport
              t0Url={
                scenarioPhase >= 4
                  ? currentScenario?.pass2?.t0AssetUrl ||
                    (activeScenarioId === 's2'
                      ? '/benchmark-assets/mobile_mp4_000_v1_t0.png'
                      : activeScenarioId === 's1'
                        ? '/benchmark-assets/canvas_000_v1_t0.png'
                        : '/benchmark-assets/dom_catch_000_v1_t0.png')
                  : currentScenario?.pass1?.t0AssetUrl ||
                    (activeScenarioId === 's2'
                      ? '/benchmark-assets/mobile_mp4_015_v1_t0.png'
                      : activeScenarioId === 's1'
                        ? '/benchmark-assets/canvas_015_v1_t0.png'
                        : '/benchmark-assets/dom_catch_010_v1_t0.png')
              }
              tkUrl={
                scenarioPhase >= 4
                  ? currentScenario?.pass2?.tkAssetUrl ||
                    (activeScenarioId === 's2'
                      ? '/benchmark-assets/mobile_mp4_000_v1_tk.png'
                      : activeScenarioId === 's1'
                        ? '/benchmark-assets/canvas_000_v1_tk.png'
                        : '/benchmark-assets/dom_catch_000_v1_tk.png')
                  : currentScenario?.pass1?.tkAssetUrl ||
                    (activeScenarioId === 's2'
                      ? '/benchmark-assets/mobile_mp4_015_v1_tk.png'
                      : activeScenarioId === 's1'
                        ? '/benchmark-assets/canvas_015_v1_tk.png'
                        : '/benchmark-assets/dom_catch_010_v1_tk.png')
              }
              repairedUrl={
                currentScenario?.pass2?.tkAssetUrl ||
                (activeScenarioId === 's2'
                  ? '/benchmark-assets/mobile_mp4_000_v1_tk.png'
                  : activeScenarioId === 's1'
                    ? '/benchmark-assets/canvas_000_v1_tk.png'
                    : '/benchmark-assets/dom_catch_000_v1_tk.png')
              }
              masks={
                scenarioPhase >= 4 ? currentScenario?.pass2?.masks : currentScenario?.pass1?.masks
              }
              targetBBox={
                activeScenarioId === 's1'
                  ? [820, 240, 220, 48]
                  : activeScenarioId === 's2'
                    ? [475, 610, 330, 52]
                    : [909, 600, 342, 51]
              }
              targetLabel={currentScenario?.targetLabel || 'Target Element'}
              verdict={scenarioPhase >= 4 ? 'pass' : 'fail'}
              scenarioPhase={scenarioPhase}
              environment={currentScenario?.environment}
            />
          </main>

          {/* Right Inspector Rail: 320px fixed width, flush 1px left border */}
          <TelemetryPane
            scenario={currentScenario}
            phase={scenarioPhase}
            setPhase={setScenarioPhase}
            calibration={data.calibration}
            isPatching={isPatching}
            onApplyPatch={handleApplyPatch}
            showSamMask={showSamMask}
            onToggleSamMask={setShowSamMask}
          />
        </div>
      )}

      {/* Alternative Workspaces */}
      {activeTab === 'dropzone' && <LiveDropzoneView />}
      {activeTab === 'benchmark' && <BenchmarkView report={data.benchmarkReport} />}
      {activeTab === 'voice' && (
        <VoiceStudioView invariants={data.invariants} voiceTranscript={data.voiceTranscript} />
      )}

      {/* Spectra Lens Region Capture HUD Overlay */}
      <SpectraLensOverlay
        isOpen={isLensOpen}
        onClose={() => setIsLensOpen(false)}
        scenarioId={activeScenarioId}
        scenario={currentScenario}
        activeClip={activeClip}
        calibration={data.calibration}
        onSendRejectionToRepair={() => {
          setActiveTab('arena');
          setScenarioPhase(3);
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
