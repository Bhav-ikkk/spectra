# Calibrating the Noise Floor

## What is sigma_noise?

`sigma_noise` is the standard deviation of measurement noise observed across
repeated evaluations of the same clip under identical conditions. It quantifies
how much random variation exists in the measurement pipeline itself.

## What is delta?

`delta` is the disagreement threshold: the minimum difference between two
measurements that is considered meaningful (not noise).

## Computation Procedure

1. **Run Spike 1 measurements** on at least 10 clips, 5 repetitions each:

   ```bash
   pnpm --filter @spectra/sam-client spike1 --clips 10 --reps 5
   ```

2. **Compute per-clip standard deviation** of the primary score metric:

   - For each clip, take the 5 repeated measurements
   - Compute the standard deviation of those 5 values

3. **Compute sigma_noise:**

   ```
   sigma_noise = median(per-clip standard deviations)
   ```

   Using median (not mean) to be robust against outlier clips.

4. **Compute delta:**
   ```
   delta = 2 × sigma_noise
   ```
   Differences below delta are considered noise and do not trigger verdicts.

## Cardinal Rule

**These values are measured from Spike 1 data, never hand-tuned.**

An agent must NEVER:

- Hardcode sigma_noise or delta to a "reasonable-looking" value
- Adjust these values based on intuition or to make tests pass
- Set them without running actual measurements

If Spike 1 hasn't run yet:

- `sigma_noise = null`
- `delta = null`
- Any measurement code must **refuse to emit verdicts** until calibration is complete

## Where the Values Live

File: `packages/core/src/calibration.json`

```json
{
  "sigma_noise": null,
  "delta": null,
  "measured_from": null,
  "measured_at": null,
  "clip_count": null,
  "reps_per_clip": null
}
```

This file is updated **only** by the calibration script, with a commit message
that cites the measurement run (per AGENTS.md Rule 3).

## Updating Calibration

```bash
# Re-run calibration from fresh measurements
pnpm --filter @spectra/core calibrate \
  --responses benchmark/responses/spike-1/ \
  --output packages/core/src/calibration.json

# Commit with citation
git add packages/core/src/calibration.json
git commit -m "chore(calibration): update sigma_noise to <value>

Measured from run <timestamp> (<N> clips × <M> reps)
Median per-clip stddev: <value>
Full log: benchmark/responses/spike-1/<run-dir>"
```
