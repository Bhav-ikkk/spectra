# Spectra V3.0 — Security Analysis

- **Date:** 2026-10-30
- **Source:** Security angle of the deep codebase review for the Meta AI hackathon
  (review session `01a18bee`, security worker `3ae77dd4`).
- **Scope:** Code only. Render platform auth/WAF/rate-limit settings are not
  visible in the repo and were not assessed.
- **Verification status:** Findings 1–3 (RCE), 7 (static-route traversal), and
  the `.env` gitignore pass were spot-verified against the current tree this
  session. All other items are transcribed as recorded by the review worker
  from inspected source bodies; line numbers refer to the tree as reviewed.
- **Remediation (2026-10-31):** All 20 findings fixed in the working tree —
  each item below carries its fix status. Verified with `tsc --noEmit`
  (7 packages), `eslint` (6 touched packages), and `vitest run`
  (145 tests passing, including 3 new regression tests); CLI build and the
  $0 benchmark smoke also pass. No commits or pushes made.

## Critical — remote code execution / unauthenticated access

### 1. Shell-injection RCE in `extractVideoFrames` (ffmpeg path)

- **File:** `packages/workbench/src/server/api-middleware.ts:96`
- User-controlled `videoPath` is interpolated into an `execSync` shell string.
  A quote-breakout in the path yields RCE.
- **Fix:** use `execFileSync('ffmpeg', args[])` with no shell.
- **Status:** Fixed — both ffmpeg calls now use `execFileSync('ffmpeg', [...])`
  with no shell.

### 2. Shell-injection RCE in `extractVideoFrames` (python fallback path)

- **File:** `packages/workbench/src/server/api-middleware.ts:146`
- `pyExe`, `videoPath`, and output paths are interpolated into an
  `execSync` `python -c` shell string → RCE.
- **Fix:** use `execFileSync` with an argv array and an allowlisted python path.
- **Status:** Fixed — now `execFileSync(pyExe, ['-c', script, ...])`. The
  interpreter still resolves from the fixed venv/`python` candidate list
  (PATH-resolved names only); no caller input reaches a command line.

### 3. Shell-injection RCE in `verifyClip`

- **File:** `packages/sdk/src/client.ts:164`
- `resolvedVideoPath` is interpolated into an `execSync` ffmpeg template,
  reachable from MCP/CLI/SDK callers → RCE.
- **Fix:** use `execFileSync` argv form (see the safe use in
  `packages/mcp-server/src/auto-resolver.ts:232`).
- **Status:** Fixed — both ffmpeg calls in `verifyClip` use the `execFileSync`
  argv form. No `execSync(` remains in `packages/`.

### 4. Public, unauthenticated API surface

- **Files:** `packages/workbench/src/server/prod-server.ts:17`,
  `render.yaml:14`, `packages/workbench/src/server/api-middleware.ts:809`
- Server listens on `HOST 0.0.0.0` as a public Render service with zero auth
  on `/api/*` → unauthenticated RCE/file-write via findings 1–6.
- **Fix:** require bearer-token auth on `/api/*`.
- **Status:** Fixed — `spectraApiMiddleware` requires
  `Authorization: Bearer <SPECTRA_API_TOKEN>` on all `/api/*` routes whenever
  the token env var is set (timing-safe compare); unset means local/dev mode.
  The token is documented in `.env.example` and added to `render.yaml`
  (`sync: false`). Note: the workbench UI sends no credentials, so a deployment
  with the token set needs an auth-aware front end or proxy for browser use.

## High — arbitrary file write / read

### 5. Arbitrary file overwrite in `handleCompileVoice`

- **File:** `packages/workbench/src/server/api-middleware.ts:658`
- `outPath` is mkdir'd and written anywhere (absolute or repo-relative).
- **Fix:** constrain writes to a `.spectra/` allowlist plus `basename`.
- **Status:** Fixed — `outPath` is reduced to a `.json` basename inside
  `<repoRoot>/.spectra` with a containment check. The workbench UI sends
  `.spectra/invariants.json`, which resolves to the same file as before.

### 6. Local-file-read oracle in `handleVerifyLive`

- **File:** `packages/workbench/src/server/api-middleware.ts:269`
- Absolute `videoPath`/`t0`/`tk` are accepted, read, and returned base64-encoded.
- **Fix:** reject absolute paths; confine to tmpdir plus `benchmark/clips`.
- **Status:** Fixed — `videoPath`/`t0`/`tk` go through
  `resolveConfinedClientPath`, confined to the upload tmpdir and `benchmark/`;
  outside paths get a 400.

### 7. Arbitrary-file read via `cachedSamResponsePath`

- **File:** `packages/workbench/src/server/api-middleware.ts:331`
- Absolute path is read and `JSON.parse`d → arbitrary-file read / error oracle.
- **Fix:** same allowlist confinement as finding 6.
- **Status:** Fixed — confined to the upload tmpdir and `benchmark/` via the
  same helper.

### 8. Static-route path traversal serves secrets

- **File:** `packages/workbench/src/server/prod-server.ts:91`
- `path.join(distDir, decodedURL)` with no containment check, so
  `GET /../../.env` can serve secrets.
- **Fix:** resolve the candidate and enforce `startsWith(distDir|publicDir)`.
- **Status:** Fixed — both static candidates are verified with `isPathWithin`
  before serving; malformed URIs now get a 400 instead of throwing.

## Medium — injection / disclosure / abuse

### 9. Prompt injection in invariant compiler

- **File:** `packages/invariant-compiler/src/compile.ts:126`
- User transcript is concatenated into `userPrompt` (sent at L148/L181) and can
  override schema rules.
- **Fix:** delimit untrusted input and reiterate output-only-JSON rules.
- **Status:** Fixed — the transcript is wrapped in `<transcript>` delimiters
  marked as untrusted data-only, and the system rules restate JSON-only output.

### 10. Verdict-steering injection in VLM judge

- **File:** `packages/invariant-compiler/src/vlm-judge.ts:172`
- `targetLabel` is interpolated into the system prompt (L173/L180) and user
  prompt (L190).
- **Fix:** isolate the label in delimiters plus strict `JSON`/`clipped` parsing.
- **Status:** Fixed — the label is isolated in `<target>` delimiters in the
  system and user prompts, framed as a literal name; the `"target"` echo in the
  JSON example is retained (output schema). Existing judge parsing and its
  tests are untouched.

### 11. Path and upstream-error disclosure to clients

- **Files:** `packages/workbench/src/server/api-middleware.ts:388`,
  `packages/sdk/src/client.ts:186`
- Absolute server paths and upstream error text are echoed to the client.
- **Fix:** generic client messages with server-side-only logging.
- **Status:** Fixed — all workbench handlers report via `sendError`:
  `ClientError` messages pass through with their status; internal errors are
  logged server-side and return generic messages. SDK/MCP/CLI keep detailed
  local errors (local trust boundary, needed for CLI UX).

### 12. Copy-paste shell injection in CLI equivalent snippet

- **File:** `packages/workbench/src/server/api-middleware.ts:487`
- Raw `targetLabel` is embedded in `cliCommandEquivalent` inside double quotes.
- **Fix:** shell-quote/escape the label before interpolation.
- **Status:** Fixed — the label and the video path in `cliCommandEquivalent`
  go through POSIX `shellQuote`.

### 13. SVG attribute injection via SAM-derived mask path

- **Files:** `packages/workbench/src/components/LiveDropzoneView.tsx:370`,
  `OpticalViewport.tsx:311`
- SAM-derived string flows into an SVG path `d` attribute.
- **Fix:** allowlist path characters (`/^[MLHVZ0-9 .,+-]+$/i`).
- **Status:** Fixed — both components sanitize mask paths with the allowlist
  (all 258 bundled SVG paths verified to pass, so demo overlays are unchanged).

### 14. No rate limiting on expensive routes

- **File:** `packages/workbench/src/server/api-middleware.ts:809`
- No rate limiting on 50 MB verify/compile routes that trigger ffmpeg + LLM
  calls → cost/DoS abuse.
- **Fix:** per-IP token bucket plus smaller per-route caps.
- **Status:** Fixed — per-IP token bucket (60 req/min, 429 + `Retry-After`) in
  the middleware, plus per-route body caps: closed-loop 64 KB, compile-voice
  12 MB, save-invariant/explain-verdict 256 KB, verify-live 50 MB (unchanged).

### 15. Verdict manipulation via unvalidated `tolerance`

- **Files:** `packages/mcp-server/src/index.ts:215`,
  `packages/core/src/instrument-b.ts:86`
- `tolerance` passes through unvalidated; `NaN`/negative forces
  `visRatio = 0` (FAIL).
- **Fix:** validate `tolerance` is finite and `>= 0`.
- **Status:** Fixed — `resolveVerifyInputs` (the MCP choke point) rejects
  non-number/non-finite/negative tolerance. Covered by
  `resolver-validation.test.ts`.

### 16. `parseBoundingBox` accepts `Infinity`, no upper bound

- **File:** `packages/cli/src/index.ts:29`
- `Number('Infinity')` passes the NaN/negative check; no upper bound →
  matcher throw / 500s.
- **Fix:** require `Number.isFinite` plus a sane max (e.g. `<= 100000`).
- **Status:** Fixed — requires finite, `>= 0`, `<= 100000`; the
  `Invalid bbox format` message is unchanged. Covered by the new CLI test.

### 17. Unvalidated caller bbox in `normalizeBBox`

- **Files:** `packages/workbench/src/server/api-middleware.ts:73`,
  `packages/mcp-server/src/auto-resolver.ts:46`
- No finite/non-negative validation → 500s via matcher throw.
- **Fix:** validate and return 400 on invalid input.
- **Status:** Fixed — both copies validate finite/non-negative inputs and throw
  (a 400 `ClientError` at the HTTP layer). MCP side covered by
  `resolver-validation.test.ts`.

## Low — robustness

### 18. Large-body memory DoS in `parseJsonBody`

- **File:** `packages/workbench/src/server/api-middleware.ts:21`
- The over-50 MB reject never destroys the stream, which keeps buffering.
- **Fix:** call `req.destroy()` and ignore further chunks after reject.
- **Status:** Fixed — oversize bodies reject, destroy the stream, and ignore
  further chunks. Covered by `api-security.test.ts`.

### 19. `/tmp` disk-fill via unlinked uploads

- **File:** `packages/workbench/src/server/api-middleware.ts:261`
- `videoBase64`/`audioBase64` files are written to `/tmp` and never unlinked.
- **Fix:** unlink temp files in `finally` and cap decoded bytes.
- **Status:** Fixed — base64-decoded uploads are capped at 40 MB, and every
  handler-created temp file (uploads, extracted frames, voice wav) is tracked
  and unlinked in `finally`. Caller-provided paths are never deleted.

### 20. Fragile `.env` key parsing

- **Files:** `packages/sdk/src/benchmark-runner.ts:42`,
  `packages/invariant-compiler/src/vlm-judge.ts:96`,
  `packages/sdk/src/closed-loop.ts:366`
- Unanchored key regex matches comments/substrings and keeps quotes →
  wrong key material.
- **Fix:** anchor `^KEY=` and trim quotes.
- **Status:** Fixed — all `.env` lookups are anchored (`^KEY=`, multiline) with
  surrounding-quote stripping. The same fix was applied to the three unlisted
  copies of the pattern in `run-baseten-smoke.ts`, `run-voice-smoke.ts`, and
  `run-ui-smoke-sam.ts`.

## Unresolved (not confirmed)

- `@meta-sam/parser` internals (`node_modules`) were not opened: mask w/h
  allocation DoS and box-parse robustness are unconfirmed.
- Render platform auth/WAF/rate-limit settings are not visible in the repo;
  this assessment covers code only.
- `dist/` bundle was absent, so no built-asset secret scan was performed;
  source shows no `VITE_*` key embedding.
- Scenario validation inside `runClosedLoopReferee` was not traced; MCP casts
  `args.scenario` unchecked at `packages/mcp-server/src/index.ts:332`.

## Passes (verified, all bodies opened)

- No SSRF sink reachable via HTTP: `baseUrl` params exist only in
  SDK/compile/vlm-judge caller options, never on `/api/*`.
- No `dangerouslySetInnerHTML` or `innerHTML` sinks; notes, transcript, and
  target label use React-escaped interpolation.
- No API keys in logs, errors, responses, or bundle (Bearer redaction only;
  `.env` gitignored per `.gitignore:5`).
- `videoFileName` is `basename`'d (`api-middleware.ts:264`).
- MCP ffmpeg path uses safe `execFileSync` (`auto-resolver.ts:232`).
- Repair prompts are static constants with no user interpolation
  (`closed-loop.ts:171`).
- Core matcher validates bbox finite + positive and clamps bounds
  (`instrument-b.ts:33-55`).
- `/api/status` exposes only key-presence booleans, not keys.

## Regression tests added

- `packages/cli/src/__tests__/cli.test.ts` — rejects `Infinity`/`NaN`/oversize
  bbox coordinates (finding 16).
- `packages/mcp-server/src/__tests__/resolver-validation.test.ts` — bbox and
  tolerance validation (findings 15, 17).
- `packages/workbench/src/server/__tests__/api-security.test.ts` — path
  confinement, `ClientError`, and oversize-body stream destroy
  (findings 6–8, 11, 18).
