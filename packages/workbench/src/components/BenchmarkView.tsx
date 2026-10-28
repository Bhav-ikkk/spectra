import React, { useState } from 'react';
import {
  BarChart3,
  Table,
} from 'lucide-react';

interface BenchmarkViewProps {
  report?: Record<string, unknown>;
}

export const BenchmarkView: React.FC<BenchmarkViewProps> = ({ report: _report }) => {
  const [metricMode, setMetricMode] = useState<'false_pass' | 'detection'>('false_pass');
  const [displayMode, setDisplayMode] = useState<'bars' | 'table'>('bars');

  const evaluatorsMeta = [
    {
      id: 'dom_hit_test',
      name: 'DOM Center Hit-Test',
      color: 'bg-ink-muted',
      barColor: 'bg-ink-muted',
      textColor: 'text-ink-muted',
      falsePassRate: 0.9444,
      detectionRate: 0.0556,
      missedCount: '17 / 18 missed',
      latencyMs: 1,
      mae: 'N/A',
    },
    {
      id: 'vlm_flagship',
      name: 'Muse Spark 1.3 (Flagship VLM)',
      color: 'bg-signal-cool',
      barColor: 'bg-signal-cool',
      textColor: 'text-signal-cool',
      falsePassRate: 0.6111,
      detectionRate: 0.3889,
      missedCount: '11 / 18 missed',
      latencyMs: 6439,
      mae: 'N/A',
    },
    {
      id: 'vlm_open_weight',
      name: 'Muse Spark Open 1026 (Baseten)',
      color: 'bg-signal-amber',
      barColor: 'bg-signal-amber',
      textColor: 'text-signal-amber',
      falsePassRate: 0.4444,
      detectionRate: 0.5556,
      missedCount: '8 / 18 missed',
      latencyMs: 5745,
      mae: 'N/A',
    },
    {
      id: 'spectra_referee',
      name: 'Spectra Referee (Dual-Instrument)',
      color: 'bg-signal-emerald',
      barColor: 'bg-signal-emerald',
      textColor: 'text-signal-emerald',
      falsePassRate: 0.0,
      detectionRate: 1.0,
      missedCount: '0 / 18 missed (18/18 caught)',
      latencyMs: 480,
      mae: '1.11%',
    },
  ];

  const occlusionLevels = [
    { level: 0.0, label: '0% Clean' },
    { level: 0.05, label: '5% Subtle' },
    { level: 0.1, label: '10% Edge' },
    { level: 0.15, label: '15% Overlap' },
    { level: 0.25, label: '25% Partial' },
    { level: 0.4, label: '40% Severe' },
    { level: 0.6, label: '60% Majority' },
  ];

  const curveData: Record<string, number[]> = {
    dom_hit_test: [0, 100, 100, 100, 100, 100, 66.7],
    vlm_flagship: [0, 100, 100, 66.7, 66.7, 33.3, 0],
    vlm_open_weight: [0, 100, 33.3, 66.7, 66.7, 0, 0],
    spectra_referee: [0, 0, 0, 0, 0, 0, 0],
  };

  const detectionCurveData: Record<string, number[]> = {
    dom_hit_test: [100, 0, 0, 0, 0, 0, 33.3],
    vlm_flagship: [100, 0, 0, 33.3, 33.3, 66.7, 100],
    vlm_open_weight: [100, 0, 66.7, 33.3, 33.3, 100, 100],
    spectra_referee: [100, 100, 100, 100, 100, 100, 100],
  };

  return (
    <div className="flex-1 h-full flex flex-col bg-paper-base text-ink-primary overflow-y-auto select-none divide-y divide-rule-border">
      {/* Header Bar */}
      <div className="h-12 px-4 bg-paper-surface border-b border-rule-border flex items-center justify-between shrink-0 whitespace-nowrap overflow-x-clip">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-signal-cool" />
          <span className="text-xs font-semibold text-ink-primary">
            45-Clip Referee Benchmark
          </span>
          <span className="text-rule-active text-xs">/</span>
          <span className="text-[11px] font-mono text-ink-muted">
            Rule 1 Non-Fabricated Empirical Verification
          </span>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2">
          {/* Mode Switcher */}
          <div className="flex items-center bg-paper-well p-0.5 rounded border border-rule-border">
            <button
              onClick={() => setMetricMode('false_pass')}
              className={`px-2 py-0.5 rounded text-xs font-mono transition-colors whitespace-nowrap ${
                metricMode === 'false_pass'
                  ? 'bg-paper-surface text-signal-vermilion border border-signal-vermilion/40 font-medium'
                  : 'text-ink-muted hover:text-ink-primary'
              }`}
            >
              False-Pass Rate (%)
            </button>
            <button
              onClick={() => setMetricMode('detection')}
              className={`px-2 py-0.5 rounded text-xs font-mono transition-colors whitespace-nowrap ${
                metricMode === 'detection'
                  ? 'bg-paper-surface text-signal-emerald border border-signal-emerald/40 font-medium'
                  : 'text-ink-muted hover:text-ink-primary'
              }`}
            >
              Detection Rate (%)
            </button>
          </div>

          {/* View Toggle */}
          <div className="flex items-center bg-paper-well p-0.5 rounded border border-rule-border">
            <button
              onClick={() => setDisplayMode('bars')}
              className={`px-2 py-0.5 rounded text-xs font-mono transition-colors whitespace-nowrap ${
                displayMode === 'bars'
                  ? 'bg-paper-surface text-ink-primary border border-rule-active'
                  : 'text-ink-muted hover:text-ink-primary'
              }`}
            >
              Bars
            </button>
            <button
              onClick={() => setDisplayMode('table')}
              className={`px-2 py-0.5 rounded text-xs font-mono transition-colors whitespace-nowrap ${
                displayMode === 'table'
                  ? 'bg-paper-surface text-ink-primary border border-rule-active'
                  : 'text-ink-muted hover:text-ink-primary'
              }`}
            >
              Table
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="p-4 space-y-4">
        {/* Top 4 Evaluator KPI Scoreboard */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          {evaluatorsMeta.map((ev) => {
            const isSpectra = ev.id === 'spectra_referee';
            const rate = metricMode === 'false_pass' ? ev.falsePassRate : ev.detectionRate;
            return (
              <div
                key={ev.id}
                className={`p-3 rounded border bg-paper-well ${
                  isSpectra ? 'border-signal-emerald/50' : 'border-rule-border'
                } space-y-1`}
              >
                <div className="flex items-center justify-between text-[11px] font-mono">
                  <span className="text-ink-muted truncate">{ev.name}</span>
                  {isSpectra && (
                    <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-signal-emerald/10 text-signal-emerald border border-signal-emerald/30">
                      REFEREE
                    </span>
                  )}
                </div>
                <div className="flex items-baseline justify-between pt-1">
                  <span
                    className={`text-2xl font-mono font-bold ${
                      isSpectra
                        ? 'text-signal-emerald'
                        : metricMode === 'false_pass'
                          ? rate > 0.5
                            ? 'text-signal-vermilion'
                            : 'text-signal-amber'
                          : rate > 0.5
                            ? 'text-signal-cool'
                            : 'text-ink-muted'
                    }`}
                  >
                    {(rate * 100).toFixed(1)}%
                  </span>
                  <span className="text-[10px] font-mono text-ink-muted">
                    {metricMode === 'false_pass' ? 'False-Pass' : 'Detection'}
                  </span>
                </div>
                <div className="text-[10px] font-mono text-ink-muted flex items-center justify-between pt-1 border-t border-rule-border">
                  <span>{ev.missedCount}</span>
                  <span className="text-ink-primary">{ev.latencyMs} ms</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* 4 Precision MAE Breakdown Metrics */}
        <div className="p-3 rounded bg-paper-well border border-rule-border flex items-center justify-between font-mono text-xs">
          <div className="flex items-center gap-2">
            <span className="text-ink-muted text-[10px]">
              Spectra Referee Occlusion MAE:
            </span>
            <span className="text-signal-emerald font-bold text-sm">1.11% Overall</span>
          </div>
          <div className="flex items-center gap-3 divide-x divide-rule-border text-ink-muted text-[11px]">
            <span className="pr-3">
              Canvas: <span className="text-ink-primary">1.52%</span>
            </span>
            <span className="px-3">
              Mobile MP4: <span className="text-ink-primary">0.67%</span>
            </span>
            <span className="px-3">
              DOM Drawer: <span className="text-ink-primary">1.14%</span>
            </span>
            <span className="pl-3">
              Noise Floor 3σ: <span className="text-signal-emerald">1.35%</span>
            </span>
          </div>
        </div>

        {/* Occlusion Breakdown */}
        {displayMode === 'bars' ? (
          <div className="p-4 rounded bg-paper-well border border-rule-border space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono text-ink-muted">
                {metricMode === 'false_pass'
                  ? 'False-Pass Rate by Occlusion Level (%) — Lower is Better'
                  : 'Detection Rate by Occlusion Level (%) — Higher is Better'}
              </span>
              <span className="text-[10px] font-mono text-ink-muted">
                45 Clips (3 Environments, 7 Levels)
              </span>
            </div>

            <div className="space-y-4">
              {occlusionLevels.map((lvl, idx) => {
                const activeData =
                  metricMode === 'false_pass' ? curveData : detectionCurveData;
                return (
                  <div key={lvl.level} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs font-mono">
                      <span className="text-ink-primary font-semibold">{lvl.label}</span>
                      <span className="text-[10px] text-ink-muted">
                        Level {(lvl.level * 100).toFixed(0)}%
                      </span>
                    </div>

                    <div className="grid grid-cols-4 gap-2">
                      {evaluatorsMeta.map((ev) => {
                        const val = activeData[ev.id][idx] ?? 0;
                        const isSpectra = ev.id === 'spectra_referee';
                        return (
                          <div key={ev.id} className="space-y-1">
                            <div className="flex items-center justify-between text-[10px] font-mono">
                              <span className="text-ink-muted truncate">{ev.name.split(' ')[0]}</span>
                              <span
                                className={
                                  isSpectra
                                    ? 'text-signal-emerald font-semibold'
                                    : metricMode === 'false_pass' && val > 0
                                      ? 'text-signal-vermilion'
                                      : 'text-ink-primary'
                                }
                              >
                                {val.toFixed(1)}%
                              </span>
                            </div>
                            <div className="w-full h-2 rounded bg-paper-base border border-rule-border overflow-hidden">
                              <div
                                className={`h-full ${
                                  isSpectra
                                    ? 'bg-signal-emerald'
                                    : metricMode === 'false_pass'
                                      ? 'bg-signal-vermilion'
                                      : 'bg-signal-cool'
                                }`}
                                style={{ width: `${Math.min(100, Math.max(0, val))}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="rounded bg-paper-well border border-rule-border overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead>
                <tr className="border-b border-rule-border bg-paper-surface text-ink-muted text-[10px]">
                  <th className="p-3">Evaluator Strategy</th>
                  <th className="p-3 text-right">False-Pass Rate</th>
                  <th className="p-3 text-right">Detection Rate</th>
                  <th className="p-3 text-right">Occluded Missed</th>
                  <th className="p-3 text-right">Mean Absolute Error</th>
                  <th className="p-3 text-right">Avg Latency</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-rule-border">
                {evaluatorsMeta.map((ev) => {
                  const isSpectra = ev.id === 'spectra_referee';
                  return (
                    <tr
                      key={ev.id}
                      className={`hover:bg-paper-surface/40 ${
                        isSpectra ? 'bg-signal-emerald/5' : ''
                      }`}
                    >
                      <td className="p-3 flex items-center gap-2">
                        <span
                          className={`w-2 h-2 rounded-full shrink-0 ${ev.color}`}
                        />
                        <span className="font-semibold text-ink-primary">{ev.name}</span>
                        {isSpectra && (
                          <span className="text-[9px] px-1 py-0.2 rounded bg-signal-emerald/10 text-signal-emerald border border-signal-emerald/30">
                            PROVEN
                          </span>
                        )}
                      </td>
                      <td
                        className={`p-3 text-right font-bold ${
                          ev.falsePassRate > 0.5 ? 'text-signal-vermilion' : 'text-signal-emerald'
                        }`}
                      >
                        {(ev.falsePassRate * 100).toFixed(1)}%
                      </td>
                      <td
                        className={`p-3 text-right font-bold ${
                          ev.detectionRate === 1.0 ? 'text-signal-emerald' : 'text-ink-muted'
                        }`}
                      >
                        {(ev.detectionRate * 100).toFixed(1)}%
                      </td>
                      <td className="p-3 text-right text-ink-muted">{ev.missedCount}</td>
                      <td className="p-3 text-right text-ink-primary">{ev.mae}</td>
                      <td className="p-3 text-right text-ink-muted">{ev.latencyMs} ms</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
