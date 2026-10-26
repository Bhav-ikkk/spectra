# Running the Benchmark

## Overview

Spectra's benchmark consists of 45 synthetic clips: 15 scenarios × 3 variants
(clean, edge-case, adversarial). Each clip is evaluated by four instruments.

## Regenerating Clips

```bash
cd tools/benchmark-gen

# Create/activate Python venv (Windows)
python -m venv .venv
.venv\Scripts\activate

# Create/activate Python venv (Unix)
python -m venv .venv
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Generate all 45 clips + manifest
python generate.py \
  --output ../../benchmark/clips/ \
  --manifest ../../benchmark/manifest.json
```

## Manifest Schema

The manifest schema lives at `tools/benchmark-gen/manifest-schema.json`.

Each manifest entry contains:

- `clipId`: Unique identifier for the clip
- `scenario`: Name of the test scenario
- `variant`: One of `clean`, `edge-case`, `adversarial`
- `expectedVerdicts`: Expected pass/fail/inconclusive for each evaluator
- `sourceParams`: Parameters used to generate the clip

The manifest is validated against the Zod schema in `packages/core/src/schemas/manifest.ts`.

## Running All Four Evaluators

### 1. SAM Decode Evaluator

Uses `@spectra/sam-client` to decode the agent's code output through SAM 3.1.
Checks whether the tokenized output matches expected structure.

```bash
pnpm --filter @spectra/cli spectra verify --evaluator sam-decode --clips benchmark/clips/
```

### 2. VLM Blind-Spot Evaluator

Sends clips to muse-spark-1.3 for visual evaluation. Checks whether the VLM
identifies the same issues as the SAM decoder.

```bash
pnpm --filter @spectra/cli spectra verify --evaluator vlm-blind-spot --clips benchmark/clips/
```

### 3. Noise-Floor Evaluator

Computes sigma_noise from repeated measurements. Reports whether individual
measurements are within the calibrated noise floor.

```bash
pnpm --filter @spectra/cli spectra verify --evaluator noise-floor --clips benchmark/clips/
```

### 4. Invariant Violation Evaluator

Checks each clip against the invariants defined in `.spectra/invariants.json`.

```bash
pnpm --filter @spectra/cli spectra verify --evaluator invariant --clips benchmark/clips/
```

## Full Benchmark Run

```bash
# Run all evaluators on all clips, output raw responses
pnpm benchmark:full
```

This writes raw API responses to `benchmark/responses/<run-timestamp>/`.

## Smoke Test (Day-1 Skeleton)

```bash
pnpm benchmark:smoke
```

On the Day-1 skeleton this only validates Zod manifest/verdict schemas in
`packages/core` and exits 0. In Phase 2 it becomes a real 3-clip smoke test.
