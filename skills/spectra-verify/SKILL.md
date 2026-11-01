---
name: spectra-verify
description: Visual verification skill for AI coding agents using the Spectra MCP server
---

# Spectra Visual Verification Skill

Use the Spectra MCP server to verify that UI elements are fully visible and unoccluded after code modifications.

## When to Use

- After modifying CSS layouts, z-index stacking, fixed headers, or drawer/modal components.
- Before marking an agentic UI task as "done" — replace naive DOM center hit-testing with sub-pixel optical verification.
- To execute autonomous closed-loop UI repair loops (Reject -> Synthesize Patch -> Re-Verify).

## Quick Verification (Zero-BBox Mode)

Call `spectra_verify` with only `videoPath` and `targetLabel` — SAM 3.1 Frame-0 auto-detects target bounding boxes without requiring manual coordinates:

```json
{
  "method": "tools/call",
  "params": {
    "name": "spectra_verify",
    "arguments": {
      "videoPath": "benchmark/clips/dom_catch_010_v1.mp4",
      "targetLabel": "Complete Checkout"
    }
  }
}
```

## Batch Check Against Invariants

```json
{
  "method": "tools/call",
  "params": {
    "name": "spectra_check",
    "arguments": {
      "invariantsPath": ".spectra/invariants.json",
      "manifestPath": "benchmark/manifest.json"
    }
  }
}
```

## Closed-Loop Referee & Repair

```json
{
  "method": "tools/call",
  "params": {
    "name": "spectra_closed_loop",
    "arguments": {
      "scenario": "all"
    }
  }
}
```

## Verdict Contract

- `pass`: Target element is fully retained (loss $\le 1.35\%$ noise floor).
- `fail`: Occlusion detected (loss $> 3\sigma = 1.35\%$, instruments agree within $\delta = 4.10\%$).
- `inconclusive`: Instruments disagree beyond $\delta$ or target not detected in viewport — referee strictly refuses to guess.

