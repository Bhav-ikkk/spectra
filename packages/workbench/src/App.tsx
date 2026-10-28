import React, { useState, useEffect } from 'react';
import initialBundleData from './generated/workbench-data.json' with { type: 'json' };
import type { WorkbenchDataBundle } from './types.js';
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
  const [activeTab, setActiveTab] = useState<TabMode>('dropzone'); // Default to Live Video Upload (Workspace 1)
  const [activeScenarioId, setActiveScenarioId] = useState<'s1' | 's2' | 's3'>('s3'); // Default to S3 "The Catch"
  const [activeClipId, setActiveClipId] = useState<string>('dom_catch_010_v1');
  const [scenarioPhase, setScenarioPhase] = useState<1 | 2 | 3 | 4>(2); // Default to Phase 2 (Spectra Rejection)
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

  const currentScenario = data.scenarios[activeScenarioId];
  const activeClip = data.clips.find((c) => c.clipId === activeClipId) || data.clips[0];

  return (
    <div className="w-full h-screen flex flex-col bg-paper-base text-ink-primary overflow-hidden select-none font-sans">
      {/* Top Command Bar (48px) */}
      <TopBar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        calibration={data.calibration}
        providerStatus={providerStatus}
        onOpenLens={() => setIsLensOpen(true)}
      />

      {/* Main Workspace Area */}
      <main className="flex-1 w-full flex overflow-hidden min-h-0">
        {/* WORKSPACE 1: Upload & Verify Video (Live Studio) */}
        {activeTab === 'dropzone' && <LiveDropzoneView />}

        {/* WORKSPACE 2: Closed-Loop Repair Arena (S1 / S2 / S3) */}
        {activeTab === 'arena' && (
          <>
            {/* Left Column (280px Fixed) */}
            <LeftPane
              scenarios={data.scenarios}
              activeScenarioId={activeScenarioId}
              setActiveScenarioId={(id) => {
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

            {/* Center Viewport Stage + 3-State Target Zoom Loupe */}
            <OpticalViewport
              t0Url={
                currentScenario?.pass1?.t0AssetUrl || '/benchmark-assets/dom_catch_010_v1_t0.png'
              }
              tkUrl={
                currentScenario?.pass1?.tkAssetUrl || '/benchmark-assets/dom_catch_010_v1_tk.png'
              }
              repairedUrl={
                currentScenario?.pass2?.tkAssetUrl || '/benchmark-assets/dom_catch_000_v1_tk.png'
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

            {/* Right Telemetry Column (320px Fixed) */}
            <TelemetryPane
              scenario={currentScenario}
              phase={scenarioPhase}
              setPhase={setScenarioPhase}
              calibration={data.calibration}
            />
          </>
        )}

        {/* WORKSPACE 3: 45-Clip Referee Benchmark */}
        {activeTab === 'benchmark' && (
          <>
            <LeftPane
              scenarios={data.scenarios}
              activeScenarioId={activeScenarioId}
              setActiveScenarioId={setActiveScenarioId}
              clips={data.clips}
              activeClipId={activeClipId}
              setActiveClipId={setActiveClipId}
              viewMode="benchmark"
              invariants={data.invariants}
              voiceTranscript={data.voiceTranscript}
            />

            <BenchmarkView report={data.benchmarkReport} />
          </>
        )}

        {/* WORKSPACE 4: Voice Invariants Studio */}
        {activeTab === 'voice' && (
          <VoiceStudioView
            invariants={data.invariants}
            voiceTranscript={data.voiceTranscript}
          />
        )}
      </main>

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
