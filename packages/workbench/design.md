# Design System Specification & Hallmark Audit: SPECTRA V3.0 Workbench

> **Locked Hallmark Design Contract (`v2.0.0`)**  
> **Status:** AUDITED & LOCKED FOR PROMPT 02 REDESIGN  
> **Target Package:** `packages/workbench`  
> **Theme:** `Console` (`console`) · **Genre:** `modern-minimal` (Precision Hardware / Optical Measurement Instrument)  
> **Axes:** Dark graphite ground (`dark 17 250`) / `Host Grotesk` / `chromatic-amber 80` · **Posture:** Restrained  

---

## 1. Hallmark Pre-Flight & Static Slop Audit

A static audit was conducted using Hallmark's `sloplint` against `packages/workbench/src/` (`index.css` and `App.tsx`).

### Sloplint Audit Findings
```
sloplint summary: 16 FAIL, 3 WARN across packages/workbench/src/
- FAIL 20 :1   No Hallmark stamp on line 1 of CSS
- FAIL 27 :67  CSS transitions without prefers-reduced-motion fallback
- FAIL 34 :13  width: 100vw on html, body causing horizontal scrollbar jump
- FAIL 34 :17  overflow-x: hidden on root container breaking sticky positioning
- FAIL 48 :18  Color literals outside tokens (#09090b, rgba(255,255,255,0.12), rgba(0,0,0,0.7), etc.)
- WARN 29 :45  Glassmorphic backdrop-filter blur over translucent black (.glass-panel)
- WARN 29 :52  Nested glass panels with conflicting blur radii (.glass-panel-elevated)
```

### The 4 Critical UI Slop Violations Recorded

1. **Violation 1: Header Text Multi-Line Wrapping**
   - *Problem:* Header titles wrap onto 4 disjointed vertical lines (`Visual / Referee / for AI / Agents` and `Closed- / Loop / Arena`) when viewport width varies.
   - *Fix:* Flat, single-line brand bar with `white-space: nowrap`, rigid flex baseline alignment, and clean subhead categorization.

2. **Violation 2: AI-Slop Box Shadows, Neon Glows & Nested Card Clipping**
   - *Problem:* Excessive blurry purple (`rgba(129, 140, 248, 0.25)`), indigo, and crimson drop shadows layered on nested cards-inside-cards in the telemetry column, pushing the action buttons and raw JSON beyond the fold and causing bottom vertical clipping.
   - *Fix:* Replace all box-shadows with `box-shadow: none`. Use `Console` 1px hairline rules (`--color-rule`), stepped graphite surfaces (`--color-paper`, `--color-paper-2`, `--color-paper-3`), and pure tabular alignment.

3. **Violation 3: Viewport Occlusion by Warning Banner**
   - *Problem:* The active warning banner ("Occlusion Detected: 9.60% Loss") was rendered directly *inside* the `1280x720` video/canvas frame container, occluding the target button `[909, 600, 342, 51]` during live verification.
   - *Fix:* Evict all floating alert cards from the optical viewport. The viewport stage must strictly display the clean frame pixels + glowing SAM SVG vector mask. Banners and callouts are routed to the top telemetry banner or verdict audit panel.

4. **Violation 4: Lack of High-Precision Hierarchy & Missing 2.5x Target Zoom Strip**
   - *Problem:* The viewer cannot visually verify subpixel discrepancies because the `1280x720` frame is shrunk without a dedicated zoom loupe or comparison strip.
   - *Fix:* Introduce a dedicated **2.5x Target Zoom Comparison Strip** directly below the main viewport that isolates the `targetBBox` crop across $t_0$ and $t_k$, rendering the decoded SAM 3.1 SVG mask vector contour over the exact target pixels.

---

## 2. Preserved Data Bindings & Empirical Domain Numbers

Under **Spectra Agent Rule 1 (No Fabricated Data)** and **Rule 2 (Noise-Floor from Measurements Only)**, all numbers are permanently locked from real measurements:

### Benchmark Disagreement & False-Pass Rates
| Evaluator Strategy | Ground Truth False-Pass Rate | Status |
| :--- | :--- | :--- |
| **DOM Hit-Testing** | **94.4%** (17/18 false passes) | Fails on visual layering, canvas, and transforms |
| **VLM Open-Weight (`muse-spark-1.3` / `open-1026`)** | **44.4%** (8/18 false passes) | Misses boundary edge-cases and partial drawer overlaps |
| **VLM Flagship** | **61.1%** (11/18 false passes) | Hallucinates button visibility behind translucent scrims |
| **SPECTRA Referee (Dual-Instrument)** | **0.0%** (0/18 false passes) | Zero false passes across all 45 benchmark clips |

### Empirical Precision & Calibration Values
- **Spectra MAE:** `1.11%` (Mean Absolute Error against ground-truth occlusion)
- **$\sigma_{\text{noise}}$ (Noise Floor):** `0.0045` (`0.45%`)
- **$3\sigma$ Rejection Threshold:** `0.0135` (`1.35%` visibility loss)
- **$\Delta$ Disagreement Limit:** `0.0410` (`4.10%`)
- **Calibration Citation:** `run-2026-10-26-45clips-10reps`
- **Clip Specification:** Exactly 8 frames @ 4.0 FPS (2.0s duration, 1280×720)

### Preserved API Endpoints & State Handlers
1. `GET /api/status`: Returns live calibration parameters and model provider connectivity.
2. `POST /api/verify-live`: Dual-instrument referee verification supporting single `.mp4` video upload, auto-bbox extraction, SAM 3.1 SVG masks, and 4 pipeline stages (`frame_extract`, `sam_segment`, `pixel_match`, `referee_verdict`).
3. `POST /api/closed-loop-live`: Closed-loop agent repair replay across `s1`, `s2`, `s3`, returning live 4-phase trace and dynamically rendered `pass2_rendered_tk.png`.
4. `POST /api/compile-voice`: Spoken voice transcript to visual invariant compilation.
5. `POST /api/save-invariant`: Persisting validated invariants to `.spectra/invariants.json`.

---

## 3. Locked `Console` Design System Tokens

```css
/* Hallmark · v2.0.0 · theme: console (graphite) · genre: modern-minimal */
:root {
  /* Surfaces — Stepped neutral graphite, zero bloom */
  --color-paper: oklch(17% 0.008 250);       /* #17181c Base canvas */
  --color-paper-2: oklch(21% 0.009 250);     /* #202227 Hairline card & panel background */
  --color-paper-3: oklch(13.5% 0.007 250);   /* #121316 Deep recessed well / terminal / frame well */

  /* Text & Ink */
  --color-ink: oklch(95% 0.005 250);         /* #f2f3f5 Primary display & reading */
  --color-ink-2: oklch(83% 0.008 250);       /* #cbced4 Secondary reading */
  --color-muted: oklch(71% 0.01 250);        /* #a7abb4 Unit labels, captions, metadata */

  /* Structure & Hairline Borders */
  --color-rule: oklch(31% 0.01 250);         /* #3f424b Standard 1px panel boundary */
  --color-rule-2: oklch(42% 0.012 250);       /* #5b606c Active selection / focus rule */

  /* Semantic Instruments & Roles */
  --color-accent: oklch(82% 0.15 80);        /* Chromatic Amber: User Actions & Operator State */
  --color-accent-ink: oklch(18% 0.04 75);
  --color-accent-soft: oklch(29% 0.05 80);
  --color-focus: oklch(82% 0.15 80);

  --color-cool: oklch(77% 0.12 245);         /* Cool Blue: Instrument A/B Telemetry & Measurements */
  --color-cool-soft: oklch(29% 0.05 245);

  --color-ok: oklch(76% 0.15 150);           /* Referee Pass */
  --color-ok-soft: oklch(24.5% 0.03 150);
  --color-bad: oklch(70% 0.17 25);           /* Referee Fail / Occlusion Detected */
  --color-bad-soft: oklch(24.5% 0.035 25);

  /* Typography */
  --font-display: "Host Grotesk", ui-sans-serif, system-ui, sans-serif;
  --font-body: var(--font-display);
  --font-outlier: "Atkinson Hyperlegible Mono", ui-monospace, monospace;

  /* Metric Rules */
  --radius-card: 10px;
  --radius-pill: 6px;
  --rule-hair: 1px;
  --shadow-card: none;                       /* Hard floor: no blurred shadows */
  --tracking-display: -0.03em;
  --display-weight: 500;

  /* Motion */
  --dur-short: 140ms;
  --dur-med: 220ms;
  --ease-out: cubic-bezier(0.16, 1, 0.3, 1);
}

@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

## 4. Layout Architecture for Prompt 02

```
+---------------------------------------------------------------------------------------------------+
| HEADER BAR (52px, single line, no wrap)                                                           |
| [SPECTRA V3.0 / Visual Referee] | [Benchmark Replay (45)] [Closed-Loop (3)] [Live Studio (MP4)] | Cal |
+--------------------------------------------------+------------------------------------------------+
| LEFT PANEL (280px)                               | MAIN VIEWPORT STAGE (1280x720 scaled)          |
| - Clip Browser / Upload Target Dropzone          | - Frame Stage with SAM 3.1 SVG mask overlay    |
| - Scenario S1/S2/S3 Picker                       | - Baseline (t0) / Evaluated (tk) Toggle        |
| - Voice Invariant Recording Trigger              | - BBox HUD [909, 600, 342, 51]                 |
|                                                  +------------------------------------------------+
|                                                  | 2.5x TARGET ZOOM COMPARISON STRIP (160px)       |
|                                                  | [ t0 Target Crop ] vs [ tk Target Crop + SAM ] |
+--------------------------------------------------+------------------------------------------------+
| RIGHT TELEMETRY & ARBITRATION DECK (380px)                                                        |
| - Dual-Instrument Consensus Verdict Badge: PASS / FAIL / INCONCLUSIVE                             |
| - Instrument A (SAM 3.1): rSam, Occlusion %, Baseline Area, Eval Area                             |
| - Instrument B (Pixel Match): visRatio, Pixel Loss Count, Total Pixels                            |
| - 4-Stage Pipeline Timings: frame_extract -> sam_segment -> pixel_match -> referee_verdict        |
| - CLI Equivalent & MCP Payload Drawer (One-Click Copy)                                            |
+---------------------------------------------------------------------------------------------------+
```

---

## 5. Review & Execution Rules for Prompt 02
1. **Zero UI component code edits** shall take place until this `design.md` contract is committed.
2. All components in `packages/workbench/src/components/` and `App.tsx` will strictly consume the `--color-*` and `--font-*` tokens from `tokens.css` / `index.css`.
3. The 2.5x Zoom Comparison Strip must be a first-class citizen rendered below the main viewport canvas.
4. All 11 automated test suites in `packages/workbench/src/__tests__/data-bundle.test.ts` must maintain a 100% pass rate.
