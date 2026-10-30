# Skill: Spectra Field Monitor UI (Swiss Industrial Technical Grid)

## 1. Exact Color & Surface Tokens (Hex Lock)
- `--fm-bg-surface`: `#EAE7DF` (Primary shell, TopBar, LeftPane, TelemetryPane, Bottom Timeline, Loupe Window)
- `--fm-bg-elevated`: `#DFDCD3` (Selected scenario row, inactive mechanical keycap, hover surface, secondary card)
- `--fm-bg-well`: `#D6D3C9` (Inset contract box `.spectra/invariants.json`, code diff well, input field well)
- `--fm-bg-stage`: `#E5E2DA` (Center Optical Viewport dot-grid backdrop)
- `--fm-dot-color`: `#B5B1A6` (`radial-gradient(#B5B1A6 1px, transparent 1px)` at `12px 12px`)
- `--fm-border`: `#B8B4A9` (All `1px solid` flush structural pane dividers and row hairlines)
- `--fm-border-strong`: `#181816` (`1.5px solid #181816` for active top tab, active keycap, and floating loupe window)
- `--fm-ink`: `#181816` (Primary text, giant telemetry numbers, active button background, rangefinder reticles)
- `--fm-ink-secondary`: `#4A4843` (Secondary descriptions, subtitles, axis labels)
- `--fm-ink-muted`: `#78756E` (Muted metadata, inactive icons)
- `--fm-danger-pill`: `#E05246` (Solid coral red pill for `REJECTED • 15.18% LOSS` and `15.0% Overlap / Occluded` callout)
- `--fm-danger-soft-bg`: `#F2C6BE` (Soft coral background for `15.0% Overlap`, `10.0% Edge`, `15.0% Collision` scenario tags)
- `--fm-danger-soft-text`: `#9E2A22` (Text color inside soft coral scenario tags)
- `--fm-danger-soft-border`: `#DF9B90` (Border color for soft coral scenario tags)
- `--fm-verified-bg`: `#DCE8DF` (Top-right calibration pill & verified status badge background)
- `--fm-verified-text`: `#1D4D35` (Verified text color)
- `--fm-verified-border`: `#9BB8A5` (Verified border color)
- `--fm-verified-led`: `#2E7D52` (Green LED dot & peak meter bar)

## 2. Typography & Numeric Hierarchy
- **Font Families:**
  - Technical / Headers / Metrics / Coordinates / Buttons: `'JetBrains Mono', 'SF Mono', ui-monospace, Menlo, monospace`
  - Prose Subtitles: `'Inter', -apple-system, BlinkMacSystemFont, sans-serif`
- **Scale:**
  - Pane Section Headers (`REPAIR SCENARIOS`, `SPECTRA REFEREE`, `VIDEO INGEST & PIPELINE`, `BENCHMARK MATRIX`): `font-mono text-[12px] font-semibold uppercase tracking-[0.06em] text-[#181816]`
  - Giant Hardware Readouts (`15,708 px`, `84.82%`, `ACTIVE`, `0.0%`): `font-mono text-[26px] leading-none font-medium tracking-[-0.03em] text-[#181816] tabular-nums`
  - Timeline Keycaps (`t_0(ts)` .. `t_7(%)`): `font-mono text-[11px] font-medium px-2 py-0.5 rounded-[3px]`
