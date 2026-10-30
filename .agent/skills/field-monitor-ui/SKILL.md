# Skill: Field Monitor UI (Teenage Engineering / Leica Optical Rangefinder Grid)

## 1. Color & Surface Tokens (Strict Hex Lock)
- Primary Putty Surface (Shell, TopBar, LeftPane, TelemetryPane, Bottom Timeline): `#EAE7DF`
- Active / Selected Row Surface: `#DFDCD3`
- Inset Contract Well Surface: `#D6D3C9`
- Center Stage Dot-Grid Backdrop: `#E5E2DA` with `radial-gradient(#B5B1A6 1px, transparent 1px)` at `background-size: 12px 12px`
- Structural 1px Hairline Border: `#B8B4A9` (`border-[#B8B4A9]`)
- Active Mechanical Tab / Keycap Border: `1.5px solid #181816`
- Primary Ink: `#181816`
- Secondary Technical Text: `#4A4843`
- Muted Label Text: `#6E6B64`
- Defect Alert Pill (`REJECTED • 15.18% LOSS`): `#E05246` background, `#FFFFFF` text
- Scenario Soft Coral Badge (`15.0% Overlap`, `10.0% Edge`, `15.0% Collision`): `#F2C6BE` background, `#9E2A22` text, `#DF9B90` 1px border
- Calibration Verified Pill: `#DCE8DF` background, `#1D4D35` text, `#9BB8A5` 1px border, `#2E7D52` LED indicator

## 2. Typography Rules
- All headers (`REPAIR SCENARIOS`, `SPECTRA REFEREE`), coordinates, percentages, and frame keys (`t_0(ts)`..`t_7(%)`) use `'JetBrains Mono', ui-monospace, SFMono-Regular, monospace` with `font-variant-numeric: tabular-nums`.
- Large instrument readouts (`15,708 px`, `84.82%`, `ACTIVE`) use `font-mono text-[26px] leading-none font-medium tracking-[-0.03em] text-[#181816] tabular-nums`.
- Never use rounded-2xl cards, drop shadows, or dark-mode backgrounds on the shell. All layout panes meet flush edge-to-edge with `1px solid #B8B4A9` dividers.
