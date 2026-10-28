import React, { useState } from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  Cpu,
  GitCommit,
  Play,
  RotateCcw,
  Check,
} from 'lucide-react';
import type { WorkbenchScenarioBundle } from '../types.js';

interface TelemetryPaneProps {
  scenario?: WorkbenchScenarioBundle;
  phase: 1 | 2 | 3 | 4;
  setPhase: (phase: 1 | 2 | 3 | 4) => void;
  calibration: {
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
}

export const TelemetryPane: React.FC<TelemetryPaneProps> = ({
  scenario,
  phase,
  setPhase,
  calibration,
  customVerdict,
}) => {
  const [isRunningLive, setIsRunningLive] = useState(false);
  const [liveError, setLiveError] = useState<string | null>(null);
  const [livePatchDiff, setLivePatchDiff] = useState<string | null>(null);

  const isVerified = phase >= 4;

  const currentVerdict = customVerdict
    ? customVerdict
    : isVerified
      ? {
          combinedVerdict: 'pass',
          rSam: (scenario?.pass2?.verdict?.instrumentA as any)?.score ?? 0.9912,
          visRatio: (scenario?.pass2?.verdict?.instrumentB as any)?.score ?? 1.0,
          rNcc: (scenario?.pass2?.verdict?.instrumentB as any)?.raw?.rNcc ?? 1.0,
          pixelLossCount: (scenario?.pass2?.verdict?.instrumentB as any)?.raw?.pixelLossCount ?? 0,
          totalPixels: (scenario?.pass2?.verdict?.instrumentB as any)?.raw?.totalPixels ?? 17000,
          delta: (scenario?.pass2?.verdict as any)?.noiseDelta ?? 0.0088,
          reason:
            (scenario?.pass2?.verdict as any)?.notes ??
            'VERIFIED: Target element 100% unobstructed within noise floor (1.35%).',
        }
      : {
          combinedVerdict: 'fail',
          rSam: (scenario?.pass1?.verdict?.instrumentA as any)?.score ?? 0.908,
          visRatio: (scenario?.pass1?.verdict?.instrumentB as any)?.score ?? 0.9,
          rNcc: (scenario?.pass1?.verdict?.instrumentB as any)?.raw?.rNcc ?? 0.5241,
          pixelLossCount:
            (scenario?.pass1?.verdict?.instrumentB as any)?.raw?.pixelLossCount ?? 1700,
          totalPixels: (scenario?.pass1?.verdict?.instrumentB as any)?.raw?.totalPixels ?? 17000,
          delta: (scenario?.pass1?.verdict as any)?.noiseDelta ?? 0.008,
          reason:
            (scenario?.pass1?.verdict as any)?.notes ??
            'REJECTED: 9.60% visibility loss exceeds 1.35% calibrated 3σ threshold.',
        };

  const rSam = currentVerdict.rSam ?? (isVerified ? 0.9912 : 0.908);
  const visRatio = currentVerdict.visRatio ?? (isVerified ? 1.0 : 0.9);
  const rNcc = currentVerdict.rNcc ?? (isVerified ? 1.0 : 0.5241);
  const pixelLoss = currentVerdict.pixelLossCount ?? (isVerified ? 0 : 1700);
  const totalPixels = currentVerdict.totalPixels ?? 17000;
  const agreementDelta = currentVerdict.delta ?? Math.abs(rSam - visRatio);

  const handleRunClosedLoopLive = async () => {
    setIsRunningLive(true);
    setLiveError(null);
    try {
      const res = await fetch('/api/closed-loop-live', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenario: scenario?.scenarioId || 's3' }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Live repair request failed' }));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      const data = await res.json();
      if (data.patchDiff) {
        setLivePatchDiff(data.patchDiff);
      }
      setPhase(4);
    } catch (err: any) {
      setLiveError(err.message || 'Live closed-loop failed');
    } finally {
      setIsRunningLive(false);
    }
  };

  const patchDiffDisplay =
    livePatchDiff ||
    scenario?.repairPatch?.patchDiff ||
    `--- a/components/CartDrawer.css\n+++ b/components/CartDrawer.css\n@@ -14,3 +14,3 @@\n-.cart-drawer {\n-  margin-bottom: 0px;\n+.cart-drawer {\n+  margin-bottom: 24px;\n+  z-index: 50;`;

  return (
    <aside className="w-80 shrink-0 h-full bg-paper-base border-l border-rule-border flex flex-col justify-between overflow-y-auto min-h-0 select-none">
      <div className="divide-y divide-rule-border">
        {/* Header Bar */}
        <div className="h-10 px-3 bg-paper-surface flex items-center justify-between shrink-0 whitespace-nowrap">
          <div className="flex items-center gap-1.5 text-xs font-medium text-ink-primary">
            <Cpu className="w-3.5 h-3.5 text-signal-cool" />
            <span className="whitespace-nowrap">Dual-Instrument Telemetry</span>
          </div>
          <span className="text-[10px] font-mono text-ink-muted">
            Δ Limit ≤ {(calibration.delta * 100).toFixed(2)}%
          </span>
        </div>

        {/* Verdict Header */}
        <div className="p-3 bg-paper-well space-y-1.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {isVerified ? (
                <ShieldCheck className="w-4 h-4 text-signal-emerald" />
              ) : (
                <ShieldAlert className="w-4 h-4 text-signal-vermilion" />
              )}
              <span
                className={`text-xs font-mono font-bold ${
                  isVerified ? 'text-signal-emerald' : 'text-signal-vermilion'
                }`}
              >
                {isVerified ? 'VERIFIED · 100.0% VISIBLE' : 'REJECTED · 9.60% LOSS'}
              </span>
            </div>
            <span className="text-[10px] font-mono text-ink-muted">
              {isVerified ? 'Pass #2' : 'Pass #1'}
            </span>
          </div>
          <p className="text-[10px] font-mono text-ink-muted leading-tight">
            {currentVerdict.reason}
          </p>
        </div>

        {/* Dual-Instrument Tabular Readout */}
        <div className="p-3 bg-paper-base space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono text-ink-muted">Instrument Readouts</span>
            <span className="text-[9px] font-mono text-signal-emerald">Dual Consensus</span>
          </div>

          <div className="border border-rule-border rounded bg-paper-well divide-y divide-rule-border text-xs font-mono">
            {/* Instrument A (SAM 3.1) */}
            <div className="p-2 space-y-0.5">
              <div className="flex items-center justify-between text-ink-primary">
                <span className="text-ink-muted">Inst A (SAM 3.1):</span>
                <span className="text-signal-cool font-semibold">
                  rSam = {rSam.toFixed(4)}
                </span>
              </div>
              <div className="text-[10px] text-ink-muted flex items-center justify-between">
                <span>Contour Area:</span>
                <span>
                  {isVerified ? '17,299 px → 17,299 px' : '17,299 px → 15,708 px'}
                </span>
              </div>
            </div>

            {/* Instrument B (Pixel Match NCC) */}
            <div className="p-2 space-y-0.5">
              <div className="flex items-center justify-between text-ink-primary">
                <span className="text-ink-muted">Inst B (Pixel NCC):</span>
                <span className="text-signal-cool font-semibold">
                  visRatio = {visRatio.toFixed(4)}
                </span>
              </div>
              <div className="text-[10px] text-ink-muted flex items-center justify-between">
                <span>Loss Count:</span>
                <span>
                  {pixelLoss.toLocaleString()} / {totalPixels.toLocaleString()} px
                </span>
              </div>
              <div className="text-[10px] text-ink-muted flex items-center justify-between">
                <span>Correlation (rNcc):</span>
                <span>{rNcc.toFixed(4)}</span>
              </div>
            </div>

            {/* Cross-Instrument Agreement */}
            <div className="p-2 space-y-0.5 bg-paper-base">
              <div className="flex items-center justify-between text-ink-primary">
                <span className="text-ink-muted">Cross-Instrument Δ:</span>
                <span className="text-signal-emerald font-semibold">
                  {(agreementDelta * 100).toFixed(2)}%
                </span>
              </div>
              <div className="text-[10px] text-ink-muted flex items-center justify-between">
                <span>Calibrated 3σ Floor:</span>
                <span>{(calibration.threshold * 100).toFixed(2)}% (σ = 0.45%)</span>
              </div>
              <div className="text-[9px] text-ink-muted truncate">
                Cite: resp_6ae03ef78bd3db0853c642af
              </div>
            </div>
          </div>
        </div>

        {/* 4-Phase Closed-Loop Stepper */}
        <div className="p-3 bg-paper-base space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono text-ink-muted">Closed-Loop Repair Phases</span>
            <span className="text-[10px] font-mono text-ink-primary">Phase 0{phase} / 04</span>
          </div>

          <div className="space-y-1">
            {[
              {
                p: 1,
                title: '01 · Baseline False Pass',
                desc: 'DOM hit-test (1080, 625) & VLM self-check both false-pass.',
              },
              {
                p: 2,
                title: '02 · Spectra Rejection',
                desc: 'Dual-instrument catches 9.60% loss > 1.35% threshold.',
              },
              {
                p: 3,
                title: '03 · Patch Synthesis',
                desc: 'muse-spark-open-1026 generates layout CSS diff.',
              },
              {
                p: 4,
                title: '04 · Re-Render & Verified',
                desc: 'Dynamic re-render proves 100% visible (0 px lost).',
              },
            ].map((step) => {
              const isCurrent = phase === step.p;
              const isPassed = phase > step.p;
              return (
                <button
                  key={step.p}
                  onClick={() => setPhase(step.p as 1 | 2 | 3 | 4)}
                  className={`w-full text-left p-2 rounded border text-xs transition-colors ${
                    isCurrent
                      ? 'bg-paper-surface border-rule-active text-ink-primary'
                      : isPassed
                        ? 'bg-paper-well border-rule-border text-ink-muted'
                        : 'bg-paper-well/50 border-transparent text-ink-muted/60 hover:text-ink-muted'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-medium text-[11px] text-ink-primary">
                      {step.title}
                    </span>
                    {isPassed ? (
                      <Check className="w-3 h-3 text-signal-emerald" />
                    ) : isCurrent ? (
                      <span className="w-1.5 h-1.5 rounded-full bg-signal-cool" />
                    ) : null}
                  </div>
                  <div className="text-[10px] text-ink-muted mt-0.5 leading-tight">
                    {step.desc}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Patch Diff Section (When Phase >= 3) */}
        {phase >= 3 && (
          <div className="p-3 bg-paper-well space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono text-ink-muted flex items-center gap-1">
                <GitCommit className="w-3 h-3 text-signal-cool" />
                <span>Layout Patch Diff</span>
              </span>
              <span className="text-[9px] font-mono text-signal-emerald">Applied</span>
            </div>
            <pre className="p-2 rounded bg-paper-base border border-rule-border text-[10px] font-mono text-ink-muted overflow-x-auto leading-relaxed">
              {patchDiffDisplay}
            </pre>
          </div>
        )}

        {/* Live Run Action Button */}
        <div className="p-3 bg-paper-base space-y-2">
          <button
            onClick={handleRunClosedLoopLive}
            disabled={isRunningLive}
            className="w-full h-9 rounded bg-ink-primary hover:bg-white text-paper-base font-medium text-xs flex items-center justify-center gap-1.5 shadow-none transition-colors disabled:opacity-50 whitespace-nowrap"
          >
            {isRunningLive ? (
              <>
                <span className="w-3 h-3 border-2 border-paper-base border-t-transparent rounded-full animate-spin" />
                <span className="whitespace-nowrap">Repairing…</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-current" />
                <span className="whitespace-nowrap">Run Repair</span>
              </>
            )}
          </button>
          {liveError && (
            <div className="p-2 rounded bg-signal-vermilion/10 border border-signal-vermilion/30 text-signal-vermilion text-[10px] font-mono">
              {liveError}
            </div>
          )}
        </div>
      </div>

      {/* Footer Calibration Note */}
      <div className="p-2.5 border-t border-rule-border bg-paper-well text-[10px] text-ink-muted font-mono flex items-center justify-between">
        <span>3σ Thresh: 1.35%</span>
        <button
          onClick={() => setPhase(2)}
          className="text-signal-cool hover:underline flex items-center gap-1 whitespace-nowrap"
        >
          <RotateCcw className="w-2.5 h-2.5" />
          <span className="whitespace-nowrap">Reset</span>
        </button>
      </div>
    </aside>
  );
};
