import React from 'react';
import { Smartphone, Layout, Monitor, FileText } from 'lucide-react';
import type { WorkbenchScenarioBundle, WorkbenchClipAsset } from '../types.js';

export interface LeftPaneProps {
  scenarios?: {
    s1?: WorkbenchScenarioBundle;
    s2?: WorkbenchScenarioBundle;
    s3?: WorkbenchScenarioBundle;
  };
  activeScenarioId?: 's1' | 's2' | 's3';
  selectedScenarioId?: 's1' | 's2' | 's3';
  setActiveScenarioId?: (id: 's1' | 's2' | 's3') => void;
  onSelectScenario?: (id: 's1' | 's2' | 's3') => void;
  clips?: WorkbenchClipAsset[];
  activeClipId?: string;
  setActiveClipId?: (id: string) => void;
  viewMode?: 'arena' | 'benchmark';
  invariants?: Record<string, unknown>;
  voiceTranscript?: Record<string, unknown>;
}

export const LeftPane: React.FC<LeftPaneProps> = ({
  activeScenarioId,
  selectedScenarioId,
  setActiveScenarioId,
  onSelectScenario,
  invariants,
}) => {
  const currentId = activeScenarioId || selectedScenarioId || 's2';

  const handleSelect = (id: 's1' | 's2' | 's3') => {
    setActiveScenarioId?.(id);
    onSelectScenario?.(id);
  };

  const scenarioItems: Array<{
    id: 's1' | 's2' | 's3';
    tag: string;
    badge: string;
    title: string;
    subtitle: string;
    icon: React.ReactNode;
  }> = [
    {
      id: 's2',
      tag: 'S2 - Mobile MP4',
      badge: '15.0% Overlap',
      title: 'Raw Mobile MP4 Recording',
      subtitle: '15.0% bottom-sheet overlap on "Pay $149.00" with no DOM',
      icon: <Smartphone className="w-3.5 h-3.5 text-[#4A4843] shrink-0" />,
    },
    {
      id: 's3',
      tag: 'S3 - DOM Catch',
      badge: '10.0% Edge',
      title: 'Sticky Cart Drawer ("The Catch")',
      subtitle: '10.0% bottom-edge clip where DOM center hit-test passes',
      icon: <Layout className="w-3.5 h-3.5 text-[#4A4843] shrink-0" />,
    },
    {
      id: 's1',
      tag: 'S1 - Canvas',
      badge: '15.0% Collision',
      title: 'HTML5 Canvas Collision',
      subtitle: '15.0% tooltip collision inside a single <canvas> element',
      icon: <Monitor className="w-3.5 h-3.5 text-[#4A4843] shrink-0" />,
    },
  ];

  // Dynamic contract details based on active scenario
  const contractRule =
    currentId === 's2'
      ? {
          ruleId: 'pay-button-visible',
          target: 'Target: Pay $149.00',
        }
      : currentId === 's1'
        ? {
            ruleId: 'revenue-legend-visible',
            target: 'Target: Revenue Series Legend',
          }
        : {
            ruleId: 'complete-checkout-button-visible',
            target: 'Target: Complete Checkout Button',
          };

  const invList = (invariants as { invariants?: Array<{ id: string; matcher?: { target: string } }> })
    ?.invariants;
  const matchedInv = invList?.find((i) => i.id.includes(currentId));
  const displayRuleId = matchedInv?.id || contractRule.ruleId;
  const displayTarget = matchedInv?.matcher?.target
    ? `Target: ${matchedInv.matcher.target}`
    : contractRule.target;

  return (
    <aside className="w-[270px] shrink-0 bg-[#EAE7DF] border-r border-[#B8B4A9] h-full flex flex-col justify-between overflow-y-auto select-none font-sans">
      <div className="flex flex-col">
        {/* Top Header */}
        <div className="h-9 px-3.5 border-b border-[#B8B4A9] flex items-center shrink-0">
          <span className="font-mono text-xs font-semibold tracking-[0.06em] uppercase text-[#181816]">
            REPAIR SCENARIOS
          </span>
        </div>

        {/* 3 Flush Scenario Rows */}
        <div className="divide-y divide-[#B8B4A9] border-b border-[#B8B4A9]">
          {scenarioItems.map((item) => {
            const isSelected = currentId === item.id;
            return (
              <div
                key={item.id}
                onClick={() => handleSelect(item.id)}
                className={`p-3 cursor-pointer transition-colors ${
                  isSelected ? 'bg-[#DFDCD3]' : 'bg-[#EAE7DF] hover:bg-[#E3E0D7]'
                }`}
              >
                {/* Top line with Icon, Tag and Badge */}
                <div className="flex items-center justify-between gap-1">
                  <div className="flex items-center gap-1.5 min-w-0">
                    {item.icon}
                    <span className="font-mono text-xs font-medium text-[#181816] truncate">
                      {item.tag}
                    </span>
                  </div>

                  <span className="bg-[#F2C6BE] text-[#9E2A22] border border-[#DF9B90] font-mono text-[11px] font-semibold px-2 py-0.5 rounded-[3px] shrink-0">
                    {item.badge}
                  </span>
                </div>

                {/* Scenario Title */}
                <h4 className="mt-1 text-xs font-semibold text-[#181816] leading-snug">
                  {item.title}
                </h4>

                {/* Subtitle / Description (No Truncation) */}
                <p className="mt-0.5 text-[11px] leading-snug text-[#4A4843]">
                  {item.subtitle}
                </p>
              </div>
            );
          })}
        </div>

        {/* Active Contract Block */}
        <div className="p-3.5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 min-w-0">
              <FileText className="w-3.5 h-3.5 text-[#181816] shrink-0" />
              <span className="font-mono text-[11px] font-semibold text-[#181816] truncate">
                .spectra/invariants.json
              </span>
            </div>
            <span className="font-mono text-[11px] text-[#4A4843] shrink-0">
              Active Contract
            </span>
          </div>

          <div className="mt-2.5 p-3 rounded-[4px] border border-[#B8B4A9] bg-[#D6D3C9] font-mono text-xs space-y-1 text-[#181816] shadow-2xs">
            <div className="font-medium text-[#181816] break-all">{displayRuleId}</div>
            <div className="text-[#4A4843] text-[11px]">{displayTarget}</div>
          </div>
        </div>
      </div>

      {/* Bottom Footer */}
      <footer className="h-9 px-3.5 border-t border-[#B8B4A9] flex items-center justify-between shrink-0 bg-[#EAE7DF]">
        <span className="font-sans text-xs font-medium text-[#181816]">Spectra Referee</span>
      </footer>
    </aside>
  );
};
