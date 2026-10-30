import React from 'react';

/**
 * 1. Hardware Toggle Switch with left indicator ring (from right rail of image_41bab6.jpg)
 */
export const HardwareToggle: React.FC<{
  active: boolean;
  onChange?: (next: boolean) => void;
  label?: string;
}> = ({ active, onChange, label }) => (
  <button
    type="button"
    aria-label={label ?? 'Hardware Toggle'}
    onClick={() => onChange?.(!active)}
    className="inline-flex items-center gap-2 cursor-pointer select-none group"
  >
    <span
      className={`w-2 h-2 rounded-full border transition-colors ${
        active
          ? 'border-[#181816] bg-[#181816]'
          : 'border-[#52504A] bg-transparent'
      }`}
    />
    <span
      className={`w-9 h-[18px] rounded-full border border-[#8C887E] p-[2px] flex items-center transition-colors ${
        active ? 'bg-[#181816] justify-end' : 'bg-[#C8C4B8] justify-start'
      }`}
    >
      <span className="w-3.5 h-3.5 rounded-full bg-[#EAE7DF] shadow-2xs block" />
    </span>
  </button>
);

/**
 * 2. 14-Bar Vertical LED Equalizer Meter (from Instrument A, Instrument B, and Voice Invariant rows)
 */
export const VerticalLedMeter: React.FC<{
  ratio: number; // 0.0 to 1.0
  variant?: 'neutral' | 'charcoal' | 'emeraldPeak';
}> = ({ ratio, variant = 'neutral' }) => {
  const barCount = 14;
  const activeBars = Math.max(1, Math.min(barCount, Math.round(ratio * barCount)));

  return (
    <div className="inline-flex items-end gap-[2.5px] h-6 select-none" aria-hidden="true">
      {Array.from({ length: barCount }).map((_, idx) => {
        const heightPx = Math.round(5 + (idx / (barCount - 1)) * 17);
        const isLit = idx < activeBars;
        let colorClass = 'bg-[#C8C4B8]';
        if (isLit) {
          if (variant === 'emeraldPeak' && idx >= barCount - 2) {
            colorClass = 'bg-[#2E7D52]';
          } else if (variant === 'charcoal') {
            colorClass = 'bg-[#232320]';
          } else {
            colorClass = idx < 4 ? 'bg-[#3A3935]' : 'bg-[#6E6B64]';
          }
        }
        return (
          <span
            key={idx}
            style={{ height: `${heightPx}px` }}
            className={`w-[3px] rounded-[0.5px] transition-all duration-150 ${colorClass}`}
          />
        );
      })}
    </div>
  );
};

/**
 * 3. Hardware Horizontal Slider Track with Knob
 */
export const HardwareMiniSlider: React.FC<{
  value: number; // 0.0 to 1.0
  onChange?: (val: number) => void;
}> = ({ value, onChange }) => {
  const clamped = Math.max(0, Math.min(1, value));
  return (
    <div
      onClick={(e) => {
        if (!onChange) return;
        const rect = e.currentTarget.getBoundingClientRect();
        const next = (e.clientX - rect.left) / rect.width;
        onChange(Math.max(0, Math.min(1, next)));
      }}
      className="relative w-28 h-4 flex items-center select-none cursor-pointer"
    >
      <div className="w-full h-[3px] bg-[#B8B4A9] rounded-full overflow-hidden">
        <div
          className="h-full bg-[#52504A]"
          style={{ width: `${Math.round(clamped * 100)}%` }}
        />
      </div>
      <div
        className="absolute w-3 h-3 rounded-full bg-[#DCD9D0] border-[1.5px] border-[#181816] shadow-2xs -translate-x-1/2"
        style={{ left: `${Math.round(clamped * 100)}%` }}
      />
    </div>
  );
};

/**
 * 4. 4-Corner Leica/Technical Rangefinder Brackets + Millimeter Ticks + Crosshair
 */
export const RangefinderReticleOverlay: React.FC<{
  showCrosshair?: boolean;
}> = ({ showCrosshair = true }) => {
  const topBottomTicks = 48;
  const leftRightTicks = 28;

  return (
    <svg
      viewBox="0 0 1000 620"
      preserveAspectRatio="none"
      className="absolute inset-0 w-full h-full pointer-events-none select-none z-10"
    >
      {/* Top Millimeter Ruler Ticks */}
      {Array.from({ length: topBottomTicks }).map((_, i) => {
        const x = 90 + (i / (topBottomTicks - 1)) * 820;
        const isMajor = i % 5 === 0;
        return (
          <line
            key={`t-${i}`}
            x1={x}
            y1={18}
            x2={x}
            y2={isMajor ? 34 : 27}
            stroke="#181816"
            strokeWidth={isMajor ? '1.4' : '1'}
            strokeOpacity="0.75"
          />
        );
      })}

      {/* Bottom Millimeter Ruler Ticks */}
      {Array.from({ length: topBottomTicks }).map((_, i) => {
        const x = 90 + (i / (topBottomTicks - 1)) * 820;
        const isMajor = i % 5 === 0;
        return (
          <line
            key={`b-${i}`}
            x1={x}
            y1={602}
            x2={x}
            y2={isMajor ? 586 : 593}
            stroke="#181816"
            strokeWidth={isMajor ? '1.4' : '1'}
            strokeOpacity="0.75"
          />
        );
      })}

      {/* Left Millimeter Ruler Ticks */}
      {Array.from({ length: leftRightTicks }).map((_, i) => {
        const y = 85 + (i / (leftRightTicks - 1)) * 450;
        const isMajor = i % 5 === 0;
        return (
          <line
            key={`l-${i}`}
            x1={22}
            y1={y}
            x2={isMajor ? 36 : 30}
            y2={y}
            stroke="#181816"
            strokeWidth={isMajor ? '1.4' : '1'}
            strokeOpacity="0.75"
          />
        );
      })}

      {/* Right Millimeter Ruler Ticks */}
      {Array.from({ length: leftRightTicks }).map((_, i) => {
        const y = 85 + (i / (leftRightTicks - 1)) * 450;
        const isMajor = i % 5 === 0;
        return (
          <line
            key={`r-${i}`}
            x1={978}
            y1={y}
            x2={isMajor ? 964 : 970}
            y2={y}
            stroke="#181816"
            strokeWidth={isMajor ? '1.4' : '1'}
            strokeOpacity="0.75"
          />
        );
      })}

      {/* Top-Left Corner Double-Bracket & Triangle Reticle */}
      <g stroke="#181816" strokeWidth="1.5" fill="none">
        <polyline points="22,68 22,20 72,20" />
        <polyline points="30,68 30,28 72,28" />
        <polygon points="40,38 66,38 40,64" />
      </g>

      {/* Top-Right Corner Double-Bracket & Triangle Reticle */}
      <g stroke="#181816" strokeWidth="1.5" fill="none">
        <polyline points="928,20 978,20 978,68" />
        <polyline points="928,28 970,28 970,68" />
        <polygon points="960,38 934,38 960,64" />
      </g>

      {/* Bottom-Left Corner Double-Bracket */}
      <g stroke="#181816" strokeWidth="1.5" fill="none">
        <polyline points="22,552 22,600 72,600" />
        <polyline points="30,552 30,592 72,592" />
      </g>

      {/* Bottom-Right Corner Double-Bracket */}
      <g stroke="#181816" strokeWidth="1.5" fill="none">
        <polyline points="928,600 978,600 978,552" />
        <polyline points="928,592 970,592 970,552" />
      </g>

      {/* Full-Stage Center Optical Crosshair */}
      {showCrosshair && (
        <g stroke="#181816" strokeWidth="1" strokeOpacity="0.65">
          <line x1="22" y1="310" x2="482" y2="310" />
          <line x1="518" y1="310" x2="978" y2="310" />
          <line x1="500" y1="20" x2="500" y2="292" />
          <line x1="500" y1="328" x2="500" y2="600" />
          <line x1="490" y1="310" x2="510" y2="310" strokeWidth="1.6" />
          <line x1="500" y1="300" x2="500" y2="320" strokeWidth="1.6" />
        </g>
      )}
    </svg>
  );
};

/**
 * 5. Floating "3-State Target Zoom Loupe" (16x12 Square Sub-Pixel Matrix Window from image_41bab6.jpg)
 */
export interface SubPixelMatrixLoupeProps {
  targetLabel: string;
  lossPercent: number;
  isRepaired?: boolean;
  onClose?: () => void;
  targetBBox?: [number, number, number, number];
  t0Area?: number;
  tkArea?: number;
  rSam?: number;
  visRatio?: number;
  rNcc?: number;
  delta?: number;
  threshold?: number;
  activeImageSrc?: string;
}

export const SubPixelMatrixLoupe: React.FC<SubPixelMatrixLoupeProps> = ({
  targetLabel,
  lossPercent,
  isRepaired = false,
  onClose,
  targetBBox,
  t0Area,
  tkArea,
  rSam,
  visRatio,
  rNcc,
  delta = 0.041,
  threshold = 1.35,
  activeImageSrc,
}) => {
  const [activeTab, setActiveTab] = React.useState<'pixel' | 'analytics'>('pixel');
  const [sampledColors, setSampledColors] = React.useState<string[] | null>(null);

  const cols = 16;
  const rows = 12;

  // Offscreen canvas sampling of 16x12 pixels from targetBBox
  React.useEffect(() => {
    if (!activeImageSrc || !targetBBox) {
      setSampledColors(null);
      return;
    }

    let isMounted = true;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      if (!isMounted) return;
      try {
        const canvas = document.createElement('canvas');
        canvas.width = cols;
        canvas.height = rows;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const [bx, by, bw, bh] = targetBBox;
        ctx.drawImage(img, bx, by, bw, bh, 0, 0, cols, rows);
        const imgData = ctx.getImageData(0, 0, cols, rows);
        const colors: string[] = [];
        for (let i = 0; i < imgData.data.length; i += 4) {
          const r = imgData.data[i];
          const g = imgData.data[i + 1];
          const b = imgData.data[i + 2];
          colors.push(`rgb(${r}, ${g}, ${b})`);
        }
        setSampledColors(colors);
      } catch {
        setSampledColors(null);
      }
    };
    img.onerror = () => {
      if (isMounted) setSampledColors(null);
    };
    img.src = activeImageSrc;

    return () => {
      isMounted = false;
    };
  }, [activeImageSrc, targetBBox]);

  const displayBBox = targetBBox ?? [475, 610, 330, 52];
  const displayT0Area = t0Area ?? 17536;
  const displayTkArea = tkArea ?? 14878;
  const displayRSam = rSam ?? 0.8464;
  const displayVisRatio = visRatio ?? 0.85;
  const displayRNcc = rNcc ?? 0.5065;

  return (
    <div className="w-[224px] rounded-[5px] bg-[#EAE7DF] border-[1.5px] border-[#181816] shadow-[0_10px_28px_rgba(0,0,0,0.22)] p-2.5 select-none z-30 font-sans">
      {/* Header */}
      <div className="flex items-start justify-between gap-1">
        <div>
          <div className="font-mono text-[11px] font-bold text-[#181816] leading-tight">
            3-State Target Zoom
          </div>
          <div className="font-mono text-[10px] text-[#4A4843] leading-tight mt-0.5">
            Loupe (Square 3x)
          </div>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="text-[#4A4843] hover:text-[#181816] font-mono text-xs px-1 cursor-pointer transition-colors"
            title="Close Loupe"
          >
            ×
          </button>
        )}
      </div>

      {/* Mode View: Tiny Pixel Grid vs Analytics */}
      {activeTab === 'pixel' ? (
        <div className="mt-2 relative border border-[#181816] bg-[#DCD9D0] overflow-hidden">
          <div
            className="grid"
            style={{
              gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
            }}
          >
            {Array.from({ length: rows * cols }).map((_, idx) => {
              const r = Math.floor(idx / cols);
              const c = idx % cols;
              const isButtonRow = r >= 3 && r <= 7;
              const isOccludedCell =
                !isRepaired &&
                lossPercent > 0 &&
                ((r === 2 && (c === 7 || c === 8 || c === 11)) ||
                  (r === 3 && c >= 6 && c <= 10) ||
                  (r === 7 && (c === 5 || c === 6 || c === 8 || c === 9)) ||
                  (r === 8 && (c === 5 || c === 9)));

              let cellStyle: React.CSSProperties = {};
              let cellClass = 'aspect-square border-[0.5px] border-[#8C887E]/50';

              if (isOccludedCell) {
                cellClass += ' bg-[#D93829]';
              } else if (sampledColors && sampledColors[idx]) {
                cellStyle = { backgroundColor: sampledColors[idx] };
              } else if (isButtonRow) {
                cellClass += isRepaired ? ' bg-[#1D6F42]' : ' bg-[#222225]';
              } else {
                cellClass += ' bg-[#E2DFD7]';
              }

              return <div key={idx} className={cellClass} style={cellStyle} />;
            })}
          </div>

          {/* Centered Target Text inside the pixel band */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <span className="font-sans font-bold text-[14px] tracking-tight text-[#FFE4E1] drop-shadow-[0_1px_2px_rgba(0,0,0,0.85)] px-1 text-center truncate">
              {targetLabel.length > 16 ? `${targetLabel.slice(0, 15)}…` : targetLabel}
            </span>
          </div>
        </div>
      ) : (
        <div className="mt-2 p-2 rounded-[3px] border border-[#181816] bg-[#D6D3C9] font-mono text-[10px] space-y-1.5 text-[#181816] h-[134px] overflow-hidden flex flex-col justify-between shadow-2xs">
          <div className="flex justify-between border-b border-[#B8B4A9] pb-1">
            <span className="text-[#4A4843]">Target:</span>
            <span className="font-bold truncate max-w-[120px]">{targetLabel}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#4A4843]">BBox:</span>
            <span className="font-semibold tabular-nums">
              [{displayBBox[0]}, {displayBBox[1]}, {displayBBox[2]}×{displayBBox[3]}]
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#4A4843]">Area:</span>
            <span className="tabular-nums">
              {displayT0Area.toLocaleString()}px → {displayTkArea.toLocaleString()}px
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#4A4843]">SAM rSam:</span>
            <span className="font-semibold tabular-nums">{(displayRSam * 100).toFixed(2)}%</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#4A4843]">Pixel NCC:</span>
            <span className="font-semibold tabular-nums">{(displayVisRatio * 100).toFixed(2)}%</span>
          </div>
          <div className="flex justify-between border-t border-[#B8B4A9] pt-1">
            <span className="text-[#4A4843]">3σ Floor:</span>
            <span className="text-[#1D4D35] font-semibold tabular-nums">
              {threshold}% | Δ: {delta}
            </span>
          </div>
        </div>
      )}

      {/* Bottom Progress Bar & Interactive Mode Tabs */}
      <div className="mt-2">
        <div className="w-full h-1 bg-[#C8C4B8] rounded-full overflow-hidden">
          <div
            className={`h-full transition-all duration-300 ${isRepaired ? 'bg-[#2E7D52]' : 'bg-[#181816]'}`}
            style={{ width: `${Math.round(100 - lossPercent)}%` }}
          />
        </div>
        <div className="mt-1.5 flex items-center justify-between font-mono text-[10px]">
          <button
            type="button"
            onClick={() => setActiveTab('pixel')}
            className={`px-1.5 py-0.5 rounded-[2px] transition-colors cursor-pointer ${
              activeTab === 'pixel'
                ? 'bg-[#181816] text-white font-semibold'
                : 'text-[#4A4843] hover:text-[#181816]'
            }`}
          >
            Tiny pixel
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('analytics')}
            className={`px-1.5 py-0.5 rounded-[2px] transition-colors cursor-pointer ${
              activeTab === 'analytics'
                ? 'bg-[#181816] text-white font-semibold'
                : 'text-[#4A4843] hover:text-[#181816]'
            }`}
          >
            analytics
          </button>
        </div>
      </div>
    </div>
  );
};

/**
 * 6. MiniDescendingSparkline: The 28px x 16px SVG slope icon located in the bottom timeline next to Active Frame: t 7
 */
export const MiniDescendingSparkline: React.FC<{ className?: string }> = ({
  className = 'w-7 h-4',
}) => (
  <svg viewBox="0 0 28 16" fill="none" className={className} aria-hidden="true">
    <path
      d="M2 2L8 4L14 7L20 11L26 14"
      stroke="#181816"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <circle cx="26" cy="14" r="1.5" fill="#181816" />
  </svg>
);
