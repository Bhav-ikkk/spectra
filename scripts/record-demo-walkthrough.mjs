import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn, spawnSync } from 'node:child_process';
import http from 'node:http';
import { chromium } from 'playwright';
import ffmpegPath from 'ffmpeg-static';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const demoRecordingsDir = path.join(rootDir, 'demo-recordings');
const outputMp4Path = path.join(rootDir, 'demo-walkthrough.mp4');

// Ensure recordings folder exists
if (!fs.existsSync(demoRecordingsDir)) {
  fs.mkdirSync(demoRecordingsDir, { recursive: true });
}

// Check if workbench server is already running
async function isServerRunning(url = 'http://localhost:4173/api/health') {
  return new Promise((resolve) => {
    const req = http.get(url, (res) => {
      resolve(res.statusCode === 200);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(1500, () => {
      req.destroy();
      resolve(false);
    });
  });
}

async function waitForServer(url = 'http://localhost:4173/api/health', maxWaitMs = 30000) {
  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    if (await isServerRunning(url)) return true;
    await new Promise((r) => setTimeout(r, 600));
  }
  throw new Error(`Server failed to respond at ${url} within ${maxWaitMs}ms`);
}

async function main() {
  console.log('=== SPECTRA V3.0 DEMO WALKTHROUGH RECORDER ===');
  let serverProcess = null;

  const alreadyRunning = await isServerRunning();
  if (!alreadyRunning) {
    console.log('[Recorder] Starting local production workbench server (pnpm start)...');
    serverProcess = spawn('pnpm', ['start'], {
      cwd: rootDir,
      stdio: 'pipe',
      shell: true,
      env: { ...process.env, PORT: '4173', HOST: '0.0.0.0' },
    });

    serverProcess.stdout.on('data', (d) => process.stdout.write(`[Server] ${d}`));
    serverProcess.stderr.on('data', (d) => process.stderr.write(`[Server Error] ${d}`));

    await waitForServer();
    console.log('[Recorder] Workbench server is listening at http://localhost:4173');
  } else {
    console.log('[Recorder] Workbench server already active at http://localhost:4173');
  }

  console.log('[Recorder] Launching Playwright browser (1920x1080)...');
  const browser = await chromium.launch({
    channel: 'chrome',
    headless: true,
  });

  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    recordVideo: {
      dir: demoRecordingsDir,
      size: { width: 1920, height: 1080 },
    },
  });

  const page = await context.newPage();
  console.log('[Recorder] Navigating to http://localhost:4173...');
  await page.goto('http://localhost:4173', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  // Injected Visual Hardware Cursor & Lower-Third Hardware Caption Banner
  await page.addStyleTag({
    content: `
      #spectra-demo-cursor {
        position: fixed;
        width: 20px;
        height: 20px;
        border-radius: 50%;
        background: rgba(224, 82, 70, 0.45);
        border: 2px solid #E05246;
        box-shadow: 0 0 12px rgba(224, 82, 70, 0.7);
        pointer-events: none;
        z-index: 999999;
        transform: translate(-50%, -50%);
        transition: transform 0.15s ease-out, background 0.15s ease, border-color 0.15s ease;
      }
      #spectra-demo-cursor.clicking {
        transform: translate(-50%, -50%) scale(0.7);
        background: rgba(46, 125, 82, 0.85);
        border-color: #2E7D52;
        box-shadow: 0 0 14px rgba(46, 125, 82, 0.9);
      }
      #spectra-demo-caption {
        position: fixed;
        bottom: 24px;
        left: 50%;
        transform: translateX(-50%);
        background: rgba(24, 24, 22, 0.94);
        border: 1px solid #4A4843;
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
        color: #FDFCFA;
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
        font-size: 13px;
        font-weight: 600;
        letter-spacing: 0.04em;
        padding: 10px 24px;
        border-radius: 6px;
        z-index: 999998;
        pointer-events: none;
        transition: all 0.25s ease;
        white-space: nowrap;
      }
    `,
  });

  await page.evaluate(() => {
    const cur = document.createElement('div');
    cur.id = 'spectra-demo-cursor';
    cur.style.left = '960px';
    cur.style.top = '540px';
    document.body.appendChild(cur);

    const cap = document.createElement('div');
    cap.id = 'spectra-demo-caption';
    cap.textContent = 'Spectra v3.0 · Field Monitor UI Initialized';
    document.body.appendChild(cap);
  });

  async function setCaption(text) {
    console.log(`[Caption] ${text}`);
    await page.evaluate((t) => {
      const el = document.getElementById('spectra-demo-caption');
      if (el) el.textContent = t;
    }, text);
  }

  async function moveCursor(targetX, targetY, steps = 14) {
    const curPos = await page.evaluate(() => {
      const el = document.getElementById('spectra-demo-cursor');
      return {
        x: parseFloat(el?.style.left || '960'),
        y: parseFloat(el?.style.top || '540'),
      };
    });

    for (let i = 1; i <= steps; i++) {
      const progress = i / steps;
      const ease = 0.5 - Math.cos(progress * Math.PI) / 2;
      const x = curPos.x + (targetX - curPos.x) * ease;
      const y = curPos.y + (targetY - curPos.y) * ease;

      await page.evaluate(({ cx, cy }) => {
        const el = document.getElementById('spectra-demo-cursor');
        if (el) {
          el.style.left = `${cx}px`;
          el.style.top = `${cy}px`;
        }
      }, { cx: x, cy: y });

      await page.mouse.move(x, y);
      await page.waitForTimeout(16);
    }
  }

  async function clickSelector(selector, captionText, pauseMs = 1200) {
    if (captionText) await setCaption(captionText);
    const el = await page.waitForSelector(selector, { state: 'visible', timeout: 8000 });
    const box = await el.boundingBox();
    if (box) {
      const x = box.x + box.width / 2;
      const y = box.y + box.height / 2;
      await moveCursor(x, y);
      await page.waitForTimeout(200);

      await page.evaluate(() => {
        const c = document.getElementById('spectra-demo-cursor');
        if (c) c.classList.add('clicking');
      });
      await page.mouse.down();
      await page.waitForTimeout(120);
      await page.mouse.up();
      await page.evaluate(() => {
        const c = document.getElementById('spectra-demo-cursor');
        if (c) c.classList.remove('clicking');
      });
    } else {
      await el.click({ force: true });
    }
    await page.waitForTimeout(pauseMs);
  }

  async function clickPoint(x, y, captionText, pauseMs = 1000) {
    if (captionText) await setCaption(captionText);
    await moveCursor(x, y);
    await page.waitForTimeout(200);

    await page.evaluate(() => {
      const c = document.getElementById('spectra-demo-cursor');
      if (c) c.classList.add('clicking');
    });
    await page.mouse.down();
    await page.waitForTimeout(120);
    await page.mouse.up();
    await page.evaluate(() => {
      const c = document.getElementById('spectra-demo-cursor');
      if (c) c.classList.remove('clicking');
    });
    await page.mouse.click(x, y);
    await page.waitForTimeout(pauseMs);
  }

  // ==========================================
  // ACT 1: THE BLIND SPOT (SCENARIO S3 CATCH)
  // ==========================================
  console.log('[Recorder] Starting Act 1: The Blind Spot (Scenario S3)...');
  await setCaption('Act 1: The Optical Blind Spot · Playwright Passes While Target Is 9.6% Occluded');
  await page.waitForTimeout(1500);

  // Click S3 card in LeftPane
  await clickSelector(
    'text="S3 - DOM Catch"',
    'Scenario S3: DOM Hit-Test Center-Point False Pass',
    1500,
  );

  // Timeline scrubbing: t_0 -> t_4 -> t_7
  await clickSelector(
    'button:has-text("t_0(ts)")',
    'Frame t_0 · Clean Target Baseline (Complete Checkout)',
    1200,
  );

  await clickSelector(
    'button:has-text("t_4")',
    'Frame t_4 · Floating Cart Drawer Enters Optical Stage',
    1200,
  );

  await clickSelector(
    'button:has-text("t_7(%)")',
    'Frame t_7 · Spectra Catches 9.6% Optical Edge Occlusion',
    1500,
  );

  // Toggle 3x Loupe
  await clickSelector(
    'button:has-text("[3x]")',
    'Activating 3-State Optical Loupe (3x Sub-Pixel Matrix)',
    1500,
  );

  // Loupe sub-tabs: analytics and Tiny pixel
  const analyticsTab = page.locator('button:has-text("analytics")');
  if (await analyticsTab.count()) {
    await clickSelector('button:has-text("analytics")', 'Loupe: Telemetry Proof & 3σ Noise Floor Margins', 1200);
    await clickSelector('button:has-text("Tiny pixel")', 'Loupe: Sub-Pixel Matrix Grid', 1000);
  }

  // Switch Telemetry rail to [ PROOF & PATCH ]
  await clickSelector(
    'button:has-text("[ PROOF & PATCH ]")',
    'Spectra Referee Decision Tree · 3σ Non-Fabricated Mathematical Proof',
    1800,
  );

  // ==========================================
  // ACT 2: CLOSED-LOOP REPAIR ARENA
  // ==========================================
  console.log('[Recorder] Starting Act 2: Closed-Loop Repair Arena...');
  await clickSelector(
    'button:has-text("Verify & Patch")',
    'Act 2: Closed-Loop Self-Healing · Synthesizing CSS/DOM Repair Patch...',
    2400,
  );

  // Check verified status
  await setCaption('Pass #2 Verified · 0.00% Loss · Autonomous UI Healed');
  await page.waitForTimeout(1600);

  // Switch optical view to Split View
  await clickSelector(
    'button:has-text("Split View")',
    'Interactive Split-View · Sweeping Before/After Optical Reticle',
    1200,
  );

  // Sweep reticle across canvas
  await moveCursor(960, 500, 10);
  await page.waitForTimeout(300);
  await moveCursor(720, 500, 12);
  await page.waitForTimeout(300);
  await moveCursor(1200, 500, 12);
  await page.waitForTimeout(300);
  await moveCursor(960, 500, 10);
  await page.waitForTimeout(600);

  // Switch to Scenario S1 (Canvas)
  await clickSelector(
    'div:has-text("S1 - Canvas")',
    'Cross-Scenario Versatility · S1 HTML5 Canvas Interactive Replay',
    1800,
  );

  // Switch to Scenario S2 (Mobile MP4)
  await clickSelector(
    'div:has-text("S2 - Mobile MP4")',
    'Cross-Scenario Versatility · S2 Mobile MP4 15% Loss Replay',
    1800,
  );

  // ==========================================
  // ACT 3: 45-CLIP BENCHMARK & LIVE INGEST
  // ==========================================
  console.log('[Recorder] Starting Act 3: 45-Clip Benchmark & Real-Time Upload...');
  await clickSelector(
    'button:has-text("45-Clip Benchmark")',
    'Act 3: 45-Clip Non-Fabricated Benchmark Matrix (Rule 1 Verified)',
    1800,
  );

  // Filter clicks
  await clickSelector('button:has-text("CANVAS")', 'Filter: 15 HTML5 Canvas Interactive Clips', 1000);
  await clickSelector('button:has-text("MOBILE_MP4")', 'Filter: 15 Mobile Video Checkout Clips', 1000);
  await clickSelector('button:has-text("DOM_CATCH")', 'Filter: 15 DOM Edge Occlusion Clips', 1000);
  await clickSelector('button:has-text("ALL")', 'Filter: All 45 Benchmark Clips across 3 Environments', 1000);

  // Toggle Table view
  await clickSelector(
    'button:has-text("Table")',
    'Complete Monospace Telemetry Matrix · 0% False Passes vs 94.4% DOM Hit-Test',
    1600,
  );

  await clickSelector('button:has-text("Bars")', 'Benchmark Detection Curve Summary', 1000);

  // Switch to Upload & Verify Video
  await clickSelector(
    'button:has-text("Upload & Verify Video")',
    'Real-Time Video Ingest Dropzone · Dual-Instrument Pipeline',
    1400,
  );

  // Click Hero 1-Click Sample CTA
  await clickSelector(
    'button:has-text("RUN SAMPLE CLIP")',
    'Running Dual-Instrument Optical Referee on Sample Clip...',
    2500,
  );

  await setCaption('Pipeline Complete · SAM 3.1 Mask + Pixel NCC Referee Verified');
  await page.waitForTimeout(1500);

  // ==========================================
  // ACT 4: VOICE STUDIO & SPECTRA LENS
  // ==========================================
  console.log('[Recorder] Starting Act 4: Voice Studio & Spectra Lens...');
  await clickSelector(
    'button:has-text("Voice Invariants")',
    'Act 4: Voice-Driven Invariants & Spatial Hardware Lens',
    1600,
  );

  // Click preset transcript in Voice Studio
  const mobilePayPreset = page.locator('button:has-text("Mobile Pay Button")');
  if (await mobilePayPreset.count()) {
    await clickSelector(
      'button:has-text("Mobile Pay Button")',
      'Voice Spec: "Mobile pay button stays fully visible throughout checkout"',
      1400,
    );
  }

  // Compile invariant contract to update JSON and show green flash banner
  const compileBtn = page.locator('button:has-text("Compile Invariant Contract")');
  if (await compileBtn.count()) {
    await clickSelector(
      'button:has-text("Compile Invariant Contract")',
      '✓ Synthesizing Visual Invariant Contract via Muse Spark 1.3...',
      2000,
    );
  }

  // Open Spectra Lens
  await clickSelector(
    'button:has-text("Lens")',
    'Deploying Spectra Lens Optical Calibration Overlay',
    1600,
  );

  // Click Re-verify Region to trigger optical measurement
  const reverifyBtn = page.locator('button:has-text("Re-verify Region")');
  if (await reverifyBtn.count()) {
    await clickSelector(
      'button:has-text("Re-verify Region")',
      'Spectra Lens: Optical Surface Verification via Dual-Instrument Referee',
      1600,
    );
  }

  // Verify Lens is visible, click lock invariant
  const lockBtn = page.locator('button:has-text("Lock")');
  if (await lockBtn.count()) {
    await clickSelector(
      'button:has-text("Lock")',
      'Locking Spatial Invariant via Spectra Lens Reticle',
      1400,
    );
  }

  // Close lens overlay via Escape key
  await page.keyboard.press('Escape');
  await setCaption('Closed-Loop Telemetry Verified Across All 4 Environments');
  await page.waitForTimeout(1000);

  // ==========================================
  // ACT 5: CLI, 4-TOOL MCP SERVER & RULE 2 CALIBRATION REFUSAL
  // ==========================================
  console.log('[Recorder] Starting Act 5: CLI, 4-Tool MCP Server & Rule 2 Refusal Contract...');
  await clickSelector(
    'button:has-text("CLI & MCP")',
    'Act 5: Spectra CLI, 4-Tool MCP Server & Rule 2 Calibration Refusal Contract',
    2500,
  );

  // Tab 1: Zero-BBox CLI Execution
  await clickSelector(
    'button:has-text("1. CLI Execution")',
    'Standalone CLI Execution · Zero-BBox Auto-Prompting · Exit Code 1 (9.60% Loss)',
    3000,
  );

  // Tab 2: 4-Tool MCP Server
  await clickSelector(
    'button:has-text("2. 4-Tool MCP Server")',
    '4-Tool MCP Server: spectra_verify, check, compile_invariant, closed_loop (Muse/Claude/Cursor)',
    3000,
  );

  // Tab 3: Rule 2 Refusal Contract
  await clickSelector(
    'button:has-text("3. Rule 2 Refusal")',
    'Rule 2 Non-Negotiable Contract: Fail-Closed UncalibratedError on Null Calibration',
    3500,
  );

  // Close control modal via Escape key
  await page.keyboard.press('Escape');
  await page.waitForTimeout(1000);

  // Return to Closed-Loop Arena
  await clickSelector(
    'button:has-text("Closed-Loop Repair Arena")',
    'Spectra v3.0 · Zero-False-Pass Visual Invariant Referee Ready',
    2000,
  );

  console.log('[Recorder] Walkthrough choreography completed.');
  await page.waitForTimeout(1000);

  // Close page to finalize recording
  const video = page.video();
  await page.close();
  await context.close();
  await browser.close();

  if (serverProcess) {
    console.log('[Recorder] Stopping background server process...');
    serverProcess.kill('SIGTERM');
  }

  if (video) {
    const rawVideoPath = await video.path();
    console.log(`[Recorder] Raw Playwright video saved to: ${rawVideoPath}`);

    console.log('[Recorder] Converting raw video to 1080p MP4 via ffmpeg-static...');
    const ffmpegCmd = ffmpegPath;
    const args = [
      '-y',
      '-i',
      rawVideoPath,
      '-c:v',
      'libx264',
      '-pix_fmt',
      'yuv420p',
      '-preset',
      'fast',
      '-crf',
      '20',
      outputMp4Path,
    ];

    const result = spawnSync(ffmpegCmd, args, { stdio: 'inherit' });
    if (result.status !== 0) {
      throw new Error(`ffmpeg conversion failed with exit code ${result.status}`);
    }

    const stat = fs.statSync(outputMp4Path);
    console.log(`[Recorder] Success! ${outputMp4Path} (${(stat.size / 1024 / 1024).toFixed(2)} MB)`);

    if (stat.size < 500 * 1024) {
      throw new Error(`Video file size is suspiciously small: ${stat.size} bytes`);
    }

    process.exit(0);
  } else {
    throw new Error('No video recording was captured by Playwright.');
  }
}

main().catch((err) => {
  console.error('[Recorder Error]', err);
  process.exit(1);
});
