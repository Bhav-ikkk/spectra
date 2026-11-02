import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import http from 'node:http';
import { chromium } from 'playwright';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const screenshotsDir = path.join(rootDir, 'assets', 'screenshots');

if (!fs.existsSync(screenshotsDir)) {
  fs.mkdirSync(screenshotsDir, { recursive: true });
}

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
  console.log('=== CAPTURING 6 1080P FIELD MONITOR SCREENSHOTS FOR README ===');
  let serverProcess = null;

  const alreadyRunning = await isServerRunning();
  if (!alreadyRunning) {
    console.log('[Capture] Starting production workbench server (pnpm start)...');
    serverProcess = spawn('pnpm', ['start'], {
      cwd: rootDir,
      stdio: 'pipe',
      shell: true,
      env: { ...process.env, PORT: '4173', HOST: '0.0.0.0' },
    });

    serverProcess.stdout.on('data', (d) => process.stdout.write(`[Server] ${d}`));
    serverProcess.stderr.on('data', (d) => process.stderr.write(`[Server Error] ${d}`));

    await waitForServer();
    console.log('[Capture] Workbench server is listening at http://localhost:4173');
  } else {
    console.log('[Capture] Workbench server already active at http://localhost:4173');
  }

  console.log('[Capture] Launching Playwright Chromium (1920x1080)...');
  const browser = await chromium.launch({
    channel: 'chrome',
    headless: true,
  });

  const page = await browser.newPage({
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 1,
  });

  console.log('[Capture] Navigating to http://localhost:4173...');
  await page.goto('http://localhost:4173', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);

  // -------------------------------------------------------------
  // Screenshot 01: 01-arena-the-catch.png
  // -------------------------------------------------------------
  console.log('[Capture] Capturing 01-arena-the-catch.png...');
  await page.click('text="S3 - DOM Catch"');
  await page.waitForTimeout(1200);

  await page.click('button:has-text("t_7(%)")');
  await page.waitForTimeout(1200);

  const proofTab = page.locator('button:has-text("[ PROOF & PATCH ]")');
  if (await proofTab.count()) {
    await proofTab.click();
    await page.waitForTimeout(1200);
  }

  const s01Path = path.join(screenshotsDir, '01-arena-the-catch.png');
  await page.screenshot({ path: s01Path, fullPage: false });
  console.log(`[Capture] Saved: ${s01Path} (${(fs.statSync(s01Path).size / 1024).toFixed(1)} KB)`);

  // -------------------------------------------------------------
  // Screenshot 02: 02-arena-split-curtain.png
  // -------------------------------------------------------------
  console.log('[Capture] Capturing 02-arena-split-curtain.png...');
  const verifyPatchBtn = page.locator('button:has-text("Verify & Patch")');
  if (await verifyPatchBtn.count()) {
    await verifyPatchBtn.click();
    await page.waitForTimeout(2800);
  }

  const splitViewBtn = page.locator('button:has-text("Split View")');
  if (await splitViewBtn.count()) {
    await splitViewBtn.click();
    await page.waitForTimeout(1200);
  }

  // Set split curtain to 82% across the "Complete Checkout" button
  const splitContainer = page.locator('div[class*="cursor-ew-resize"]');
  if (await splitContainer.count()) {
    const box = await splitContainer.boundingBox();
    if (box) {
      const targetX = box.x + box.width * 0.82;
      const targetY = box.y + box.height * 0.5;
      await page.mouse.click(targetX, targetY);
      await page.waitForTimeout(1000);
    }
  }

  const s02Path = path.join(screenshotsDir, '02-arena-split-curtain.png');
  await page.screenshot({ path: s02Path, fullPage: false });
  console.log(`[Capture] Saved: ${s02Path} (${(fs.statSync(s02Path).size / 1024).toFixed(1)} KB)`);

  // -------------------------------------------------------------
  // Screenshot 03: 03-benchmark-matrix.png
  // -------------------------------------------------------------
  console.log('[Capture] Capturing 03-benchmark-matrix.png...');
  await page.click('button:has-text("45-Clip Benchmark")');
  await page.waitForTimeout(1500);

  const allFilterBtn = page.locator('button:has-text("ALL")').first();
  if (await allFilterBtn.count()) {
    await allFilterBtn.click();
    await page.waitForTimeout(1000);
  }

  const s03Path = path.join(screenshotsDir, '03-benchmark-matrix.png');
  await page.screenshot({ path: s03Path, fullPage: false });
  console.log(`[Capture] Saved: ${s03Path} (${(fs.statSync(s03Path).size / 1024).toFixed(1)} KB)`);

  // -------------------------------------------------------------
  // Screenshot 04: 04-live-dropzone.png
  // -------------------------------------------------------------
  console.log('[Capture] Capturing 04-live-dropzone.png...');
  await page.click('button:has-text("Upload & Verify Video")');
  await page.waitForTimeout(1200);

  // Click RUN SAMPLE CLIP
  const sampleBtn = page.locator('button:has-text("RUN SAMPLE CLIP")');
  if (await sampleBtn.count()) {
    await sampleBtn.click();
    await page.waitForTimeout(3000);
  }

  const s04Path = path.join(screenshotsDir, '04-live-dropzone.png');
  await page.screenshot({ path: s04Path, fullPage: false });
  console.log(`[Capture] Saved: ${s04Path} (${(fs.statSync(s04Path).size / 1024).toFixed(1)} KB)`);

  // -------------------------------------------------------------
  // Screenshot 05: 05-voice-and-lens.png
  // -------------------------------------------------------------
  console.log('[Capture] Capturing 05-voice-and-lens.png...');
  await page.click('button:has-text("Lens")');
  await page.waitForTimeout(1500);

  const reverifyBtn = page.locator('button:has-text("Re-verify Region")');
  if (await reverifyBtn.count()) {
    await reverifyBtn.click();
    await page.waitForTimeout(2000);
  }

  const s05Path = path.join(screenshotsDir, '05-voice-and-lens.png');
  await page.screenshot({ path: s05Path, fullPage: false });
  console.log(`[Capture] Saved: ${s05Path} (${(fs.statSync(s05Path).size / 1024).toFixed(1)} KB)`);

  // -------------------------------------------------------------
  // Screenshot 06: 06-cli-mcp-control-panel.png
  // -------------------------------------------------------------
  console.log('[Capture] Capturing 06-cli-mcp-control-panel.png...');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(800);

  await page.click('button:has-text("CLI & MCP")');
  await page.waitForTimeout(1200);

  const allOverviewBtn = page.locator('button:has-text("Full Overview")');
  if (await allOverviewBtn.count()) {
    await allOverviewBtn.click();
    await page.waitForTimeout(1000);
  }

  const s06Path = path.join(screenshotsDir, '06-cli-mcp-control-panel.png');
  await page.screenshot({ path: s06Path, fullPage: false });
  console.log(`[Capture] Saved: ${s06Path} (${(fs.statSync(s06Path).size / 1024).toFixed(1)} KB)`);

  // Close browser and cleanup
  await browser.close();

  if (serverProcess) {
    console.log('[Capture] Stopping background server process...');
    serverProcess.kill('SIGTERM');
  }

  console.log('=== ALL 6 SCREENSHOTS CAPTURED SUCCESSFULLY ===');
  process.exit(0);
}

main().catch((err) => {
  console.error('[Capture Error]', err);
  process.exit(1);
});
