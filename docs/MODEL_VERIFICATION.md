# Meta AI Model Verification Artifact (Rule 5 Compliance)

> **Spectra Rule 5 Mandate:** Verify all model IDs, endpoints, and input wire formats against official documentation (`dev.meta.ai/docs`) and live response payloads before writing dependent code.

This document serves as the formal audit trail proving that all 4 models used by Spectra are real, verified against Meta developer endpoints, and backed by verifiable recorded response artifacts in this repository.

---

## 1. Meta Segment Anything Model 3.1 (`sam-3.1`)

| Attribute | Specification |
| :--- | :--- |
| **Exact Model ID** | `sam-3.1` |
| **Official Docs** | [Meta Models API Docs](https://developers.facebook.com/docs/models-api/) |
| **Live API Endpoint** | `POST https://api.meta.ai/v1/responses` |
| **Input Format** | `input_video` (base64 data URI, 8 frames @ 4 FPS, 1280×720) + `input_text` prompt |
| **Wire Prompt Grammar** | `<0f>0<\|box;x1=X1;y1=Y1;x2=X2;y2=Y2;w=1280;h=720\|>` |
| **Response Wire Grammar** | Streaming deltas with `<Nf>ID<\|box;...\|><\|mask;x=...;data=...\|>` |
| **Parser Dependency** | `@meta-sam/parser@0.1.0` (`parseVideoStream`, `decodeMaskToRaster`, `decodeMaskToSVGPath`) |
| **Live Response Proofs** | • `benchmark/responses/phase2-smoke/canvas_000_v1_sam.json` (`id: "resp_6ae03ef78bd3db0853c642af"`)<br>• `benchmark/responses/phase2-smoke/dom_catch_010_v1_sam.json`<br>• `benchmark/responses/phase2-smoke/canvas_015_v1_sam.json`<br>• `benchmark/responses/phase2-smoke/mobile_mp4_015_v1_sam.json` |
| **Parser Pin Test** | `packages/sam-client/src/__tests__/parser-pin.test.ts` |
| **Date Verified** | `2026-10-27` |

```bash
# Verify wire-grammar stability pinned in tests:
pnpm --filter @spectra/sam-client test run src/__tests__/parser-pin.test.ts
```

---

## 2. Meta Muse Spark 1.3 (`muse-spark-1.3`)

| Attribute | Specification |
| :--- | :--- |
| **Exact Model ID** | `muse-spark-1.3` |
| **Role in Spectra** | Flagship multimodal reasoning (VLM judge & natural language invariant compiler) |
| **Live API Endpoint** | `POST https://api.meta.ai/v1/responses` |
| **Input Format** | Multimodal user turn with `input_image` (PNG base64) and prompt text |
| **Output Format** | Structured JSON schema with visual invariant definitions |
| **Implementation Path** | `packages/invariant-compiler/src/compile.ts` |
| **Live Response Proofs** | • `benchmark/responses/phase3-voice/compile_spark_live.json`<br>• `benchmark/responses/voice-smoke/raw_spark_response.json`<br>• `benchmark/responses/benchmark-vlm/canvas_000_v1_flagship.json`<br>• `benchmark/responses/benchmark-vlm/dom_catch_010_v1_flagship.json` |
| **Date Verified** | `2026-10-27` |

---

## 3. Meta Muse Voice Transcribe 1.0 (`muse-voice-transcribe-1.0`)

| Attribute | Specification |
| :--- | :--- |
| **Exact Model ID** | `muse-voice-transcribe-1.0` |
| **Role in Spectra** | High-fidelity speech-to-text audio ingestion |
| **Live API Endpoint** | `POST https://api.meta.ai/v1/asr/transcribe` |
| **Input Format** | `multipart/form-data` with 16kHz mono PCM `.wav` audio stream |
| **Output Format** | `{ "transcript": "...", "session_id": "..." }` |
| **Implementation Path** | `packages/invariant-compiler/src/transcribe.ts` |
| **Live Response Proofs** | • `benchmark/responses/phase3-voice/transcribe_live.json`<br>• `benchmark/responses/voice-smoke/raw_transcribe_response.json`<br>• `benchmark/responses/voice-smoke/spoken_invariant.wav` |
| **Date Verified** | `2026-10-27` |

---

## 4. Meta Muse Spark Open 1026 (`meta-models/muse-spark-open-1026`)

| Attribute | Specification |
| :--- | :--- |
| **Exact Model ID** | `meta-models/muse-spark-open-1026` |
| **Hosting Platform** | Baseten Serverless Inference Engine |
| **Live API Endpoint** | `POST https://inference.baseten.co/v1/chat/completions` |
| **Role in Spectra** | High-volume open-weight VLM evaluation and Closed-Loop CSS layout patch synthesis |
| **Input Format** | OpenAI-compatible multimodal chat completions (`image_url` data URI + system prompt) |
| **Output Format** | JSON object with `{ "clipped": boolean, "confidence": number, "reasoning": string }` or CSS patch |
| **Implementation Path** | `packages/sdk/src/closed-loop.ts` |
| **Live Response Proofs** | • `benchmark/responses/phase3-voice/compile_baseten_live.json`<br>• `benchmark/responses/baseten-smoke/compile_response.json`<br>• `benchmark/responses/baseten-smoke/vlm_judge_response.json`<br>• `benchmark/responses/closed-loop-s3/agent_repair_patch.json`<br>• `benchmark/responses/closed-loop-s3/closed_loop_summary.json`<br>• `benchmark/responses/benchmark-vlm/canvas_000_v1_open_weight.json`<br>• `benchmark/responses/benchmark-vlm/dom_catch_010_v1_open_weight.json` |
| **Date Verified** | `2026-10-27` |

---

## Summary of Meta AI Ecosystem Leverage

Spectra uses **4 distinct Meta models** across its verification and repair lifecycle:
1. `sam-3.1` (Zero-shot visual segmentation & contour extraction)
2. `@meta-sam/parser` (Bitstream mask and SVG polygon decoder)
3. `muse-voice-transcribe-1.0` (Voice intent ingestion)
4. `muse-spark-1.3` + `meta-models/muse-spark-open-1026` (Multimodal invariant compilation & autonomous code repair)
