# SPECTRA V3.0 — The Visual Referee for AI Agents

> _"Don't trust 'done.' Measure it."_

[![Build & Test](<https://img.shields.io/badge/CI%20Status-Passing%20(138%20tests)-emerald?style=for-the-badge&logo=githubactions>)](https://github.com/Bhav-ikkk/spectra/actions)
[![Rule 1 Verified](https://img.shields.io/badge/Rule%201-100%25%20Non--Fabricated%20Data-blue?style=for-the-badge)](file:///d:/Bhavik/Spectra/AGENTS.md)
[![Rule 2 Calibrated](https://img.shields.io/badge/Rule%202%20Calibrated-σ_noise%200.45%25%20%7C%203σ%201.35%25-purple?style=for-the-badge)](file:///d:/Bhavik/Spectra/packages/core/src/calibration.json)
[![Meta AI Models](https://img.shields.io/badge/Meta%20AI-SAM%203.1%20%7C%20Muse%20Spark%20%7C%20Muse%20Voice-indigo?style=for-the-badge)](https://dev.meta.ai)
[![Baseten Open Weight](https://img.shields.io/badge/Baseten-muse--spark--open--1026-teal?style=for-the-badge)](https://baseten.co)

**Spectra** is the open-source, dual-instrument visual referee engine for AI coding agents. When agents like Muse Code, Devin, or SWE-bench claim a UI feature is "done", Spectra verifies visual invariants using sub-pixel optical measurement—catching subtle regressions that DOM checks, screenshot-diffing, and raw LLM vision models completely miss.

---

## The 10-Second Story ("The Catch")

```
   AGENT CODE REVISION (Pass #1)
   ┌────────────────────────────────────────────────────────┐
   │  [Complete Checkout] CTA Button                        │
   │  (90% Visible — Bottom 10% Clipped by Sticky Drawer)   │
   └────────────────────────────────────────────────────────┘
          │                                     │
          ▼                                     ▼
   DOM Hit-Test at Center (1080, 625)    Muse Spark 1.3 Raw VLM
   "Element center is clickable!"        "I see a blue checkout button!"
   ❌ FALSE PASS (0% Detection)          ❌ FALSE PASS (0% Detection)
          │                                     │
          └──────────────────┬──────────────────┘
                             ▼
              SPECTRA REFEREE DUAL-INSTRUMENT
              Instrument A (SAM 3.1):   rSam = 0.9080  (9.20% loss)
              Instrument B (Pixel):     visRatio = 0.9000 (10.00% loss)
              Agreement Delta:          0.80% <= 4.10% (Δ Limit)
              Loss Exceeds Noise Floor: 9.60% > 1.35% (3σ Threshold)
              ───────────────────────────────────────────────────
              🚨 VERDICT: REJECTED (1,700 / 17,000 px Occluded)
                             │
                             ▼
             SPECTRA MCP REJECTION TELEMETRY
                             │
                             ▼
              muse-spark-open-1026 (Baseten)
              Synthesizes CSS patch in CartDrawer.css:
              `bottom: 84px; z-index: 9999;`
                             │
                             ▼
              PASS #2 RE-VERIFICATION: VERIFIED
              rSam = 1.0000 | visRatio = 1.0000 | Loss = 0.00%
```

Every coding agent today uses either **DOM center-point hit testing** (`document.elementFromPoint(x, y)`) or **raw VLM self-evaluation** to confirm that a web feature is functional. Both methods suffer from fatal blind spots:

1. **DOM hit testing** tests a single mathematical coordinate (e.g. button center $(1080, 625)$). If a bottom sheet or floating cart drawer covers the bottom $10\%$ of the button, the center remains unoccluded, producing a **false pass**.
2. **Raw VLMs** (`muse-spark-1.3`, GPT-4o, Claude 3.5 Sonnet) suffer from token quantization and bounding box hallucinations—falsely declaring clipped elements as "looks great and fully visible!"

**Spectra solves this with Dual-Instrument Optical Verification**: combining Meta's `sam-3.1` (decoded via `@meta-sam/parser`) with deterministic pixel template normalized cross-correlation ($R_{\text{NCC}}$), calibrated to a measured $3\sigma_{\text{noise}} = 1.35\%$ threshold.

---

## How Each Meta AI Tool Is Used

Spectra integrates 5 specialized Meta AI models and developer surfaces across an automated closed loop:

| Tool / Model                                                  | Role in Spectra                                                                                                                                                                         | Implementation Location                                                                                                                |
| :------------------------------------------------------------ | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------- |
| **SAM 3.1** (`sam-3.1`)                                       | **Instrument A Optical Segmenter**: Segments target UI elements across video frames ($t_0 \dots t_7$ at 4 FPS), outputting high-precision polygon masks.                                | [`packages/sam-client`](file:///d:/Bhavik/Spectra/packages/sam-client)                                                                 |
| **`@meta-sam/parser`**                                        | **Mask Stream Parser**: Decodes raw SAM 3.1 chunked streaming responses into SVG polygon paths and rasterized bitmask pixel counts.                                                     | [`packages/sam-client/src/index.ts`](file:///d:/Bhavik/Spectra/packages/sam-client/src/index.ts)                                       |
| **Muse Voice Transcribe** (`muse-voice-transcribe-1.0`)       | **Audio Invariant Ingestion**: Converts spoken user instructions (_"When cart drawer opens, checkout must never be covered"_) into text.                                                | [`packages/invariant-compiler/src/transcribe.ts`](file:///d:/Bhavik/Spectra/packages/invariant-compiler/src/transcribe.ts)             |
| **Muse Spark 1.3** (`muse-spark-1.3`)                         | **VLM Judge & Compiler**: Evaluates natural language transcripts into formal [`.spectra/invariants.json`](file:///d:/Bhavik/Spectra/.spectra/invariants.json) visual invariant schemas. | [`packages/invariant-compiler/src/compile.ts`](file:///d:/Bhavik/Spectra/packages/invariant-compiler/src/compile.ts)                   |
| **Muse Spark Open 1026** (`meta-models/muse-spark-open-1026`) | **Baseten Open-Weight Reasoner**: Powers high-volume VLM evaluations and synthesizes automated CSS layout patches from Spectra rejection telemetry.                                     | [`packages/invariant-compiler/src/compile.ts`](file:///d:/Bhavik/Spectra/packages/invariant-compiler/src/compile.ts)                   |
| **Muse Code MCP** (`spectra-mcp`)                             | **Agent Integration**: Standard Model Context Protocol stdio server allowing Muse Code or any MCP-compatible agent to invoke Spectra Referee natively.                                  | [`packages/mcp-server`](file:///d:/Bhavik/Spectra/packages/mcp-server)                                                                 |

---

## Empirical 4-Evaluator Referee Benchmark Results

Evaluated across 21 canonical `v1` clips (18 occluded failure clips + 3 clean controls) for all 4 evaluators (DOM Center Hit-Test: 94.4% false-pass, Muse Spark 1.3: 61.1% false-pass, Muse Spark Open 1026: 44.4% false-pass, Spectra Referee: 0.0% false-pass, 1.11% MAE); Instrument B + DOM additionally swept across all 45 clips (`v1`–`v3`).

All measurements below are **100% genuine and reproducible** from [`benchmark/results/referee_benchmark_report.json`](file:///d:/Bhavik/Spectra/benchmark/results/referee_benchmark_report.json) (Rule 1 Non-Fabrication Compliance):

### Overall Evaluator Summary (18 Occluded Clips)

| Evaluator                             | Overall False-Pass Rate | Detection Rate |   Missed Clips    | Avg Latency | Mean Absolute Error (MAE) |
| :------------------------------------ | :---------------------: | :------------: | :---------------: | :---------: | :-----------------------: |
| **DOM Center Hit-Test**               |        **94.4%**        |      5.6%      |  17 / 18 missed   |    0 ms     |       N/A (Binary)        |
| **Muse Spark 1.3 (Meta API)**         |        **61.1%**        |     38.9%      |  11 / 18 missed   |  6,439 ms   |     N/A (Subjective)      |
| **Muse Spark Open 1026 (Baseten)**    |        **44.4%**        |     55.6%      |   8 / 18 missed   |  5,745 ms   |     N/A (Subjective)      |
| **SPECTRA REFEREE (Dual-Instrument)** |        **0.0%**         |   **100.0%**   | **0 / 18 missed** | **480 ms**  |         **1.11%**         |

### Empirical Occlusion Curve by Level (False-Pass Rate %)

| Occlusion Level          | Tested Clips | DOM Hit-Test | Muse Spark Open 1026 | Muse Spark 1.3 |   Spectra Referee   |
| :----------------------- | :----------: | :----------: | :------------------: | :------------: | :-----------------: |
| **0.0% (Clean Control)** |      3       |     0.0%     |         0.0%         |      0.0%      | **0.0%** (Verified) |
| **5.0% Occlusion**       |      3       |    100.0%    |        100.0%        |     100.0%     |  **0.0%** (Caught)  |
| **10.0% ("The Catch")**  |      3       |  **100.0%**  |        33.3%         |   **100.0%**   |  **0.0%** (Caught)  |
| **15.0% Occlusion**      |      3       |    100.0%    |        66.7%         |     66.7%      |  **0.0%** (Caught)  |
| **25.0% Occlusion**      |      3       |    100.0%    |        66.7%         |     66.7%      |  **0.0%** (Caught)  |
| **40.0% Occlusion**      |      3       |    100.0%    |         0.0%         |     33.3%      |  **0.0%** (Caught)  |
| **60.0% Occlusion**      |      3       |    66.7%     |         0.0%         |      0.0%      |  **0.0%** (Caught)  |

_Key finding: At 10% edge occlusion ("The Catch"), naive DOM hit-testing and flagship Muse Spark 1.3 both suffer a 100% false-pass rate. Spectra Referee achieves 100% detection with zero false passes._

---

## 60-Second Judge Quickstart

### Prerequisites

- Node.js `>= 22.0.0`
- pnpm `>= 9.0.0`

### 1. Install & Build Monorepo (Offline $0.00 Spend)

```bash
# Clone and install dependencies
git clone https://github.com/Bhav-ikkk/spectra.git
cd spectra
pnpm install

# Build all 7 packages (core, sam-client, invariant-compiler, sdk, cli, mcp-server, workbench)
pnpm -r build
```

### 2. Launch the Apple macOS Sequoia Referee Workbench

```bash
# Start production workbench server (zero-dependency Node HTTP)
pnpm start

# Open http://localhost:4173 in your browser
```

- **Tab 1: Closed-Loop Arena**: Replay S1 (Canvas Chart), S2 (Mobile MP4), and S3 ("The Catch"). Toggle between Raw Render, Decoded SAM 3.1 SVG Mask, Naive DOM Crosshair, and Split-Curtain Slider.
- **Tab 2: 45-Clip Benchmark Explorer**: Filter all 45 clips by environment and occlusion level ($0\%$ to $60\%$), with live metric toggling between False-Pass Rate and Detection Rate.
- **Tab 3: Voice-to-Invariant Studio**: Click `"Hold / Click to Record Live Mic (Muse Voice 1.0)"` or test the zero-latency verified replay button.
- **Spectra Lens (HotKey `Ctrl+Shift+Space`)**: Press `Ctrl+Shift+Space` anywhere in the app to activate push-to-capture crosshair selection and view the on-screen verdict HUD.

### 3. Run Production CLI (`@spectra/cli`)

```bash
# Verify a single clip offline using cached SAM masks
pnpm --filter @spectra/cli verify \
  --t0 benchmark/clips/canvas_000_v1_t0.png \
  --tk benchmark/clips/canvas_000_v1_tk.png \
  --target "Monthly Revenue Chart Legend" \
  --bbox 820,240,220,48 \
  --cached-sam benchmark/responses/benchmark-sam/canvas_000_v1_sam.json

# Execute the complete Closed-Loop Demo across all 3 scenarios (S1, S2, S3)
pnpm --filter @spectra/cli closed-loop-demo --scenario all

# Check visual invariants across the full benchmark manifest
pnpm --filter @spectra/cli check \
  --invariants .spectra/invariants.json \
  --manifest benchmark/manifest.json \
  --cached-sam-dir benchmark/responses/benchmark-sam
```

### 4. Connect to Muse Code via MCP (`@spectra/mcp-server`)

```json
{
  "mcpServers": {
    "spectra": {
      "command": "node",
      "args": ["packages/mcp-server/dist/index.js"]
    }
  }
}
```

Exposes 4 bounded tools:
1. `spectra_verify` — Dual-instrument optical verification on a video clip or frame pair (with zero-bbox SAM Frame-0 auto-detection).
2. `spectra_check` — Batch verification of `.spectra/invariants.json` across a clip manifest.
3. `spectra_compile_invariant` — Voice `.wav` (`muse-voice-transcribe-1.0`) or text compilation (`muse-spark-1.3` / `meta-models/muse-spark-open-1026`) into Zod-validated `.spectra/invariants.json`.
4. `spectra_closed_loop` — Autonomous 4-phase Closed-Loop Referee & Repair execution across scenarios `s1`, `s2`, `s3`, or `all`.

### 5. Run Monorepo Test Suites (138 Tests Passing)

```bash
# Offline unit, integration, and contract tests (zero API spend)
pnpm -r test

# Offline smoke test across all 4 benchmark environments
pnpm benchmark:smoke
```

---

## Honest Limitations & Calibration Disclosure

In strict adherence to repository **Rule 1 (No Fabricated Data)** and **Rule 2 (Noise-Floor From Measurements Only)**:

1. **Calibration Parameters**:
   - $\sigma_{\text{noise}} = 0.0045$ ($0.45\%$) was calculated directly from sample standard deviation across 6 clean baseline frames ($t_0 \dots t_5$) on `canvas_000_v1` from live SAM 3.1 run `resp_6ae03ef78bd3db0853c642af` ($\mu = 10{,}573.0\text{ px}$, $s = 47.06\text{ px}$).
   - The visibility loss rejection threshold is strictly $3\sigma_{\text{noise}} = 1.35\%$. Any visibility drop $\le 1.35\%$ is treated as model boundary flutter, not an occlusion.
   - The cross-instrument agreement limit $\delta = 0.041$ ($4.10\%$) was set from $2\times$ the maximum empirical residual ($2.05\%$) between SAM 3.1 area retention and pixel template matching.
2. **Inconclusive Verdict Contract**:
   - If Instrument A and Instrument B disagree by more than $\delta = 4.10\%$, Spectra refuses to guess and emits `INCONCLUSIVE`.
   - If target elements are outside viewport bounds or SAM 3.1 returns zero masks, confidence drops to $0.00$ and `INCONCLUSIVE` is returned.
3. **Source Mapping Requirement**:
   - Automatic code repair requires an honest mapping from pixels to source files (e.g. `CartDrawer.css`, `ChartCanvas.tsx`). For unmapped external frames, Spectra reports optical measurements only and never hallucinates file edits.
4. **Token Protection & 8-Frame Cap**:
   - Live SAM 3.1 video calls are strictly capped at 8 frames at 4 FPS ($1280 \times 720$, 2.0 seconds total) to prevent token waste and keep Meta API credit consumption minimal.

---

## Monorepo Architecture

```
spectra/
├── packages/
│   ├── core/                  # Domain types, calibration math, Dual-Instrument referee engine
│   ├── sam-client/            # @meta-sam/parser integration, chunked stream decoding, SVG generator
│   ├── invariant-compiler/    # muse-voice-transcribe-1.0, muse-spark-1.3, Baseten open-weight runner
│   ├── sdk/                   # High-level SpectraClient, closed-loop runner, benchmark suite
│   ├── cli/                   # Production 'spectra' terminal CLI (verify, compile, check, closed-loop)
│   ├── mcp-server/            # Stdio JSON-RPC 2.0 server for Muse Code integration
│   └── workbench/             # Apple macOS Sequoia 3-Pane Web UI + Spectra Lens overlay + Node HTTP server
├── benchmark/
│   ├── clips/                 # 45 benchmark clips (PNG frames t0..t7 + 8-frame MP4s)
│   ├── responses/             # Live cached SAM 3.1 and Muse Spark responses (0 live cost replay)
│   └── results/               # referee_benchmark_report.json (4-evaluator benchmark data)
├── .spectra/invariants.json   # Spoken visual invariants compiled via Muse Spark
├── render.yaml                # 1-Click Render cloud deployment blueprint
└── AGENTS.md                  # Strict developer & agent rules (Rule 1 & Rule 2 enforcement)
```

---

## License

MIT © 2026 Spectra Contributors. Built for the Meta AI Agent Hackathon.
