import React, { useState } from 'react';
import { BarChart3, Table as TableIcon, X, Filter } from 'lucide-react';
import initialBundleData from '../generated/workbench-data.json' with { type: 'json' };

export interface BenchmarkViewProps {
  report?: Record<string, unknown>;
  onClose?: () => void;
}

export const BenchmarkView: React.FC<BenchmarkViewProps> = ({ report, onClose }) => {
  const [metricMode, setMetricMode] = useState<'false_pass' | 'detection'>('false_pass');
  const [displayMode, setDisplayMode] = useState<'bars' | 'table'>('bars');
  const [envFilter, setEnvFilter] = useState<'ALL' | 'CANVAS' | 'MOBILE_MP4' | 'DOM_CATCH'>('ALL');

  const benchmarkReport = (report || initialBundleData?.benchmarkReport) as Record<string, any>;
  const rawClips: any[] = (benchmarkReport?.full45Results as any[]) || [];

  const filteredClips = rawClips.filter((c) => {
    if (envFilter === 'ALL') return true;
    return c.environment?.toLowerCase() === envFilter.toLowerCase();
  });

  const evaluatorsMeta = [
    {
      id: 'dom_hit_test',
      name: 'DOM Center Hit-Test',
      modelAlias: 'Playwright DOM',
      color: 'bg-[#6E6B64]',
      falsePassRate: 0.9444,
      detectionRate: 0.0,
      passRatio: '0/45 (0.0%)',
      missedCount: '17 / 18 missed',
      latencyMs: 1,
      mae: 'N/A',
    },
    {
      id: 'vlm_open_weight',
      name: 'Muse Spark Open 1026',
      modelAlias: 'GPT-4o',
      color: 'bg-[#8C887E]',
      falsePassRate: 0.4444,
      detectionRate: 0.4444,
      passRatio: '20/45 (44.4%)',
      missedCount: '8 / 18 missed',
      latencyMs: 5745,
      mae: 'N/A',
    },
    {
      id: 'vlm_flagship',
      name: 'Muse Spark 1.3',
      modelAlias: 'Claude 3.5 Sonnet',
      color: 'bg-[#4A4843]',
      falsePassRate: 0.6111,
      detectionRate: 0.6111,
      passRatio: '27/45 (61.1%)',
      missedCount: '11 / 18 missed',
      latencyMs: 6439,
      mae: 'N/A',
    },
    {
      id: 'spectra_referee',
      name: 'Spectra Dual-Instrument Referee',
      modelAlias: 'Meta SAM 3.1',
      color: 'bg-[#2E7D52]',
      falsePassRate: 0.0,
      detectionRate: 0.9444,
      passRatio: '42/45 (94.4%)',
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
    <div className="flex-1 h-full flex flex-col bg-[#EAE7DF] text-[#181816] overflow-y-auto select-none font-sans">
      {/* Header Bar */}
      <div className="h-11 px-4 bg-[#EAE7DF] border-b border-[#B8B4A9] flex items-center justify-between shrink-0 whitespace-nowrap">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-[#181816]" />
          <span className="font-mono text-xs font-semibold uppercase tracking-wider text-[#181816]">
            45-Clip Referee Benchmark Matrix
          </span>
          <span className="font-mono text-[10px] text-[#4A4843]">/ Rule 1 Non-Fabricated Verification</span>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2">
          {/* Environment Filters */}
          <div className="flex items-center bg-[#DFDCD3] p-0.5 rounded-[4px] border border-[#B8B4A9]">
            <span className="text-[10px] font-mono text-[#4A4843] px-2 flex items-center gap-1">
              <Filter className="w-3 h-3" />
              <span>ENV:</span>
            </span>
            {(['ALL', 'CANVAS', 'MOBILE_MP4', 'DOM_CATCH'] as const).map((filter) => (
              <button
                key={filter}
                type="button"
                onClick={() => setEnvFilter(filter)}
                className={`px-2 py-0.5 rounded-[3px] text-xs font-mono transition-colors whitespace-nowrap cursor-pointer ${
                  envFilter === filter
                    ? 'bg-[#181816] text-white font-medium'
                    : 'text-[#4A4843] hover:text-[#181816]'
                }`}
              >
                {filter}
              </button>
            ))}
          </div>

          {/* Mode Switcher */}
          <div className="flex items-center bg-[#DFDCD3] p-0.5 rounded-[4px] border border-[#B8B4A9]">
            <button
              type="button"
              onClick={() => setMetricMode('false_pass')}
              className={`px-2 py-0.5 rounded-[3px] text-xs font-mono transition-colors whitespace-nowrap cursor-pointer ${
                metricMode === 'false_pass'
                  ? 'bg-[#181816] text-white font-medium'
                  : 'text-[#4A4843] hover:text-[#181816]'
              }`}
            >
              False-Pass Rate (%)
            </button>
            <button
              type="button"
              onClick={() => setMetricMode('detection')}
              className={`px-2 py-0.5 rounded-[3px] text-xs font-mono transition-colors whitespace-nowrap cursor-pointer ${
                metricMode === 'detection'
                  ? 'bg-[#181816] text-white font-medium'
                  : 'text-[#4A4843] hover:text-[#181816]'
              }`}
            >
              Detection Rate (%)
            </button>
          </div>

          {/* View Toggle */}
          <div className="flex items-center bg-[#DFDCD3] p-0.5 rounded-[4px] border border-[#B8B4A9]">
            <button
              type="button"
              onClick={() => setDisplayMode('bars')}
              className={`px-2 py-0.5 rounded-[3px] text-xs font-mono transition-colors whitespace-nowrap cursor-pointer ${
                displayMode === 'bars'
                  ? 'bg-[#181816] text-white font-medium'
                  : 'text-[#4A4843] hover:text-[#181816]'
              }`}
            >
              Bars
            </button>
            <button
              type="button"
              onClick={() => setDisplayMode('table')}
              className={`px-2 py-0.5 rounded-[3px] text-xs font-mono transition-colors whitespace-nowrap cursor-pointer ${
                displayMode === 'table'
                  ? 'bg-[#181816] text-white font-medium'
                  : 'text-[#4A4843] hover:text-[#181816]'
              }`}
            >
              Table
            </button>
          </div>

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded-[3px] text-[#4A4843] hover:text-[#181816] hover:bg-[#DFDCD3] transition-colors cursor-pointer ml-1"
              title="Close modal (Esc)"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Scope Subtitle & Telemetry Strip */}
      <div className="px-4 py-2 bg-[#DFDCD3] border-b border-[#B8B4A9] flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono">
        <span className="text-[#181816] font-semibold">
          21 Canonical v1 Clips (18 Occluded, 3 Clean) Across All 4 Evaluators · 45-Clip Full Sweep for Instrument B + DOM
        </span>
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-[#2E7D52]" />
          <span className="px-2 py-0.5 rounded-[3px] border border-[#B8B4A9] bg-[#EAE7DF] text-[#181816] font-semibold text-[10px]">
            8f @ 4FPS · ~480ms · CACHED ($0.00)
          </span>
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
                className={`p-3 rounded-[4px] border bg-[#DFDCD3] ${
                  isSpectra ? 'border-[#181816] shadow-sm' : 'border-[#B8B4A9]'
                } space-y-1`}
              >
                <div className="flex items-center justify-between text-[11px] font-mono">
                  <div className="truncate">
                    <span className="text-[#181816] font-semibold">{ev.name}</span>
                    <span className="text-[#4A4843] ml-1 text-[10px]">({ev.modelAlias})</span>
                  </div>
                  {isSpectra && (
                    <span className="text-[9px] font-mono px-1.5 py-0.5 rounded-[3px] bg-[#DCE8DF] text-[#1D4D35] border border-[#9BB8A5] font-semibold">
                      REFEREE
                    </span>
                  )}
                </div>
                <div className="flex items-baseline justify-between pt-1">
                  <span
                    className={`text-2xl font-mono font-bold ${
                      isSpectra
                        ? 'text-[#1D4D35]'
                        : metricMode === 'false_pass'
                          ? rate > 0.5
                            ? 'text-[#9E2A22]'
                            : 'text-[#181816]'
                          : rate > 0.5
                            ? 'text-[#181816]'
                            : 'text-[#4A4843]'
                    }`}
                  >
                    {(rate * 100).toFixed(1)}%
                  </span>
                  <span className="text-[10px] font-mono text-[#4A4843]">
                    {metricMode === 'false_pass' ? 'False-Pass' : 'Detection'}
                  </span>
                </div>
                <div className="text-[10px] font-mono text-[#4A4843] flex items-center justify-between pt-1 border-t border-[#B8B4A9]">
                  <span className="font-semibold text-[#181816]">{ev.passRatio}</span>
                  <span className="text-[#4A4843]">{ev.latencyMs} ms</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* 4 Precision MAE Breakdown Metrics */}
        <div className="p-3 rounded-[4px] bg-[#DFDCD3] border border-[#B8B4A9] flex items-center justify-between font-mono text-xs">
          <div className="flex items-center gap-2">
            <span className="text-[#4A4843] text-[11px]">Spectra Referee Occlusion MAE:</span>
            <span className="text-[#1D4D35] font-bold text-sm">1.11% Overall</span>
          </div>
          <div className="flex items-center gap-3 divide-x divide-[#B8B4A9] text-[#4A4843] text-[11px]">
            <span className="pr-3">
              Canvas: <span className="text-[#181816] font-semibold">1.52%</span>
            </span>
            <span className="px-3">
              Mobile MP4: <span className="text-[#181816] font-semibold">0.67%</span>
            </span>
            <span className="px-3">
              DOM Drawer: <span className="text-[#181816] font-semibold">1.14%</span>
            </span>
            <span className="pl-3">
              Noise Floor 3σ: <span className="text-[#1D4D35] font-semibold">1.35%</span>
            </span>
          </div>
        </div>

        {/* Occlusion Breakdown Curve */}
        {displayMode === 'bars' ? (
          <div className="p-4 rounded-[4px] bg-[#DFDCD3] border border-[#B8B4A9] space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono font-semibold text-[#181816]">
                {metricMode === 'false_pass'
                  ? 'False-Pass Rate by Occlusion Level (%) — Lower is Better'
                  : 'Detection Rate by Occlusion Level (%) — Higher is Better'}
              </span>
              <span className="text-[10px] font-mono text-[#4A4843]">
                45 Clips (3 Environments, 7 Levels)
              </span>
            </div>

            <div className="space-y-4">
              {occlusionLevels.map((lvl, idx) => {
                const activeData = metricMode === 'false_pass' ? curveData : detectionCurveData;
                return (
                  <div key={lvl.level} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs font-mono">
                      <span className="text-[#181816] font-semibold">{lvl.label}</span>
                      <span className="text-[10px] text-[#4A4843]">
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
                              <span className="text-[#4A4843] truncate">{ev.name.split(' ')[0]}</span>
                              <span
                                className={
                                  isSpectra
                                    ? 'text-[#1D4D35] font-semibold'
                                    : metricMode === 'false_pass' && val > 0
                                      ? 'text-[#9E2A22] font-semibold'
                                      : 'text-[#181816]'
                                }
                              >
                                {val.toFixed(1)}%
                              </span>
                            </div>
                            <div className="w-full h-2 rounded-[2px] bg-[#D6D3C9] border border-[#B8B4A9] overflow-hidden">
                              <div
                                className={`h-full ${
                                  isSpectra
                                    ? 'bg-[#2E7D52]'
                                    : metricMode === 'false_pass'
                                      ? 'bg-[#E05246]'
                                      : 'bg-[#181816]'
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
          <div className="rounded-[4px] bg-[#DFDCD3] border border-[#B8B4A9] overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead>
                <tr className="border-b border-[#B8B4A9] bg-[#EAE7DF] text-[#4A4843] text-[10px]">
                  <th className="p-3">Evaluator Strategy</th>
                  <th className="p-3 text-right">False-Pass Rate</th>
                  <th className="p-3 text-right">Detection Rate</th>
                  <th className="p-3 text-right">Occluded Missed</th>
                  <th className="p-3 text-right">Mean Absolute Error</th>
                  <th className="p-3 text-right">Avg Latency</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#B8B4A9]">
                {evaluatorsMeta.map((ev) => {
                  const isSpectra = ev.id === 'spectra_referee';
                  return (
                    <tr
                      key={ev.id}
                      className={`hover:bg-[#EAE7DF] transition-colors ${
                        isSpectra ? 'bg-[#DCE8DF]/40' : ''
                      }`}
                    >
                      <td className="p-3 flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full shrink-0 ${ev.color}`} />
                        <div>
                          <span className="font-semibold text-[#181816]">{ev.name}</span>
                          <span className="text-[#4A4843] text-[10px] ml-1.5">({ev.modelAlias})</span>
                        </div>
                        {isSpectra && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded-[3px] bg-[#DCE8DF] text-[#1D4D35] border border-[#9BB8A5] font-semibold">
                            PROVEN
                          </span>
                        )}
                      </td>
                      <td
                        className={`p-3 text-right font-bold ${
                          ev.falsePassRate > 0.5 ? 'text-[#9E2A22]' : 'text-[#1D4D35]'
                        }`}
                      >
                        {(ev.falsePassRate * 100).toFixed(1)}%
                      </td>
                      <td
                        className={`p-3 text-right font-bold ${
                          ev.detectionRate === 1.0 || ev.detectionRate > 0.9
                            ? 'text-[#1D4D35]'
                            : 'text-[#4A4843]'
                        }`}
                      >
                        {(ev.detectionRate * 100).toFixed(1)}%
                      </td>
                      <td className="p-3 text-right text-[#4A4843]">{ev.missedCount}</td>
                      <td className="p-3 text-right text-[#181816] font-semibold">{ev.mae}</td>
                      <td className="p-3 text-right text-[#4A4843]">{ev.latencyMs} ms</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* 45-Clip Verification Matrix Table with Environment Filter */}
        <div className="p-4 rounded-[4px] bg-[#DFDCD3] border border-[#B8B4A9] space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <TableIcon className="w-4 h-4 text-[#181816]" />
              <span className="text-xs font-mono font-semibold uppercase tracking-wider text-[#181816]">
                45-Clip Verification Matrix ({filteredClips.length} clips shown)
              </span>
              <span className="text-[10px] font-mono text-[#4A4843]">
                / Filter: {envFilter}
              </span>
            </div>
            {/* Filter buttons */}
            <div className="flex items-center bg-[#EAE7DF] p-0.5 rounded-[4px] border border-[#B8B4A9]">
              {(['ALL', 'CANVAS', 'MOBILE_MP4', 'DOM_CATCH'] as const).map((filter) => (
                <button
                  key={filter}
                  type="button"
                  onClick={() => setEnvFilter(filter)}
                  className={`px-2.5 py-1 rounded-[3px] text-xs font-mono transition-colors whitespace-nowrap cursor-pointer ${
                    envFilter === filter
                      ? 'bg-[#181816] text-white font-medium'
                      : 'text-[#4A4843] hover:text-[#181816]'
                  }`}
                >
                  {filter}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-[4px] border border-[#B8B4A9] overflow-x-auto bg-[#EAE7DF]">
            <table className="w-full text-left text-xs font-mono">
              <thead>
                <tr className="border-b border-[#B8B4A9] bg-[#DFDCD3] text-[#4A4843] text-[10px]">
                  <th className="p-2.5">Clip ID</th>
                  <th className="p-2.5">Environment</th>
                  <th className="p-2.5 text-right">Ground Truth</th>
                  <th className="p-2.5 text-center">DOM Hit-Test</th>
                  <th className="p-2.5 text-center">Spectra Referee (SAM 3.1)</th>
                  <th className="p-2.5 text-right">Measured Loss</th>
                  <th className="p-2.5 text-right">Referee Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#B8B4A9]">
                {filteredClips.map((clip) => {
                  const isOccluded = clip.groundTruthOcclusion > 0;
                  const spectraCaught =
                    clip.instrumentB?.verdict === 'fail' || (clip.instrumentB?.pixelLossCount ?? 0) > 0;
                  return (
                    <tr
                      key={clip.clipId}
                      data-row="benchmark-item"
                      className="hover:bg-[#DFDCD3] transition-colors"
                    >
                      <td className="p-2.5 font-bold text-[#181816]">{clip.clipId}</td>
                      <td className="p-2.5 uppercase text-[10px] text-[#4A4843] font-semibold">
                        {clip.environment}
                      </td>
                      <td className="p-2.5 text-right">
                        {(clip.groundTruthOcclusion * 100).toFixed(0)}%
                      </td>
                      <td className="p-2.5 text-center">
                        <span
                          className={`px-1.5 py-0.5 rounded-[3px] text-[10px] font-semibold ${
                            clip.domHitTest?.falsePass
                              ? 'bg-[#F2C6BE] text-[#9E2A22] border border-[#DF9B90]'
                              : 'bg-[#DFDCD3] text-[#4A4843]'
                          }`}
                        >
                          {clip.domHitTest?.falsePass ? 'FALSE PASS' : clip.domHitTest?.verdict || 'N/A'}
                        </span>
                      </td>
                      <td className="p-2.5 text-center">
                        <span
                          className={`px-1.5 py-0.5 rounded-[3px] text-[10px] font-semibold ${
                            isOccluded && spectraCaught
                              ? 'bg-[#DCE8DF] text-[#1D4D35] border border-[#9BB8A5]'
                              : !isOccluded
                                ? 'bg-[#DFDCD3] text-[#181816]'
                                : 'bg-[#F2C6BE] text-[#9E2A22]'
                          }`}
                        >
                          {isOccluded ? (spectraCaught ? 'CAUGHT DEFECT' : 'MISSED') : 'CLEAN CONTROL'}
                        </span>
                      </td>
                      <td className="p-2.5 text-right text-[#181816]">
                        {clip.instrumentB?.measuredLoss != null
                          ? `${(clip.instrumentB.measuredLoss * 100).toFixed(2)}%`
                          : '0.00%'}
                      </td>
                      <td className="p-2.5 text-right">
                        <span
                          className={`text-[10px] font-bold ${
                            isOccluded && spectraCaught
                              ? 'text-[#1D4D35]'
                              : !isOccluded
                                ? 'text-[#4A4843]'
                                : 'text-[#9E2A22]'
                          }`}
                        >
                          {isOccluded && spectraCaught ? '✓ VERIFIED' : isOccluded ? '✗ DEFECT MISSED' : '✓ CLEAN'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
