# Spectra Benchmark Generator

Isolated Python tool for generating synthetic benchmark clips.

## Setup

```bash
cd tools/benchmark-gen
python -m venv .venv

# Windows
.venv\Scripts\activate

# Unix
source .venv/bin/activate

pip install -r requirements.txt
```

## Usage

```bash
python generate.py --output ../../benchmark/clips/ --manifest ../../benchmark/manifest.json
```

## Output

- 45 clips: 15 scenarios × 3 variants (clean, edge-case, adversarial)
- `manifest.json`: Metadata for each clip, validated against the Zod schema in `@spectra/core`

## Communication Contract

This tool communicates with the TypeScript monorepo **only** via the committed
`manifest.json` file. Never import Python objects into TS or vice versa.
