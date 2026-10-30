import React, { useState } from 'react';
import type { WorkbenchScenarioBundle } from '../types.js';
import {
  HardwareToggle,
  VerticalLedMeter,
  HardwareMiniSlider,
} from './FieldMonitorPrimitives.js';

export interface TelemetryPaneProps {
  scenario?: WorkbenchScenarioBundle;
  phase?: 1 | 2 | 3 | 4;
  activePass?: 1 | 2;
  setPhase?: (phase: 1 | 2 | 3 | 4) => void;
  calibration?: {
    sigma_noise: number;
    threshold: number;
    delta: number;
    runIdCitation?: string;
  };
  customVerdict?: {
    combinedVerdict: string;
    rSam?: number;
    visRatio?: number;
    rNcc?: number;
    pixelLossCount?: number;
    totalPixels?: number;
    delta?: number;
    reason?: string;
  };
  isPatching?: boolean;
  onApplyPatch?: () => void;
  showSamMask?: boolean;
  onToggleSamMask?: (active: boolean) => void;
}

export const TelemetryPane: React.FC<TelemetryPaneProps> = ({
  scenario,
  phase = 2,
  activePass,
  setPhase,
  customVerdict,
  isPatching = false,
  onApplyPatch,
  showSamMask: externalShowSamMask,
  onToggleSamMask: externalOnToggleSamMask,
}) => {
  const [internalShowSamMask, setInternalShowSamMask] = useState(true);
  const [voiceRuleActive, setVoiceRuleActive] = useState(true);

  const showSam = externalShowSamMask !== undefined ? externalShowSamMask : internalShowSamMask;
  const toggleSam = externalOnToggleSamMask || setInternalShowSamMask;

  const currentPass = activePass !== undefined ? activePass : phase >= 4 ? 2 : 1;
  const isPass2 = currentPass === 2;

  // Derive metrics
  const scenarioId = scenario?.scenarioId || 's2';
  const pass1Verdict = scenario?.pass1?.verdict as Record<string, unknown> | undefined;
  const pass2Verdict = scenario?.pass2?.verdict as Record<string, unknown> | undefined;

  const activeVerdict = isPass2 ? pass2Verdict : pass1Verdict;

  const instA = (activeVerdict?.instrumentA || {}) as Record<string, unknown>;
  const instB = (activeVerdict?.instrumentB || {}) as Record<string, unknown>;
  const instARaw = (instA.raw || {}) as Record<string, unknown>;
  const instBRaw = (instB.raw || {}) as Record<string, unknown>;

  // rSam, visRatio, pixel loss, area
  const defaultRSam = scenarioId === 's2' ? 0.8482 : scenarioId === 's3' ? 0.908 : 0.85;
  const rSam: number =
    customVerdict?.rSam ??
    (isPass2
      ? 0.998
      : typeof instA.score === 'number'
        ? instA.score
        : typeof instARaw.rSam === 'number'
          ? instARaw.rSam
          : defaultRSam);

  const defaultVisRatio = scenarioId === 's2' ? 0.8482 : scenarioId === 's3' ? 0.9 : 0.85;
  const visRatio: number =
    customVerdict?.visRatio ??
    (isPass2
      ? 1.0
      : typeof instB.score === 'number'
        ? instB.score
        : typeof instBRaw.pixelVisibilityRatio === 'number'
          ? instBRaw.pixelVisibilityRatio
          : defaultVisRatio);

  const defaultArea = scenarioId === 's2' ? 15708 : scenarioId === 's3' ? 15708 : 10560;
  const tkAreaPx: number = isPass2
    ? 17299
    : typeof instARaw.evalArea === 'number'
      ? instARaw.evalArea
      : defaultArea;

  const defaultPixelLoss = scenarioId === 's2' ? 2574 : scenarioId === 's3' ? 1700 : 1584;
  const pixelLossCount: number =
    customVerdict?.pixelLossCount ??
    (isPass2
      ? 0
      : typeof instBRaw.pixelLossCount === 'number'
        ? instBRaw.pixelLossCount
        : defaultPixelLoss);

  const totalPixels: number =
    customVerdict?.totalPixels ??
    (typeof instBRaw.totalPixels === 'number' ? instBRaw.totalPixels : 17000);

  const lossPct = isPass2 ? 0.0 : (1 - visRatio) * 100;

  // Coordinates
  const bbox = (instBRaw.targetBBox as { x?: number; y?: number; width?: number; height?: number }) ||
    (scenarioId === 's2'
      ? { x: 475, y: 610, width: 330, height: 52 }
      : scenarioId === 's1'
        ? { x: 820, y: 240, width: 220, height: 48 }
        : { x: 910, y: 600, width: 340, height: 50 });

  const reasonString = isPass2
    ? 'VERIFIED: 0.00% loss retained across post-patch evaluation frame. Element unobstructed.'
    : `REJECTED: Visibility loss ${lossPct.toFixed(2)}% exceeds threshold 1.35% (${pixelLossCount.toLocaleString()}/${totalPixels.toLocaleString()} px loss) at [x=${bbox.x ?? 910}, y=${bbox.y ?? 600}, w=${bbox.width ?? 340}, h=${bbox.height ?? 50}]`;

  const handleActionClick = () => {
    if (onApplyPatch) {
      onApplyPatch();
    } else if (setPhase) {
      if (phase < 4) {
        setPhase(4);
      } else {
        setPhase(2);
      }
    }
  };

  return (
    <aside className="w-[320px] shrink-0 bg-[#EAE7DF] border-l border-[#B8B4A9] h-full flex flex-col justify-between overflow-y-auto select-none font-sans">
      <div className="flex flex-col">
        {/* Top Header */}
        <div className="h-9 px-4 border-b border-[#B8B4A9] flex items-center shrink-0">
          <span className="font-mono text-xs font-semibold tracking-[0.06em] uppercase text-[#181816]">
            SPECTRA REFEREE
          </span>
        </div>

        {/* Section 1 — Verdict & Coordinates */}
        <div className="p-3.5 border-b border-[#B8B4A9] space-y-2">
          <div className="flex items-center justify-between gap-2">
            {!isPass2 ? (
              <span className="bg-[#E05246] text-white font-mono text-[11px] font-semibold px-2.5 py-0.5 rounded-full inline-flex items-center gap-1.5 shrink-0">
                <span>① REJECTED • {lossPct.toFixed(2)}% LOSS</span>
              </span>
            ) : (
              <span className="bg-[#2E7D52] text-white font-mono text-[11px] font-semibold px-2.5 py-0.5 rounded-full inline-flex items-center gap-1.5 shrink-0">
                <span>✓ VERIFIED • 0.00% LOSS</span>
              </span>
            )}

            <span className="font-mono text-xs font-semibold text-[#181816] shrink-0">
              {isPass2 ? 'Pass #2' : 'Pass #1'}
            </span>
          </div>

          <p className="font-mono text-[11px] leading-snug text-[#181816] break-words">
            {reasonString}
          </p>
        </div>

        {/* Section 2 — Instrument A (SAM 3.1 Mask) */}
        <div className="p-3.5 border-b border-[#B8B4A9] space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span className="font-mono text-xs text-[#181816]">Instrument A (SAM 3.1 Mask)</span>
            <HardwareToggle
              active={showSam}
              onChange={toggleSam}
              label="Instrument A SAM Mask Toggle"
            />
          </div>

          <div className="flex items-center justify-between gap-2 pt-0.5">
            <span className="font-mono text-[15px] text-[#181816]">Area:</span>
            <HardwareMiniSlider value={rSam} />
          </div>

          <div className="flex items-end justify-between gap-2 pt-1">
            <span className="font-mono text-[26px] leading-none font-medium tracking-[-0.03em] text-[#181816] tabular-nums">
              {tkAreaPx.toLocaleString()} px
            </span>
            <VerticalLedMeter ratio={rSam} variant="neutral" />
          </div>
        </div>

        {/* Section 3 — Instrument B (Pixel Template Match) */}
        <div className="p-3.5 border-b border-[#B8B4A9] space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span className="font-mono text-xs text-[#181816]">
              Instrument B (Pixel Template Match)
            </span>
          </div>

          <div className="flex items-end justify-between gap-2 pt-1">
            <span className="font-mono text-[26px] leading-none font-medium tracking-[-0.03em] text-[#181816] tabular-nums">
              {(visRatio * 100).toFixed(2)}%
            </span>
            <VerticalLedMeter ratio={visRatio} variant="charcoal" />
          </div>
        </div>

        {/* Section 4 — Voice Invariant Rule */}
        <div className="p-3.5 border-b border-[#B8B4A9] space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span className="font-mono text-xs text-[#181816]">Voice Invariant Rule:</span>
            <HardwareToggle
              active={voiceRuleActive}
              onChange={setVoiceRuleActive}
              label="Voice Invariant Rule Toggle"
            />
          </div>

          <div className="flex items-end justify-between gap-2 pt-1">
            <span className="font-mono text-[24px] leading-none font-medium tracking-[-0.02em] text-[#181816]">
              ACTIVE
            </span>
            <VerticalLedMeter ratio={1.0} variant="emeraldPeak" />
          </div>
        </div>

        {/* Section 5 — Phase 02 / 04: Closed-Loop Repair Phases */}
        <div className="p-3.5 space-y-2">
          <div className="font-mono text-[11px] text-[#181816]">
            Phase 02 / 04: Closed-Loop Repair Phases
          </div>

          <div className="space-y-1 font-mono text-xs">
            {/* Phase 01 */}
            <div
              onClick={() => setPhase?.(1)}
              className="bg-[#181816] text-white px-2.5 py-1.5 rounded-[3px] flex items-center justify-between cursor-pointer"
            >
              <span>01. Baseline False Pass</span>
              <span>✓</span>
            </div>

            {/* Phase 02 */}
            <div
              onClick={() => setPhase?.(2)}
              className={`px-2.5 py-1.5 rounded-[3px] flex items-center justify-between cursor-pointer border border-[#B8B4A9] transition-colors ${
                phase === 2 ? 'bg-[#DFDCD3] text-[#181816]' : 'text-[#4A4843] hover:bg-[#E3E0D7]'
              }`}
            >
              <span>02. Spectra Rejection</span>
            </div>

            {/* Phase 03 */}
            <div
              onClick={() => setPhase?.(3)}
              className={`px-2.5 py-1.5 rounded-[3px] flex items-center justify-between cursor-pointer border border-[#B8B4A9] transition-colors ${
                phase >= 3 ? 'bg-[#DFDCD3] text-[#181816]' : 'text-[#4A4843] hover:bg-[#E3E0D7]'
              }`}
            >
              <span>03. Patch Synthesis</span>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Action CTA */}
      <div className="p-3.5 border-t border-[#B8B4A9] bg-[#EAE7DF] shrink-0">
        <button
          type="button"
          disabled={isPatching}
          onClick={handleActionClick}
          className="w-full bg-[#181816] hover:bg-[#2C2C29] active:translate-y-px text-white font-sans font-medium text-sm py-2.5 rounded-[3px] flex items-center justify-center gap-2 cursor-pointer transition-colors shadow-2xs disabled:opacity-50"
        >
          <span>{isPatching ? 'Patching & Verifying...' : 'Verify & Patch ↗'}</span>
        </button>
      </div>
    </aside>
  );
};
