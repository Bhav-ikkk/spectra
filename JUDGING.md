# SPECTRA V3.0 — JUDGING GUIDE & TECHNICAL AUDIT WALKTHROUGH

> _"Don't trust 'done.' Measure it."_

---

## 1. 30-Second Pitch & Track Routing

**Positioning Statement (Verbatim):**
> *"I'm a solo dev. AI coding agents kept telling me complex frontend features were 'done' when UI elements were actually clipped, hidden, or covered by drawers. So I built the visual referee I wished existed—on Meta's own AI stack—and benchmarked it honestly across 45 clips, including the parts where it strictly refuses to guess."*

### Track Submissions
1. **Primary Track:** **Indie Solo** (Built 100% solo across 7 monorepo packages: Core, SAM Client, Invariant Compiler, SDK, CLI, MCP Server, and Swiss Industrial Workbench).
2. **Category / Bonus Tracks:**
   - **Best Use of Meta AI:** End-to-end integration of 4 Meta AI models/developer surfaces: `sam-3.1` (video segmentation via `@meta-sam/parser@0.1.0`), `muse-spark-1.3` (multimodal VLM judge), `muse-voice-transcribe-1.0` (spoken invariant ingestion), and `meta-models/muse-spark-open-1026` (open-weight patch generation on Baseten).
   - **Best Dev Tool / Agent Infrastructure:** Model Context Protocol (MCP) stdio server exposing 4 bounded tools (`spectra_verify`, `spectra_check`, `spectra_compile_invariant`, `spectra_closed_loop`) to Muse Code, Claude Code, and Cursor.
   - **Open Source / Technical Achievement:** Dual-instrument optical consensus engine with calibrated noise floor ($3\sigma = 1.35\%$, $\delta = 4.10\%$, MAE $1.11\%$), 138 passing offline tests, zero live API spend ($0.00), and Rule 1 non-fabrication guarantee.

---

## 2. 60-Second Offline Judge Quickstart ($0.00 Spend, Wifi OFF Safe)

Spectra is built **offline-first**. All benchmark clips, live response JSONs, and deterministic scene renderers are cached locally—making live venue demos 100% resilient to Wi-Fi drops and token limits.

```bash
# 1. Install & Build Full Monorepo
pnpm install
pnpm -r build

# 2. Verify all 138 Unit & Contract Tests Pass Offline ($0.00 Spend)
pnpm -r test

# 3. Run Zero-BBox Auto-Resolution Optical Verification via Production CLI
pnpm --filter @spectra/cli verify \
  --video benchmark/clips/dom_catch_010_v1.mp4 \
  --target "Complete Checkout"

# 4. Run the Complete 3-Scenario Autonomous Closed-Loop Demo
pnpm --filter @spectra/cli closed-loop-demo --scenario all

# 5. Launch the Swiss Industrial Grid Workbench
pnpm start
# Open http://localhost:4173 in any browser
```

---

## 3. The 3-Act, 3-Minute Live Demo Walkthrough

### Act 1: "The Catch" (Scenario S3 — Sticky Cart Drawer Edge Occlusion)
- **The Problem:** An agent creates a checkout drawer that slides in from the bottom. The drawer clips the bottom **10%** of the primary `[Complete Checkout]` CTA button.
- **Why Naive Evaluators Fail:**
  - **DOM Center Hit-Test (`document.elementFromPoint(1080, 625)`):** Evaluates the mathematical button center, which remains unobstructed $\to$ **FALSE PASS (100% Missed)**.
  - **Flagship VLM (`muse-spark-1.3`):** Hallucinates that a blue rectangle labeled "Complete Checkout" is functional $\to$ **FALSE PASS (100% Missed)**.
- **Spectra Referee Verdict:**
  - Decodes `sam-3.1` video segmentation ($t_0 \dots t_7$): $r_{\text{SAM}} = 0.9080$ ($9.20\%$ mask loss).
  - Runs deterministic RGB template match ($R_{\text{NCC}}$): $\text{visRatio} = 0.9000$ ($10.00\%$ loss = $1{,}700 / 17{,}000$ px occluded).
  - Cross-instrument residual: $\|0.9080 - 0.9000\| = 0.0080 \le 0.0410$ ($\delta$ bound).
  - Loss exceeds sensor noise floor: $9.60\% > 1.35\%$ ($3\sigma$).
  - **Verdict:** **`REJECTED`** with exact pixel count ($1{,}700\text{ px}$) and coordinates (`{ x: 909, y: 600, width: 342, height: 51 }`).

### Act 2: Voice-to-Invariant + Closed-Loop Autonomous Repair
- **Voice Ingestion:** In Tab 3 ("Voice Invariants"), click the zero-latency verified replay or speak: *"When the cart drawer opens, the checkout button must never be covered."*
- **Compiler:** `muse-voice-transcribe-1.0` ingests audio $\to$ `muse-spark-1.3` compiles to formal [`.spectra/invariants.json`](file:///d:/Bhavik/Spectra/.spectra/invariants.json).
- **Automated Repair:** `meta-models/muse-spark-open-1026` receives the optical rejection telemetry and generates a surgical CSS patch in `CartDrawer.css`:
  ```css
  /* Synthesized Repair Patch */
  bottom: 84px;
  z-index: 9999;
  ```
- **Re-Verification (Pass #2):** Spectra automatically re-renders the patched DOM scene in $< 40\text{ms}$ and re-evaluates:
  $r_{\text{SAM}} = 1.0000$, $\text{visRatio} = 1.0000$, loss = $0.00\%$ $\to$ **`VERIFIED`**.

### Act 3: The 21-Clip 4-Evaluator Benchmark & Live Video Dropzone
- **Tab 2 ("45-Clip Benchmark Matrix"):** Filter by `CANVAS`, `MOBILE_MP4`, and `DOM_CATCH`. Toggle between False-Pass Rate and Detection Rate.
- **Key Empirical Benchmark Data (Rule 1 Verified):**
  - Evaluated on **21 canonical `v1` clips** (18 occluded failure cases + 3 clean controls) across 4 evaluators:
    - DOM Center Hit-Test: **94.4% false-pass** (17/18 missed)
    - Muse Spark 1.3: **61.1% false-pass** (11/18 missed)
    - Muse Spark Open 1026: **44.4% false-pass** (8/18 missed)
    - **Spectra Referee:** **0.0% false-pass** (18/18 caught, **1.11% MAE** against ground truth).
  - Instrument B + DOM additionally swept across all 45 clips (`v1`–`v3`).
- **Tab 1 ("Upload & Verify Video"):** Drop any `.mp4` into the dropzone. Spectra automatically extracts frames, runs auto-bounding box detection from SAM Frame 0, overlays SVG polygons, and displays dual-instrument telemetry.

---

## 4. Direct File Pointers for Technical Judges

| Component | Repository Path | What to Look For |
| :--- | :--- | :--- |
| **Dual-Instrument Referee Math** | [`packages/core/src/referee.ts`](file:///d:/Bhavik/Spectra/packages/core/src/referee.ts) | Strict $3\sigma$ noise gating, $\delta$ cross-instrument thresholding, and refusal to guess (`INCONCLUSIVE`). |
| **Rule 2 Calibration Contract** | [`packages/core/src/calibration.ts`](file:///d:/Bhavik/Spectra/packages/core/src/calibration.ts) & [`calibration.json`](file:///d:/Bhavik/Spectra/packages/core/src/calibration.json) | `assertCalibrated()`, $\sigma_{\text{noise}} = 0.0045$, $\delta = 0.0410$, and live run citation `resp_6ae03ef78bd3db0853c642af`. |
| **Calibration Derivation Note** | [`packages/core/CALIBRATION_NOTE.md`](file:///d:/Bhavik/Spectra/packages/core/CALIBRATION_NOTE.md) | Full mathematical writeup of temporal mask variance ($s = 47.06\text{ px}$) and cross-instrument residual bounds. |
| **Model Verification Proofs** | [`docs/MODEL_VERIFICATION.md`](file:///d:/Bhavik/Spectra/docs/MODEL_VERIFICATION.md) | Official Meta documentation links, live API endpoints, and saved response JSON proofs for all 4 models. |
| **Full Benchmark Report** | [`benchmark/results/referee_benchmark_report.json`](file:///d:/Bhavik/Spectra/benchmark/results/referee_benchmark_report.json) | Raw JSON report containing per-clip latencies, verdicts, and occlusion curves for all 4 evaluators. |
| **MCP Integration Server** | [`packages/mcp-server/src/index.ts`](file:///d:/Bhavik/Spectra/packages/mcp-server/src/index.ts) | 4 exposed tools with zero-bbox auto-resolution from SAM Frame-0 masks. |
| **SAM 3.1 Stream Parser** | [`packages/sam-client/src/index.ts`](file:///d:/Bhavik/Spectra/packages/sam-client/src/index.ts) & [`parser-pin.test.ts`](file:///d:/Bhavik/Spectra/packages/sam-client/src/__tests__/parser-pin.test.ts) | Stream chunk parsing, COCO RLE, SVG polygon generation, and parser wire-grammar pin tests. |
| **Agent Guardrails Policy** | [`AGENTS.md`](file:///d:/Bhavik/Spectra/AGENTS.md) | Strict, non-negotiable rules for AI agents: Rule 1 (No Fabrication), Rule 2 (Measured Noise Floor), Rule 6 (8-Frame Cap). |

---

## 5. Token Economy & Hardware Telemetry

Spectra enforces a strict **8-frame cap at 4 FPS** ($1280 \times 720$, 2.0s duration) for all video processing. This guarantees:
- Minimal token consumption on Meta's SAM 3.1 API.
- ~480ms optical verification latency on cached responses ($0.00 spend).
- Live API calls only when explicitly requested via `--live` flag.

