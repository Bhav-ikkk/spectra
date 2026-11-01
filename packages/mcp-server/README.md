# @spectra/mcp-server — Model Context Protocol Server

> Dual-instrument visual referee for AI coding agents via stdio JSON-RPC 2.0.

Spectra MCP Server enables AI coding agents (Muse Code, Claude Code, Cursor, Devin) to visually verify UI changes and catch subtle occlusions using Meta SAM 3.1 and deterministic pixel template matching.

---

## 1-Command Zero-Config Setup

### Muse Code / Claude Code (stdio)
Add to your project's `.mcp.json` (auto-detected when opening this workspace):

```json
{
  "mcpServers": {
    "spectra": {
      "command": "node",
      "args": ["packages/mcp-server/dist/index.js"],
      "env": {
        "SPECTRA_OFFLINE_DEFAULT": "true"
      }
    }
  }
}
```

Or register globally via Claude CLI:
```bash
claude mcp add spectra -- node /absolute/path/to/packages/mcp-server/dist/index.js
```

### Cursor IDE
Add to `.cursor/mcp.json`:
```json
{
  "mcpServers": {
    "spectra": {
      "command": "node",
      "args": ["packages/mcp-server/dist/index.js"],
      "env": {
        "SPECTRA_OFFLINE_DEFAULT": "true"
      }
    }
  }
}
```

---

## Exposed Bounded Tools (4)

| Tool | Purpose | Key Arguments | Auto-Resolution |
|---|---|---|---|
| `spectra_verify` | Optical verification on video or frame pair | `targetLabel` + `videoPath` (or `t0FramePath` + `tkFramePath`) | Zero-BBox auto-detection from SAM Frame 0 |
| `spectra_check` | Batch check against visual invariant suite | `invariantsPath`, `manifestPath`, `cachedSamDir` | Verifies full clip manifest |
| `spectra_compile_invariant` | Natural language / audio into `.spectra/invariants.json` | `outputPath`, `transcriptText` or `audioPath` | Invariant compiler |
| `spectra_closed_loop` | Autonomous 4-phase Reject -> Patch -> Re-Verify loop | `scenario` (`s1`, `s2`, `s3`, `all`) | S1 (Canvas), S2 (Mobile), S3 (Catch) |

---

## API Key & Economy Tiers ($0.00 Replay)

| Mode | API Keys Needed | Cost | Latency |
|---|---|---|---|
| **Cached Mode (Default)** | **None ($0.00)** | **$0.00** | **~480ms** |
| **Live Uncached SAM 3.1** | `META_API_KEY` | Per-token | ~4.5s |
| **Live Baseten VLM** | `BASETEN_API_KEY` | Per-token | ~5.7s |

All 45 benchmark clips and S1–S3 closed-loop demos replay with **zero API spend ($0.00)**.

