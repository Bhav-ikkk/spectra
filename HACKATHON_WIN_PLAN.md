# Spectra V3.0 — Hackathon Win Plan (Indie Solo + Bonus Tracks)

> Goal: win the Indie Developer (solo) track outright and pick up at least one
> extra award (Best Use of Meta AI / Best Dev Tool). This file is the honest,
> no-fabrication battle plan. Every number below comes from a file in this repo,
> not from a fresh run. Where the repo contradicts itself, it is called out as a
> must-fix before judging.

## 0. Verdict up front

- **What it is:** an open-source dual-instrument visual referee for AI coding
  agents. Motto: "Don't trust 'done.' Measure it."
- **Is it a proper product?** Yes as a hackathon-grade product: installable CLI,
  MCP server, and workbench UI, with schema-validated invariants and a
  reproducible benchmark. Not yet a production-hardened measurement instrument
  (calibration sourcing is thin and internally contradictory — see §8).
- **Can it win?** Yes, conditionally. The Meta-native story (SAM 3.1 + Muse
  Spark + Muse Voice), the live speak → verify → patch loop, and the hard
  numbers vs DOM/VLM are exactly what wins Indie Solo + Best Use of Meta AI.
  But three claim/calibration contradictions **will** get caught by a technical
  judge unless fixed first. Fixing them is ~half a day of solo work. This file
  tells you how.

## 1. Product thesis (your 30-second pitch)

> Coding agents say "done" when the button center is clickable or when a VLM
> says "looks great." Both false-pass when the bottom 10% of a button is clipped
> by a drawer. Spectra measures the actual pixels with two independent
> instruments — Meta SAM 3.1 segmentation and deterministic template matching —
> calibrated to a measured noise floor, and either VERIFIES, REJECTS with a
> pixel count, or refuses to guess (INCONCLUSIVE). Then it synthesizes the CSS
> fix and re-verifies. Speak it, build it, measure it.

Why judges care: every agent framework has this blind spot, and you are the
only booth with an optical referee instead of vibes.

## 2. How it works today (current flow)

```text
speak expectation
  → packages/invariant-compiler/src/transcribe.ts
    (POST /asr/transcribe, muse-voice-transcribe-1.0)
  → packages/invariant-compiler/src/compile.ts
    (muse-spark-1.3 on Meta, or muse-spark-open-1026 on Baseten)
  → .spectra/invariants.json (Zod-validated)

agent builds UI → capture 8-frame clip (8f @ 4fps, 1280x720, 2.0s)
  → packages/sdk/src/client.ts :: verifyClip
    → Instrument A: SAM 3.1 masks via packages/sam-client,
      decoded by @meta-sam/parser → R_SAM = min(1, Area(tk)/Area(t0))
    → Instrument B: packages/core/src/instrument-b.ts
      template match → visRatio, measuredLoss, rNcc
    → packages/core/src/referee.ts :: evaluateDualInstrument
      → pass (VERIFIED) / fail (REJECTED) / inconclusive

fail → packages/sdk/src/closed-loop.ts :: runClosedLoopReferee
  (repair via cached/live Spark, renderPatchedScene, re-verify, max 3 attempts,
  4 artifacts) → pass
```

Surfaces: 4-command CLI (`packages/cli`), 4-tool MCP server
(`packages/mcp-server`), workbench UI on `:4173` (`packages/workbench`) with
Arena / Benchmark Explorer / Voice Studio / Live Dropzone tabs plus 5 APIs.

## 3. Deep coding analysis (what is genuinely strong)

- **Referee math is real** (`packages/core/src/referee.ts`): asserts calibration
  first; `|rSam − vis| > delta` → inconclusive; split votes across the decision
  boundary with disagreement `> 2σ` → inconclusive; else combined loss
  `L = 1 − mean(rSam, vis)` vs `3σ` decides fail/pass, with pixel-loss counts
  and bbox in the reason string.
- **Calibration guard exists** (`packages/core/src/calibration.ts`):
  `get/is/assertCalibrated`, `UncalibratedError` on nulls, and
  `calculateCalibrationFromRepetitions` (median per-clip stddev). This "refuse
  to guess" contract is your moat — do not bypass it (see §8).
- **Instrument B is deterministic and offline** (`instrument-b.ts`): Euclidean
  RGB tolerance matching + luminance NCC fallback. Zero API cost, fully
  reproducible.
- **Compiler is dual-provider and defensive** (`compile.ts`, `vlm-judge.ts`):
  Meta `/responses` vs Baseten `/chat/completions` shapes handled, fence-aware
  JSON extraction with brace fallback, kebab-case ID enrichment, Zod
  validation, keyed errors, cached-replay paths for offline demos.
- **Caching is demo-safe**: SAM/VLM caches under `benchmark/responses/`,
  `benchmark-sam` seeded from `phase2-smoke`, `skipLiveCalls` throws on cache
  miss, and `packages/core/src/scripts/benchmark-smoke.ts` runs a $0 4-clip
  offline smoke asserting pass-on-clean / fail-on-occluded.
- **MCP auto-resolution is thoughtful** (`mcp-server/src/auto-resolver.ts`):
  t0/tk via ffmpeg/sidecars, cached SAM discovery, bbox chain
  caller → manifest clipId → SAM frame-0 mask tight box. `spectra_verify` needs
  only a target label.
- **Workbench bundles real evidence** (`workbench/src/scripts/bundle-workbench-data.ts`):
  45 clips copied to public assets, SAM JSON decoded to SVG frames, S1/S2/S3
  pass1/pass2 + patch bundled, asserted by `data-bundle.test.ts` (45 clips,
  ≥21 with 8 SVG masks, 3 fail→pass scenarios).
- **Clip discipline holds**: manifest + generator + sampled SAM responses are
  all 8 frames @ 4 FPS @ 1280x720. Only the legacy spike-1 fixture predates the
  cap — quarantine it (see §8).

## 4. Is it a proper product? (honest scorecard)

| Dimension | State | Evidence |
|---|---|---|
| Installable / runnable | Yes | CLI + MCP + `pnpm start` workbench |
| Input contract | Yes | Zod invariants doc with voice provenance |
| Measurement core | Yes, with caveats | Dual-instrument referee + calibration guard |
| Reproducibility | Mostly | Caches + offline smoke; full-matrix scope overstated |
| Calibration rigor | Weak | 1 clip × 6 frames vs documented ≥10 clips × 5 reps |
| Claim hygiene | Failing now | 45-clip / citation / tool-count mismatches (fixable) |
| Live-cost safety | Failing by default | Full benchmark defaults to live APIs |

Read: ship-shape for Indie Solo judging after the §7 P0 fixes; not shippable as
a commercial metrology product without a real calibration campaign.

## 5. Track fit — why Indie Solo + extras is the right bet

- **Indie Dev / Solo:** one developer, real pain you personally hit with agents,
  full-stack build (models + math + CLI + MCP + UI + benchmark), open source,
  honest limitations section. Solo judges reward scope × polish × honesty. You
  have all three once claims are fixed.
- **Best Use of Meta AI:** SAM 3.1 video + Spark 1.3 + Voice Transcribe in one
  closed loop, plus parser and MCP surfaces. Few teams will touch 4+ Meta
  surfaces with a real benchmark behind them.
- **Best Dev Tool / Agent Infra:** MCP server + CLI + `check` across a manifest
  is immediately usable by other hackers' agents. Position as "the missing
  `assert` for agent-built UI."
- **Open Source / Technical Achievement:** dual-instrument math, inconclusive
  contract, reproducible 45-clip corpus, TruffleHog + offline CI. Keep the
  "we refuse to guess" story front and center.

Pick ONE primary (Indie Solo) and name the bonus tracks explicitly in your
submission copy so judges route you correctly.

## 6. New flow — the winning demo flow (3 acts, 3 minutes)

Do NOT lead with architecture. Lead with the catch, then the fix, then the
proof. Rehearse to 3:00 sharp with a 60-second interactive tail.

**Act 1 — The Catch (0:00–1:00).** Workbench Arena, scenario S3.
Show the checkout button with the bottom 10% clipped. Show DOM crosshair at
center saying "clickable" and raw VLM saying "fully visible" — both false
passes. Then reveal the Spectra verdict: REJECTED with `rSam`, `visRatio`,
agreement delta vs limit, loss vs 3σ threshold, and the pixel-loss count.
One sentence: "Two industry-standard checks just lied to you. Mine measured."

**Act 2 — The Fix (1:00–2:00).** Voice or one click.
Either speak ("when the cart drawer opens, checkout must never be covered") and
show the compiled invariant, or hit closed-loop replay. Show the CSS patch
(`bottom`, `z-index`), the re-render, and Pass #2 VERIFIED at 0.00% loss.
One sentence: "It didn't just complain — it fixed it and proved the fix."

**Act 3 — The Proof (2:00–3:00).** Benchmark Explorer + Dropzone.
Flash the corrected scope line first ("21 canonical v1 clips, 18 occluded,
4 evaluators" — see §7), then the table: DOM 94.4% false-pass, Spark 1.3
61.1%, Open 44.4%, Spectra 0.0%, MAE 1.11% (values as stored in
`benchmark/results/referee_benchmark_report.json`, generated 2026-10-27 — do
not present as a fresh live run unless you re-run it). End by dropping a
judge-picked sample clip into Live Dropzone and verifying in front of them.

**Interactive tail (3:00–4:00, if offered):** let the judge pick any of the 4
sample clips or speak their own invariant. Offline cache makes this instant and
free. Never type an API key on screen.

## 7. What's missing to be winnable (P0 → P2)

**P0 — fix before ANY judge sees it (half a day):**

1. **Scope line.** `README.md:78` says "4 evaluators across 45 clips" but the
   report says `totalEvaluated: 21` per evaluator and the runner's full-45 loop
   is Instrument-B + DOM only. Rewrite to: "4 evaluators across 21 canonical
   v1 clips (18 occluded); Instrument B + DOM additionally swept across all
   45." Same fix in `packages/workbench/design.md:57` ("zero false passes
   across all 45" → "0/18 occluded v1 clips").
2. **Bogus citation.** `design.md:64` cites `run-2026-10-26-45clips-10reps`,
   which matches nothing; real citation is run `resp_6ae03ef…` on
   `canvas_000_v1`. Replace with the real run ID or delete the line. A fake
   run ID reads as fabrication and can disqualify you under your own Rule 1.
3. **MCP tool count.** README says 3 tools; `mcp-server/src/index.ts` exposes
   4 (`spectra_verify`, `spectra_check`, `spectra_compile_invariant`,
   `spectra_closed_loop`). List all 4.
4. **Test-count badge.** README claims "94 tests passing" / "CI Passing (94
   tests)". Either run `pnpm -r test` now and lock the real count, or soften to
   "CI passing" until you have. Never badge a number you haven't just observed.
5. **Live-by-default benchmark.** `run-full-benchmark.ts` omits
   `skipLiveCalls`, so the judged command can burn credits / hang on venue
   wifi. Default to `skipLiveCalls: true` with an explicit `--live` flag for
   the full run, and document the approval per Rule 6.
6. **Demo-must-run checklist.** Fresh-clone test on a second machine: `pnpm
   install`, `pnpm -r build`, `pnpm start`, open `:4173`, run offline smoke,
   verify one cached clip, run one closed-loop scenario. Record a 90-second
   backup video of the same flow in case venue network dies.

**P1 — same day if possible:**

7. **Calibration note.** Shipped `calibration.json` (`σ=0.0045`, `δ=0.041`,
   `sample_count=6`) disagrees with `calibration.ts` (`δ = 2σ`, implying
   0.009) and with `calculateCalibration` (which counts clips, not frames).
   Add a short `packages/core/CALIBRATION_NOTE.md`: σ is relative stddev over
   6 clean frames of one clip; δ is 2× max empirical cross-instrument residual
   (0.0205) across 4 smoke runs — a deliberate conservative choice, distinct
   from the `2σ` helper's convention. Rename or comment the helper so the next
   reader isn't confused. Do NOT silently change values without a Rule 3
   measurement citation.
8. **Rule 5 artifact.** Create `docs/MODEL_VERIFICATION.md`: for each of
   `sam-3.1`, `muse-spark-1.3`, `muse-voice-transcribe-1.0`, paste the doc URL
   + a redacted `GET /v1/models` excerpt + date verified. One page kills the
   "did you even check the model IDs?" question.
9. **Threshold routing.** `benchmark-runner.ts:448` hardcodes `0.0135` and
   `:601–603` use `?? 0.0045/0.041` fallbacks, bypassing `assertCalibrated`.
   Route through `getCalibration()` + `assertCalibrated()` so the benchmark
   cannot emit verdicts/MAE while uncalibrated. This turns a Rule 2 violation
   into a strength story ("even our benchmark refuses to guess").
10. **Spike-1 fallback.** `recompute-static-calibration.ts:15` falls back to
    the pre-cap 320x176/250-frame fixture when the smoke fixture is missing.
    Replace fallback with a loud error telling the operator which fixture to
    restore. Silent non-comparable sigma is worse than a crash.

**P2 — only if time remains:**

11. Pin-test for `@meta-sam/parser` wire grammar (fixture in, same raster/SVG
    out) so a dep bump can't silently move your masks.
12. Cost/latency strip in the workbench: per-verify ms + cached-vs-live badge,
    so judges see the 8-frame economy.
13. One-page `JUDGING.md`: what to click, what to say, where the numbers live.

## 8. Where we break things (risk register — read before demo)

1. **Calibration contradiction (highest).** File says δ=0.041 (2× max
   residual); code contract says δ=2σ (=0.009). A judge who opens two files
   finds it in 30 seconds. Mitigation: §7 item 7 note + consistent comments.
2. **Scope overclaim (highest).** 45-clip / 4-evaluator phrasing vs 21-clip
   evaluated basis, plus README:78 vs :82 self-contradiction. Mitigation: §7
   items 1–2. Never let the deck claim more than the report's
   `totalEvaluated`.
3. **Fabrication-adjacent citation.** `design.md` run ID that exists nowhere.
   Mitigation: replace with `resp_6ae03ef78bd3db0853c642af` + date, or delete.
4. **Rule 2 bypasses.** Hardcoded threshold + `??` fallbacks in the benchmark
   path. Mitigation: §7 item 9.
5. **Rule 6 exposure.** Default full benchmark hits live Meta/Baseten APIs.
   Venue wifi + credit limits = hung demo. Mitigation: offline default (§7
   item 5), cache-first everything, pre-bundle workbench data, rehearse with
   wifi OFF.
6. **External parser drift.** `@meta-sam/parser@0.1.0` is locked but its wire
   grammar has no pin test. Mitigation: don't upgrade during the hackathon;
   P2 pin-test if time.
7. **Stale spike-1 fixture.** 320x176 / 250-frame response predates the 8-frame
   cap and is still a silent fallback. Mitigation: §7 item 10; never point
   judges at it.
8. **Tool-count / test-count nits.** 3-vs-4 MCP tools, unverified "94 tests."
   Small, but judges use nits as honesty proxies. Mitigation: §7 items 3–4.
9. **Live-voice fragility.** Mic permissions, noise, accents, transcription
   latency. Mitigation: rehearse the typed-transcript path equally well; the
   "verified replay" button is your safety net, not a cheat — label it as such.

## 9. How to showcase for the WIN (Indie Solo + bonus tracks)

**Positioning (say this verbatim at least once):**
"I'm a solo dev. Agents kept telling me UIs were done when they weren't, so I
built the referee I wished existed — on Meta's own stack — and benchmarked it
honestly, including the parts where it refuses to guess."

**Booth / judging checklist:**

- [ ] Laptop on charger, workbench pre-built, `:4173` open, caches warm.
- [ ] Wifi-OFF rehearsal done; backup video on desktop + phone.
- [ ] One terminal tab ready: offline smoke. One ready: single cached verify.
- [ ] No secrets on screen; `.env.example` only; keys in env, never in slides.
- [ ] Printed/digital QR codes: repo, workbench, report JSON, invariants sample.
- [ ] 60-second judge quickstart card matching README §"60-Second Quickstart".

**Submission copy skeleton (paste into the portal):**

- One-liner: "Spectra is the visual referee for AI agents: it optically
  verifies claimed-done UI with SAM 3.1 + pixel matching, rejects occlusions
  with pixel counts, auto-patches, and re-verifies."
- Meta surfaces used: SAM 3.1, `@meta-sam/parser`, Muse Voice Transcribe 1.0,
  Muse Spark 1.3, Muse Spark Open 1026 (Baseten), MCP server for Muse Code.
- Honest numbers + scope: "On 21 canonical v1 clips (18 occluded), 4
  evaluators: DOM 94.4% false-pass, Spark 1.3 61.1%, Open 44.4%, Spectra 0.0%;
  MAE 1.11%. Full 45-clip sweep for Instrument B + DOM. Report: <path>."
- Solo + open source + reproducible + refuses-to-guess. Link the calibration
  note and model-verification docs once written.

**What wins Indie Solo specifically:** scope completed alone, craft (UI +
  CLI + MCP + docs all work), honesty (limitations section, inconclusive
  contract, real citations), and a memorable live moment (the 10% catch +
  instant patch). You have all four levers — don't trade honesty for a bigger
  number. A judge who trusts you champions you in deliberation.

## 10. 48-hour solo execution plan

- **Hour 0–2:** P0 items 1–4 (scope, citation, tools, test count). Commit.
- **Hour 2–4:** P0 items 5–6 (offline default, fresh-clone test, backup video).
- **Hour 4–8:** P1 items 7–10 (calibration note, model verification,
  threshold routing, spike fallback). Commit per Rule 3 format where relevant.
- **Hour 8–10:** Rehearse Act 1–3 three times, once with wifi off, once with a
  friend as judge. Fix whatever felt slow.
- **Remaining:** P2 only if P0+P1 are green. Otherwise rest your voice and
  re-check the booth list. Sleep beats a 13th feature.

## 11. Rules guardrails (non-negotiable, from AGENTS.md)

- **Rule 1:** never present a number you haven't observed in a file or run.
  Report says 21 evaluated → you say 21 evaluated. Generated-at timestamps are
  part of the claim.
- **Rule 2:** σ/δ come from measurements only. The benchmark must refuse to
  emit verdicts when uncalibrated — after §7 item 9, demo that refusal once;
  judges love it.
- **Rule 3:** any calibration change cites run ID + method + log path in the
  commit message.
- **Rule 4:** keep the spike/fallback structure; gate the stale fixture, don't
  "simplify" the spikes away.
- **Rule 5:** verify all three model IDs against docs + `GET /v1/models`
  before claiming them; keep the artifact.
- **Rule 6:** no live Meta calls in tests/CI/iteration without explicit
  approval; all clips stay exactly 8f @ 4 FPS @ 1280x720.

## 12. What remains unverified (say so if asked)

- `@meta-sam/parser` wire-grammar stability across SAM versions (no pin test).
- Whether a full 45-clip 4-evaluator run is affordable/cached before judging.
- Whether live SAM/voice/Spark calls survive venue network + credits
  (hence: offline-first demo).
- The "94 tests" count and any number not quoted above from an inspected file.
- Anything requiring a fresh run: I report stored file contents
  (`calibration.json`, `referee_benchmark_report.json`, sampled SAM responses),
  not new measurements.

---

*Win condition restated: a solo dev who measured honestly, built on Meta's
stack end to end, and can catch a 10% occlusion live while competitors
false-pass. Fix the P0s, rehearse the 3 acts, demo offline-first, and let the
referee — including its refusals — be the star.*
