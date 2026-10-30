import React, { useState } from 'react';
import { ChevronDown, ChevronRight, Compass } from 'lucide-react';
import type { WorkbenchScenarioBundle } from '../types.js';
import {
  HardwareToggle,
  VerticalLedMeter,
  HardwareMiniSlider,
} from './FieldMonitorPrimitives.js';

export interface TelemetryPaneProps {
  scenarioId?: 's1' | 's2' | 's3';
  scenario?: WorkbenchScenarioBundle;
  phase?: 1 | 2 | 3 | 4;
  activePass?: 1 | 2;
  activeFrameIndex?: number;
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
  onResetPass?: () => void;
  showSamMask?: boolean;
  onToggleSamMask?: (active: boolean) => void;
}

export const TelemetryPane: React.FC<TelemetryPaneProps> = ({
  scenarioId: propScenarioId,
  scenario,
  phase = 2,
  activePass,
  activeFrameIndex = 7,
  setPhase,
  customVerdict,
  isPatching = false,
  onApplyPatch,
  onResetPass,
  showSamMask: externalShowSamMask,
  onToggleSamMask: externalOnToggleSamMask,
}) => {
  const [internalShowSamMask, setInternalShowSamMask] = useState(true);
  const [voiceRuleActive, setVoiceRuleActive] = useState(true);
  const [showDecisionTree, setShowDecisionTree] = useState(true);

  const showSam = externalShowSamMask !== undefined ? externalShowSamMask : internalShowSamMask;
  const toggleSam = externalOnToggleSamMask || setInternalShowSamMask;

  const currentPass = activePass !== undefined ? activePass : phase >= 4 ? 2 : 1;
  const isPass2 = currentPass === 2;

  // Resolve active scenario ID
  const activeId: 's1' | 's2' | 's3' =
    propScenarioId || (scenario?.scenarioId as 's1' | 's2' | 's3') || 's2';

  // Master Scenario Telemetry Specifications (Fix 1 & Fix 2)
  const scenarioConfigs = {
    s2: {
      targetLabel: 'Pay $149.00',
      bbox: { x: 475, y: 610, width: 330, height: 52 },
      contractId: 'mobile-pay-button-visible',
      pass1VerdictPill: '① REJECTED • 15.18% LOSS',
      pass1LossPct: 15.18,
      areaSequence: [17536, 17480, 17350, 16900, 16300, 15600, 15050, 14878],
      t0Area: 17536,
      tkArea: 14878,
      rSam: 0.8464,
      visRatio: 0.85,
      pixelLossCount: 2574,
      totalPixels: 17160,
      codeTitle: 'React Native / BottomSheetConfig',
      codePatch: `const bottomSheetConfig = {\n  snapPoints: ['40%', '50%'], // Reduced from 65%\n};`,
    },
    s3: {
      targetLabel: 'Complete Checkout',
      bbox: { x: 910, y: 600, width: 340, height: 50 },
      contractId: 'complete-checkout-button-visible',
      pass1VerdictPill: '① REJECTED • 9.60% LOSS',
      pass1LossPct: 9.6,
      areaSequence: [17299, 17258, 17273, 16665, 16130, 15756, 15759, 15708],
      t0Area: 17299,
      tkArea: 15708,
      rSam: 0.908,
      visRatio: 0.9,
      pixelLossCount: 1700,
      totalPixels: 17000,
      codeTitle: 'CartDrawer.css Diff',
      codePatch: `.cart-drawer-footer {\n  margin-top: 0px;\n  height: 110px;\n}`,
    },
    s1: {
      targetLabel: 'Revenue Series Legend',
      bbox: { x: 820, y: 240, width: 220, height: 48 },
      contractId: 'canvas-legend-unobstructed',
      pass1VerdictPill: '① REJECTED • 14.25% LOSS',
      pass1LossPct: 14.25,
      areaSequence: [10560, 10510, 10420, 10180, 9820, 9510, 9240, 9134],
      t0Area: 10560,
      tkArea: 9134,
      rSam: 0.852,
      visRatio: 0.85,
      pixelLossCount: 1584,
      totalPixels: 10560,
      codeTitle: 'ChartCanvas.tsx Tooltip Anchor',
      codePatch: `const tooltip = {\n  x: 660, // Shifted from 980 to clear legend\n  y: 230,\n  width: 140,\n  height: 60,\n};`,
    },
  };

  const cfg = scenarioConfigs[activeId] || scenarioConfigs.s2;

  // Compute live frame-interpolated Instrument A Area
  const safeFrame = Math.min(7, Math.max(0, activeFrameIndex));
  const currentAreaPx = isPass2 ? cfg.t0Area : cfg.areaSequence[safeFrame];

  // Instrument A (rSam) & Instrument B (visRatio)
  const rSam = isPass2 ? 1.0 : customVerdict?.rSam ?? cfg.rSam;
  const visRatio = isPass2 ? 1.0 : customVerdict?.visRatio ?? cfg.visRatio;
  const lossPct = isPass2 ? 0.0 : cfg.pass1LossPct;

  const reasonString = isPass2
    ? 'VERIFIED: 0.00% loss retained across post-patch evaluation frame. Element unobstructed.'
    : `REJECTED: Visibility loss ${cfg.pass1LossPct.toFixed(2)}% exceeds threshold 1.35% (${cfg.pixelLossCount.toLocaleString()}/${cfg.totalPixels.toLocaleString()} px loss) at [x=${cfg.bbox.x}, y=${cfg.bbox.y}, w=${cfg.bbox.width}, h=${cfg.bbox.height}]`;

  const handleActionClick = () => {
    if (isPass2) {
      if (onResetPass) {
        onResetPass();
      } else if (setPhase) {
        setPhase(2);
      }
    } else {
      if (onApplyPatch) {
        onApplyPatch();
      } else if (setPhase) {
        setPhase(4);
      }
    }
  };

  return (
    <aside className="w-[320px] shrink-0 bg-[#EAE7DF] border-l border-[#B8B4A9] h-full flex flex-col justify-between overflow-y-auto select-none font-sans">
      <div className="flex flex-col">
        {/* Top Header */}
        <div className="h-9 px-4 border-b border-[#B8B4A9] flex items-center justify-between shrink-0">
          <span className="font-mono text-xs font-semibold tracking-[0.06em] uppercase text-[#181816]">
            SPECTRA REFEREE
          </span>
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-[9px] text-[#4A4843] bg-[#DFDCD3] border border-[#B8B4A9] px-1.5 py-0.5 rounded-[2px]">
              CACHED REPLAY ($0.00)
            </span>
            <span className="font-mono text-[10px] text-[#1D4D35] bg-[#DCE8DF] border border-[#9BB8A5] px-1.5 py-0.5 rounded-[2px] font-semibold">
              Rule 2 Verified
            </span>
          </div>
        </div>

        {/* Section 1 — Verdict & Coordinates */}
        <div className="p-3.5 border-b border-[#B8B4A9] space-y-2">
          <div className="flex items-center justify-between gap-2">
            {!isPass2 ? (
              <span className="bg-[#E05246] text-white font-mono text-[11px] font-semibold px-2.5 py-0.5 rounded-full inline-flex items-center gap-1.5 shrink-0 shadow-2xs">
                <span>{cfg.pass1VerdictPill}</span>
              </span>
            ) : (
              <span className="bg-[#2E7D52] text-white font-mono text-[11px] font-semibold px-2.5 py-0.5 rounded-full inline-flex items-center gap-1.5 shrink-0 shadow-2xs">
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
              {currentAreaPx.toLocaleString()} px
            </span>
            <VerticalLedMeter ratio={rSam} variant={isPass2 ? 'emeraldPeak' : 'neutral'} />
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
            <VerticalLedMeter ratio={visRatio} variant={isPass2 ? 'emeraldPeak' : 'charcoal'} />
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

        {/* Section 5 — Code Patch Box (Visible in Phase 3 & 4) */}
        {phase >= 3 && (
          <div className="p-3.5 border-b border-[#B8B4A9] space-y-1.5 bg-[#DFDCD3] transition-all">
            <div className="flex items-center justify-between font-mono text-[11px] text-[#181816]">
              <span className="font-semibold uppercase tracking-wider">Applied Code Patch</span>
              <span className="text-[#4A4843] text-[10px]">{cfg.codeTitle}</span>
            </div>
            <pre className="p-2.5 rounded-[3px] bg-[#D6D3C9] border border-[#B8B4A9] text-[#181816] font-mono text-[11px] leading-relaxed overflow-x-auto select-text shadow-inner whitespace-pre">
              <code>{cfg.codePatch}</code>
            </pre>
          </div>
        )}

        {/* Section: Decision Tree · Show Your Work */}
        <div className="p-3.5 border-b border-[#B8B4A9] space-y-2 bg-[#E5E2DA]">
          <div
            onClick={() => setShowDecisionTree(!showDecisionTree)}
            className="flex items-center justify-between cursor-pointer select-none"
          >
            <div className="flex items-center gap-1.5 font-mono text-xs font-semibold uppercase tracking-wider text-[#181816]">
              <Compass className="w-3.5 h-3.5 text-[#181816]" />
              <span>DECISION TREE · SHOW YOUR WORK</span>
            </div>
            <button
              type="button"
              className="text-[#4A4843] hover:text-[#181816] cursor-pointer"
              title={showDecisionTree ? 'Collapse Decision Tree' : 'Expand Decision Tree'}
            >
              {showDecisionTree ? (
                <ChevronDown className="w-3.5 h-3.5" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5" />
              )}
            </button>
          </div>

          {showDecisionTree && (
            <div className="p-2.5 rounded-[3px] bg-[#D6D3C9] border border-[#B8B4A9] font-mono text-[10.5px] leading-relaxed space-y-1.5 text-[#181816] shadow-inner">
              <div className="flex items-center justify-between pb-1 border-b border-[#B8B4A9]">
                <span className="text-[#6E6B64] font-semibold">Rule Fired:</span>
                <span
                  className={`px-1.5 py-0.2 rounded-[2px] font-bold text-[9.5px] tracking-tight ${
                    isPass2 ? 'bg-[#2E7D52] text-white' : 'bg-[#E05246] text-white'
                  }`}
                >
                  {isPass2
                    ? 'RULE_4_THREE_SIGMA_CLEAN_PASS'
                    : 'RULE_3_THREE_SIGMA_OCCLUSION_REJECT'}
                </span>
              </div>

              <div>
                <span className="text-[#6E6B64] font-semibold">Instrument Votes:</span>
                <div className="pl-1 text-[#181816]">
                  {isPass2 ? (
                    <>
                      • Inst A (SAM 3.1):{' '}
                      <span className="text-[#1D4D35] font-semibold">PASS (0.00% loss)</span>
                      <br />• Inst B (Pixel):{' '}
                      <span className="text-[#1D4D35] font-semibold">PASS (0.00% loss)</span>
                    </>
                  ) : (
                    <>
                      • Inst A (SAM 3.1):{' '}
                      <span className="text-[#9E2A22] font-semibold">
                        FAIL (-{((1 - rSam) * 100).toFixed(2)}%)
                      </span>
                      <br />• Inst B (Pixel):{' '}
                      <span className="text-[#9E2A22] font-semibold">
                        FAIL (-{((1 - visRatio) * 100).toFixed(2)}%)
                      </span>
                    </>
                  )}
                </div>
              </div>

              <div className="flex flex-col">
                <span className="text-[#6E6B64] font-semibold">Agreement Check:</span>
                <span className="pl-1">
                  |rSam - vis| = {(Math.abs(rSam - visRatio) * 100).toFixed(2)}% ≤{' '}
                  {(0.041 * 100).toFixed(2)}% (δ){' '}
                  <span className="text-[#1D4D35] font-semibold">
                    [AGREED, +{((0.041 - Math.abs(rSam - visRatio)) * 100).toFixed(2)}% margin]
                  </span>
                </span>
              </div>

              <div className="flex flex-col">
                <span className="text-[#6E6B64] font-semibold">Threshold Margin:</span>
                <span className="pl-1">
                  {isPass2 ? (
                    <>
                      Loss 0.00% vs 1.35% (3σ){' '}
                      <span className="text-[#1D4D35] font-semibold">
                        [-1.35% within noise floor]
                      </span>
                    </>
                  ) : (
                    <>
                      Loss {cfg.pass1LossPct.toFixed(2)}% vs 1.35% (3σ){' '}
                      <span className="text-[#9E2A22] font-semibold">
                        [+{(cfg.pass1LossPct - 1.35).toFixed(2)}% above noise floor]
                      </span>
                    </>
                  )}
                </span>
              </div>

              <div className="flex flex-col pt-0.5 border-t border-[#B8B4A9]">
                <span className="text-[#6E6B64] font-semibold">BBox Provenance:</span>
                <span className="pl-1 text-[10px] text-[#4A4843] break-all">
                  {activeId === 's3'
                    ? 'Manifest [910,600,340,50] · SAM Frame-0 [909,600,342,51]'
                    : activeId === 's1'
                      ? 'Manifest [820,240,220,48] · SAM Frame-0 [820,240,220,48]'
                      : 'Manifest [475,610,330,52] · SAM Frame-0 [475,610,330,52]'}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Section 6 — Phase 01..04: Closed-Loop Repair Phases */}
        <div className="p-3.5 space-y-2">
          <div className="font-mono text-[11px] text-[#181816]">
            Phase {phase >= 4 ? '04 / 04' : phase >= 3 ? '03 / 04' : '02 / 04'}: Closed-Loop Repair Phases
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
              onClick={() => {
                setPhase?.(2);
                if (onResetPass) onResetPass();
              }}
              className={`px-2.5 py-1.5 rounded-[3px] flex items-center justify-between cursor-pointer border border-[#B8B4A9] transition-colors ${
                phase === 2
                  ? 'bg-[#DFDCD3] text-[#181816] font-semibold'
                  : 'text-[#4A4843] hover:bg-[#E3E0D7]'
              }`}
            >
              <span>02. Spectra Rejection</span>
              {phase >= 2 && <span>✓</span>}
            </div>

            {/* Phase 03 */}
            <div
              onClick={() => {
                if (onApplyPatch) onApplyPatch();
                else setPhase?.(3);
              }}
              className={`px-2.5 py-1.5 rounded-[3px] flex items-center justify-between cursor-pointer border border-[#B8B4A9] transition-colors ${
                phase === 3
                  ? 'bg-[#DFDCD3] text-[#181816] font-semibold'
                  : 'text-[#4A4843] hover:bg-[#E3E0D7]'
              }`}
            >
              <span>03. Patch Synthesis</span>
              {phase >= 3 && <span>✓</span>}
            </div>

            {/* Phase 04 */}
            <div
              onClick={() => setPhase?.(4)}
              className={`px-2.5 py-1.5 rounded-[3px] flex items-center justify-between cursor-pointer border border-[#B8B4A9] transition-colors ${
                phase >= 4
                  ? 'bg-[#2E7D52] text-white font-semibold'
                  : 'text-[#4A4843] hover:bg-[#E3E0D7]'
              }`}
            >
              <span>04. Pass #2 Re-Verify</span>
              {phase >= 4 && <span>✓</span>}
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
          className={`w-full font-sans font-medium text-sm py-2.5 rounded-[3px] flex items-center justify-center gap-2 cursor-pointer transition-colors shadow-2xs disabled:opacity-50 active:translate-y-px ${
            isPass2
              ? 'bg-[#DFDCD3] hover:bg-[#D5D1C7] text-[#181816] border border-[#B8B4A9]'
              : 'bg-[#181816] hover:bg-[#2C2C29] text-white'
          }`}
        >
          <span>
            {isPatching
              ? 'Synthesizing Patch & Verifying...'
              : isPass2
                ? 'Reset to Broken Pass #1 ↺'
                : 'Verify & Patch ↗'}
          </span>
        </button>
      </div>
    </aside>
  );
};
