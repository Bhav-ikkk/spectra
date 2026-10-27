# Spectra V3.0 — Roadmap & Phase Gates

## Phase 1 (Day 1) — Foundation & Spikes

- Monorepo scaffold (pnpm workspaces, TypeScript NodeNext)
- Spike 1: SAM 3.1 live jitter & initial calibration
- Spike 2: VLM blind-spot verification on partial occlusions
- Spike 3: Muse Code CLI fallback verification
- Quality gates: typecheck, lint, test, format:check

## Phase 2 (Days 2–3) — Benchmark & Measurement Engine

- Benchmark generation (`tools/benchmark-gen` with 45 realistic UI clips across 3 environments)
- Dual-Instrument Engine in `@spectra/core` (Instrument A: SAM 3.1 Visibility Ratio, Instrument B: Deterministic Pixel Matcher + $R_{\text{NCC}}$)
- Live UI Calibration from static clean control clip (`sigma_noise = 0.011`, $\delta = 0.022$)
- Live ASR (`muse-voice-transcribe-1.0`) & Invariant Compiler (`muse-spark-1.3`)
- Single unified SDK `@spectra/sdk` providing `SpectraClient`

## Phase 3 (Days 4–5) — MCP Server & Closed Loop Referee

- Stdio MCP server `@spectra/mcp-server`
- Repair loop with Muse Code: reject-then-verify cycle
- Day-4 Gate: 1 scenario healed end-to-end with logged reject-then-verify

## Phase 4 (Days 6–7) — Workbench & Interactive Visualization

- 3-pane workbench (`@spectra/workbench`): target view, live masks, referee telemetry
- Telemetry logging and timeline replay

## Phase 5 (Days 8–10) — Polish, Docs & Submission

- Final benchmark run across all 45 clips
- Demo video recording
- Submission deliverables

---

## Feature (deferred): Spectra Lens, a live screen-capture front end

STATUS: Do NOT start until the core engine passes the Day-4 gate (one scenario
healed end to end with a logged reject-then-verify, calibration measured per
Rule 2, CI green on a fresh clone). Until then, ignore this section.

WHAT IT IS: An optional desktop shell (Tauri or Electron) over @spectra/sdk.
A global hotkey lets the user mark a screen region and speak, instead of
uploading a video. It adds no new measurement logic.

FLOW: hotkey -> user marks a region -> short capture of that region only ->
Muse Voice transcribes the spoken expectation -> SDK runs spectra verify ->
verdict overlay on screen (REJECTED / VERIFIED / INCONCLUSIVE, with the
measured numbers). If the user says "update it in our code", hand the
rejection payload to Muse Code through the existing repair loop.

RULES:

- It is a thin skin. All measurement, calibration and verdicts come from
  @spectra/sdk. Never fork logic into the shell.
- Push-to-capture only. No always-on screen reading. Show a visible
  recording indicator and send only the marked region.
- Use a normal hotkey chord (e.g. Ctrl+Shift+Space). Do not bind Caps Lock.
- Code edits work only for apps the user controls, and need a source mapping
  (source maps or component markers) from pixels to files. If no mapping
  exists, report the verdict and say so. Do not guess the file.
- Rule 1 applies: the overlay shows only numbers the pipeline produced.
- The demo needs a cached-replay mode alongside live mode, since live capture
  is fragile.

STRETCH (only after the Lens works): "Save this reference UI". Extract
measurable properties (spacing, contrast, must-stay-visible regions) as
invariants. Spectra then judges whether the agent's build matches them. This
is a fidelity check, not a cloning tool. Use it for the user's own references
only.

DONE MEANS: the user marks a region, speaks, and gets a real verdict overlay
on a recorded scenario, with evidence files for the run.
