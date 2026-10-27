import React from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  Cpu,
  Code2,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  GitCommit,
  Hash,
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
  const isPass2 = phase >= 4;

  const currentVerdict = customVerdict
    ? customVerdict
    : isPass2
      ? {
          combinedVerdict: 'pass',
          rSam: (scenario?.pass2?.verdict?.instrumentA as any)?.score ?? 1.0,
          visRatio: (scenario?.pass2?.verdict?.instrumentB as any)?.score ?? 1.0,
          rNcc: (scenario?.pass2?.verdict?.instrumentB as any)?.raw?.rNcc ?? 1.0,
          pixelLossCount: (scenario?.pass2?.verdict?.instrumentB as any)?.raw?.pixelLossCount ?? 0,
          totalPixels: (scenario?.pass2?.verdict?.instrumentB as any)?.raw?.totalPixels ?? 17000,
          delta: (scenario?.pass2?.verdict as any)?.noiseDelta ?? 0.0088,
          reason:
            (scenario?.pass2?.verdict as any)?.notes ??
            'VERIFIED: Visibility within noise tolerance (1.35%)',
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
            'REJECTED: Visibility loss exceeds threshold 1.35%',
        };

  const isVerified = currentVerdict.combinedVerdict === 'pass';
  const rSam = currentVerdict.rSam ?? (isVerified ? 0.9912 : 0.908);
  const visRatio = currentVerdict.visRatio ?? (isVerified ? 1.0 : 0.9);
  const rNcc = currentVerdict.rNcc ?? (isVerified ? 1.0 : 0.5241);
  const pixelLoss = currentVerdict.pixelLossCount ?? (isVerified ? 0 : 1700);
  const totalPixels = currentVerdict.totalPixels ?? 17000;
  const agreementDelta = currentVerdict.delta ?? Math.abs(rSam - visRatio);
  const lossPct = Math.max(0, (1.0 - (rSam + visRatio) / 2) * 100);

  return (
    <div className="w-[30%] min-w-[340px] max-w-[440px] h-full flex flex-col bg-[#0D0D11]/95 border-l border-white/[0.08] select-none overflow-hidden z-20">
      {/* Pane Top Header */}
      <div className="h-10 px-4 border-b border-white/[0.06] flex items-center justify-between bg-[#121216]/80 flex-shrink-0">
        <span className="text-xs font-semibold text-zinc-200 flex items-center gap-1.5">
          <Cpu className="w-3.5 h-3.5 text-purple-400" />
          Dual-Instrument Telemetry
        </span>
        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-800 text-zinc-400">
          Δ Limit: {(calibration.delta * 100).toFixed(2)}%
        </span>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* High-Contrast Verdict Badge */}
        <div
          className={`p-3.5 rounded-xl border transition-all ${
            isVerified
              ? 'bg-emerald-950/40 border-emerald-500/40 shadow-lg shadow-emerald-500/10'
              : 'bg-rose-950/40 border-rose-500/40 shadow-lg shadow-rose-500/10'
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {isVerified ? (
                <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center">
                  <ShieldCheck className="w-5 h-5 text-emerald-400" />
                </div>
              ) : (
                <div className="w-8 h-8 rounded-lg bg-rose-500/20 border border-rose-500/40 flex items-center justify-center">
                  <ShieldAlert className="w-5 h-5 text-rose-400 animate-pulse" />
                </div>
              )}
              <div>
                <div
                  className={`text-sm font-bold tracking-tight uppercase ${
                    isVerified ? 'text-emerald-300' : 'text-rose-300'
                  }`}
                >
                  {isVerified ? 'VERIFIED: PASSED' : 'REJECTED: OCCLUDED'}
                </div>
                <div className="text-[11px] text-zinc-400">
                  {isVerified
                    ? 'Target element confirmed 100% visible'
                    : `Measured loss: ${lossPct.toFixed(1)}% (Threshold: ${(calibration.threshold * 100).toFixed(2)}%)`}
                </div>
              </div>
            </div>

            <div className="text-right font-mono">
              <div
                className={`text-base font-extrabold ${
                  isVerified ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                {isVerified ? '0.0%' : `${lossPct.toFixed(1)}%`}
              </div>
              <div className="text-[10px] text-zinc-500 uppercase">Loss Metric</div>
            </div>
          </div>
        </div>

        {/* 4-Phase Closed-Loop Stepper */}
        {scenario && (
          <div className="p-3.5 rounded-xl bg-zinc-900/60 border border-white/[0.08] space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
                <GitCommit className="w-3.5 h-3.5 text-indigo-400" />
                Closed-Loop Verification Trace
              </span>
              <span className="text-[10px] font-mono text-indigo-300 bg-indigo-950/60 px-1.5 py-0.5 rounded border border-indigo-500/30">
                Phase {phase} of 4
              </span>
            </div>

            <div className="grid grid-cols-4 gap-1.5">
              {[
                { p: 1 as const, title: 'DOM Blind', desc: 'False Pass' },
                { p: 2 as const, title: 'Spectra Catch', desc: 'Rejection' },
                { p: 3 as const, title: 'LLM Repair', desc: 'Patch Diff' },
                { p: 4 as const, title: 'Re-Verify', desc: 'Verified' },
              ].map((step) => {
                const isActive = phase === step.p;
                const isCompleted = phase > step.p;
                return (
                  <button
                    key={step.p}
                    onClick={() => setPhase(step.p)}
                    className={`p-2 rounded-lg text-left transition-all ${
                      isActive
                        ? 'bg-indigo-600 text-white shadow-md'
                        : isCompleted
                          ? 'bg-zinc-800 text-zinc-300 border border-white/10'
                          : 'bg-zinc-900/80 text-zinc-500 hover:text-zinc-300'
                    }`}
                  >
                    <div className="text-[10px] font-mono opacity-80">0{step.p}</div>
                    <div className="text-[11px] font-bold leading-tight">{step.title}</div>
                    <div className="text-[9px] opacity-70 leading-tight">{step.desc}</div>
                  </button>
                );
              })}
            </div>

            {/* Stepper Phase Explanation */}
            <div className="p-2.5 rounded-lg bg-black/40 border border-white/[0.06] text-xs text-zinc-300">
              {phase === 1 && (
                <div className="space-y-1">
                  <span className="text-rose-400 font-semibold flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5" /> Naive Evaluation Blind Spot
                  </span>
                  <p className="text-[11px] text-zinc-400 leading-relaxed">
                    Agent triggered action. DOM center-point hit-test returns <code>true</code> and
                    VLM flagship outputs <code>PASS</code> despite 10% edge occlusion.
                  </p>
                </div>
              )}
              {phase === 2 && (
                <div className="space-y-1">
                  <span className="text-rose-400 font-semibold flex items-center gap-1">
                    <ShieldAlert className="w-3.5 h-3.5" /> Spectra Referee Rejection
                  </span>
                  <p className="text-[11px] text-zinc-400 leading-relaxed">
                    SAM 3.1 (R_SAM = 0.9080) and Pixel Template Matching (visRatio = 0.9000)
                    cross-agree (Δ = 0.80% &lt; 4.10%), catching the 10% loss and blocking deploy.
                  </p>
                </div>
              )}
              {phase === 3 && (
                <div className="space-y-1">
                  <span className="text-purple-400 font-semibold flex items-center gap-1">
                    <Code2 className="w-3.5 h-3.5" /> Muse Spark Open 1026 Repair
                  </span>
                  <p className="text-[11px] text-zinc-400 leading-relaxed">
                    Agent consumed Spectra's rejection telemetry ({pixelLoss} px loss) and
                    synthesized layout/CSS coordinate correction.
                  </p>
                </div>
              )}
              {phase === 4 && (
                <div className="space-y-1">
                  <span className="text-emerald-400 font-semibold flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Pass #2 Closed-Loop Success
                  </span>
                  <p className="text-[11px] text-zinc-400 leading-relaxed">
                    Repaired layout re-measured. Visibility ratio 100.0%, 0 px loss count. Closed
                    loop successfully verified!
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Dual-Instrument Meters */}
        <div className="p-3.5 rounded-xl bg-zinc-900/60 border border-white/[0.08] space-y-3">
          <div className="text-xs font-semibold text-zinc-200">Optical Dual Instruments</div>

          {/* Instrument A Meter */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center text-xs">
              <span className="text-zinc-400 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-cyan-400" />
                Instrument A (SAM 3.1 API)
              </span>
              <span className="font-mono font-bold text-white">{(rSam * 100).toFixed(2)}%</span>
            </div>
            <div className="w-full h-2 rounded-full bg-zinc-800 overflow-hidden">
              <div
                className={`h-full transition-all duration-500 ${
                  isVerified ? 'bg-emerald-500' : 'bg-cyan-500'
                }`}
                style={{ width: `${Math.min(100, rSam * 100)}%` }}
              />
            </div>
            <div className="flex justify-between text-[10px] text-zinc-500 font-mono">
              <span>R_SAM Ratio: {rSam.toFixed(4)}</span>
              <span>Threshold: {(calibration.threshold * 100).toFixed(2)}%</span>
            </div>
          </div>

          {/* Instrument B Meter */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center text-xs">
              <span className="text-zinc-400 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-purple-400" />
                Instrument B (Pixel Template Matcher)
              </span>
              <span className="font-mono font-bold text-white">{(visRatio * 100).toFixed(2)}%</span>
            </div>
            <div className="w-full h-2 rounded-full bg-zinc-800 overflow-hidden">
              <div
                className={`h-full transition-all duration-500 ${
                  isVerified ? 'bg-emerald-500' : 'bg-purple-500'
                }`}
                style={{ width: `${Math.min(100, visRatio * 100)}%` }}
              />
            </div>
            <div className="flex justify-between text-[10px] text-zinc-500 font-mono">
              <span>
                Pixel Loss:{' '}
                <strong className={pixelLoss > 0 ? 'text-rose-400' : 'text-emerald-400'}>
                  {pixelLoss.toLocaleString()}
                </strong>{' '}
                / {totalPixels.toLocaleString()} px
              </span>
              <span>R_NCC: {rNcc.toFixed(4)}</span>
            </div>
          </div>

          {/* Cross-Instrument Agreement (Δ) */}
          <div className="pt-2 border-t border-white/[0.06] flex items-center justify-between text-xs font-mono">
            <span className="text-zinc-400">Cross-Instrument Δ:</span>
            <span
              className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                agreementDelta <= calibration.delta
                  ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-500/30'
                  : 'bg-rose-950/60 text-rose-300 border border-rose-500/30'
              }`}
            >
              {(agreementDelta * 100).toFixed(2)}% (Limit: {(calibration.delta * 100).toFixed(2)}%)
            </span>
          </div>
        </div>

        {/* Synthesized Agent Repair Patch Diff */}
        {scenario?.repairPatch?.patchDiff && (
          <div className="p-3.5 rounded-xl bg-zinc-900/60 border border-white/[0.08] space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-purple-300 flex items-center gap-1.5">
                <Code2 className="w-3.5 h-3.5" />
                Synthesized Repair Patch
              </span>
              <span className="text-[10px] font-mono text-zinc-400">
                meta-models/muse-spark-open-1026
              </span>
            </div>

            <pre className="p-2.5 rounded-lg bg-black/70 border border-white/[0.08] text-[11px] font-mono text-purple-200 overflow-x-auto whitespace-pre-wrap leading-relaxed">
              <code>{scenario.repairPatch.patchDiff}</code>
            </pre>

            {scenario.repairPatch.reasoning && (
              <p className="text-[10px] text-zinc-400 italic">{scenario.repairPatch.reasoning}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
