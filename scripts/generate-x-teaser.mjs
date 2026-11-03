import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { chromium } from 'playwright';
import ffmpegPath from 'ffmpeg-static';
import ffprobeStatic from 'ffprobe-static';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const outputMp4Path = path.join(rootDir, 'spectra-x-teaser.mp4');
const tmpDir = path.join(rootDir, '.x-teaser-tmp');

// Ensure working temp directory exists
if (!fs.existsSync(tmpDir)) {
  fs.mkdirSync(tmpDir, { recursive: true });
}

// -------------------------------------------------------------
// Step 1: Synthesize High-Impact Hardware Audio Track (48kHz Stereo)
// -------------------------------------------------------------
function generateHardwareSoundtrack(outputPath, durationSeconds = 15.0, sampleRate = 48000) {
  console.log(`[Audio Synth] Synthesizing ${durationSeconds}s stereo hardware audio track at ${sampleRate}Hz...`);
  const numFrames = Math.floor(sampleRate * durationSeconds);
  const left = new Float32Array(numFrames);
  const right = new Float32Array(numFrames);

  const add = (channel, idx, val) => {
    if (idx >= 0 && idx < numFrames) {
      channel[idx] += val;
    }
  };

  // 1. Subtle hardware drone / air floor (0.0s - 15.0s)
  for (let i = 0; i < numFrames; i++) {
    const t = i / sampleRate;
    const drone = Math.sin(2 * Math.PI * 55 * t) * 0.022;
    const sub = Math.sin(2 * Math.PI * 110 * t) * 0.012;
    const noise = (Math.random() * 2 - 1) * 0.004;
    left[i] += drone + sub + noise;
    right[i] += drone * 0.9 + sub * 1.1 + noise * 0.9;
  }

  // 2. 0.20s: Deep sub-bass impact (60Hz exponential decay) + crisp mechanical shutter click
  const tImpact = 0.20;
  const impactFrames = Math.floor(1.4 * sampleRate);
  for (let n = 0; n < impactFrames; n++) {
    const tau = n / sampleRate;
    const idx = Math.floor(tImpact * sampleRate) + n;
    const freq = 45 + 30 * Math.exp(-6 * tau);
    const subBass = Math.sin(2 * Math.PI * freq * tau) * Math.exp(-4.5 * tau) * 0.78;
    const punch = Math.sin(2 * Math.PI * (freq * 2) * tau) * Math.exp(-9 * tau) * 0.35;
    add(left, idx, subBass + punch);
    add(right, idx, subBass + punch);
  }

  // Crisp mechanical shutter click (dual metallic click transient)
  const click1Idx = Math.floor(0.200 * sampleRate);
  for (let n = 0; n < 800; n++) {
    const tau = n / sampleRate;
    const click = (Math.random() * 2 - 1) * Math.exp(-220 * tau) * 0.48;
    const ring = Math.sin(2 * Math.PI * 2800 * tau) * Math.exp(-180 * tau) * 0.32;
    add(left, click1Idx + n, click + ring);
    add(right, click1Idx + n, click * 0.8 + ring * 1.2);
  }
  const click2Idx = Math.floor(0.235 * sampleRate);
  for (let n = 0; n < 1200; n++) {
    const tau = n / sampleRate;
    const click = (Math.random() * 2 - 1) * Math.exp(-140 * tau) * 0.42;
    const body = Math.sin(2 * Math.PI * 1650 * tau) * Math.exp(-120 * tau) * 0.26;
    add(left, click2Idx + n, click + body);
    add(right, click2Idx + n, click + body);
  }

  // 3. 1.80s: Warning telemetry double-beep (880Hz / 440Hz short pulse) + heavy thud
  const tStamp = 1.80;
  const thudFrames = Math.floor(0.6 * sampleRate);
  for (let n = 0; n < thudFrames; n++) {
    const tau = n / sampleRate;
    const idx = Math.floor(tStamp * sampleRate) + n;
    const thud = Math.sin(2 * Math.PI * (110 - 60 * tau) * tau) * Math.exp(-8 * tau) * 0.58;
    add(left, idx, thud);
    add(right, idx, thud);
  }

  // Pulse 1: 880Hz (75ms)
  const beep1Start = Math.floor(1.80 * sampleRate);
  const beep1Len = Math.floor(0.075 * sampleRate);
  for (let n = 0; n < beep1Len; n++) {
    const tau = n / sampleRate;
    const env = Math.sin(Math.PI * (n / beep1Len));
    const tone = Math.sin(2 * Math.PI * 880 * tau) * env * 0.38;
    add(left, beep1Start + n, tone);
    add(right, beep1Start + n, tone);
  }

  // Pulse 2: 440Hz (95ms) at 1.91s
  const beep2Start = Math.floor(1.91 * sampleRate);
  const beep2Len = Math.floor(0.095 * sampleRate);
  for (let n = 0; n < beep2Len; n++) {
    const tau = n / sampleRate;
    const env = Math.sin(Math.PI * (n / beep2Len));
    const tone = Math.sin(2 * Math.PI * 440 * tau) * env * 0.42;
    add(left, beep2Start + n, tone);
    add(right, beep2Start + n, tone);
  }

  // 4. 3.60s: Warm analog synth chord swell (220Hz + 330Hz + 440Hz low-pass filtered pad)
  const tSwell = 3.60;
  const swellDur = 3.5;
  const swellFrames = Math.floor(swellDur * sampleRate);
  for (let n = 0; n < swellFrames; n++) {
    const tau = n / sampleRate;
    const idx = Math.floor(tSwell * sampleRate) + n;
    let env = 0;
    if (tau < 0.7) {
      env = 0.5 * (1 - Math.cos((Math.PI * tau) / 0.7));
    } else if (tau < 2.5) {
      env = 1.0;
    } else {
      const rel = (tau - 2.5) / 1.0;
      env = 0.5 * (1 + Math.cos(Math.PI * rel));
    }

    const f1L = 220.0 + 0.5, f1R = 220.0 - 0.5;
    const f2L = 329.63 + 0.4, f2R = 329.63 - 0.4;
    const f3L = 440.0 + 0.6, f3R = 440.0 - 0.6;
    const f4 = 554.37;

    const waveL = (
      Math.sin(2 * Math.PI * f1L * tau) * 0.45 +
      Math.sin(2 * Math.PI * f2L * tau) * 0.35 +
      Math.sin(2 * Math.PI * f3L * tau) * 0.30 +
      Math.sin(2 * Math.PI * f4 * tau) * 0.15 +
      Math.sin(4 * Math.PI * f1L * tau) * 0.12
    );
    const waveR = (
      Math.sin(2 * Math.PI * f1R * tau) * 0.45 +
      Math.sin(2 * Math.PI * f2R * tau) * 0.35 +
      Math.sin(2 * Math.PI * f3R * tau) * 0.30 +
      Math.sin(2 * Math.PI * f4 * tau) * 0.15 +
      Math.sin(4 * Math.PI * f1R * tau) * 0.12
    );

    add(left, idx, waveL * env * 0.38);
    add(right, idx, waveR * env * 0.38);
  }

  // 5. 7.60s: Optical laser sweep sound as Split-Curtain wipes across Checkout button
  const tLaser = 7.60;
  const laserDur = 0.85;
  const laserFrames = Math.floor(laserDur * sampleRate);
  for (let n = 0; n < laserFrames; n++) {
    const tau = n / sampleRate;
    const idx = Math.floor(tLaser * sampleRate) + n;
    const p = tau / laserDur;
    const freq = 380 + 2020 * Math.pow(1 - p, 2.2);
    const phase = 2 * Math.PI * (380 * tau + 2020 * (1 - Math.pow(1 - p, 3.2)) / (3.2 / laserDur));
    const tone = Math.sin(phase) * Math.sin(Math.PI * p) * 0.34;
    const panL = 1 - 0.7 * p;
    const panR = 0.3 + 0.7 * p;
    const sizzle = (Math.random() * 2 - 1) * Math.sin(Math.PI * p) * 0.08;
    add(left, idx, (tone + sizzle) * panL);
    add(right, idx, (tone + sizzle) * panR);
  }

  // 6. 11.50s: Emerald verification chime (523.25Hz -> 659.25Hz -> 783.99Hz C-major triad ping)
  const tLock = 11.50;
  const lockFrames = Math.floor(0.4 * sampleRate);
  for (let n = 0; n < lockFrames; n++) {
    const tau = n / sampleRate;
    const idx = Math.floor(tLock * sampleRate) + n;
    const lock = Math.sin(2 * Math.PI * 85 * tau) * Math.exp(-9 * tau) * 0.48;
    add(left, idx, lock);
    add(right, idx, lock);
  }

  const pings = [
    { time: 11.50, freq: 523.25, amp: 0.46 }, // C5
    { time: 11.64, freq: 659.25, amp: 0.46 }, // E5
    { time: 11.78, freq: 783.99, amp: 0.52 }, // G5
    { time: 11.92, freq: 1046.50, amp: 0.40 } // C6
  ];

  for (const ping of pings) {
    const startIdx = Math.floor(ping.time * sampleRate);
    const pingFrames = Math.floor(2.2 * sampleRate);
    for (let n = 0; n < pingFrames; n++) {
      const tau = n / sampleRate;
      const idx = startIdx + n;
      const primary = Math.sin(2 * Math.PI * ping.freq * tau) * Math.exp(-3.2 * tau);
      const harmonic1 = Math.sin(2 * Math.PI * (ping.freq * 2.01) * tau) * Math.exp(-4.5 * tau) * 0.35;
      const harmonic2 = Math.sin(2 * Math.PI * (ping.freq * 3.0) * tau) * Math.exp(-6.0 * tau) * 0.18;
      const sample = (primary + harmonic1 + harmonic2) * ping.amp;
      add(left, idx, sample);
      add(right, idx, sample);
    }
  }

  // Encode 16-bit PCM WAV
  const byteRate = sampleRate * 2 * 2;
  const blockAlign = 4;
  const dataSize = numFrames * blockAlign;
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + dataSize, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(2, 22); // Stereo
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(16, 34); // 16-bit
  header.write('data', 36);
  header.writeUInt32LE(dataSize, 40);

  const pcm = Buffer.alloc(dataSize);
  for (let i = 0; i < numFrames; i++) {
    const sampleL = Math.tanh(left[i] * 1.05) * 0.95;
    const sampleR = Math.tanh(right[i] * 1.05) * 0.95;

    const intL = Math.max(-32768, Math.min(32767, Math.floor(sampleL * 32767)));
    const intR = Math.max(-32768, Math.min(32767, Math.floor(sampleR * 32767)));

    pcm.writeInt16LE(intL, i * 4);
    pcm.writeInt16LE(intR, i * 4 + 2);
  }

  fs.writeFileSync(outputPath, Buffer.concat([header, pcm]));
  console.log(`[Audio Synth] Generated soundtrack at: ${outputPath} (${(fs.statSync(outputPath).size / 1024 / 1024).toFixed(2)} MB)`);
}

// -------------------------------------------------------------
// Step 2: Build Self-Contained HTML5/CSS3 Motion Graphics Document
// -------------------------------------------------------------
function buildMotionGraphicsHtml(arenaImgBase64, curtainImgBase64) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Spectra X Teaser</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    width: 1920px;
    height: 1080px;
    overflow: hidden;
    background-color: #181816;
    color: #F5F3EF;
    font-family: 'JetBrains Mono', 'SF Mono', Menlo, Consolas, monospace;
    user-select: none;
    position: relative;
  }

  /* Global Stage */
  .stage {
    position: absolute;
    inset: 0;
    width: 1920px;
    height: 1080px;
    background-color: #181816;
    background-image: 
      radial-gradient(rgba(234, 231, 223, 0.12) 1px, transparent 1px),
      linear-gradient(to right, rgba(234, 231, 223, 0.04) 1px, transparent 1px),
      linear-gradient(to bottom, rgba(234, 231, 223, 0.04) 1px, transparent 1px);
    background-size: 24px 24px, 120px 120px, 120px 120px;
    overflow: hidden;
  }

  /* Swiss Technical HUD Overlay */
  .hud-overlay {
    position: absolute;
    inset: 0;
    pointer-events: none;
    z-index: 100;
  }
  .hud-label {
    position: absolute;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.12em;
    color: rgba(234, 231, 223, 0.45);
    text-transform: uppercase;
  }
  .hud-tl { top: 32px; left: 48px; }
  .hud-tr { top: 32px; right: 48px; text-align: right; }
  .hud-bl { bottom: 32px; left: 48px; }
  .hud-br { bottom: 32px; right: 48px; text-align: right; }

  .reticle {
    position: absolute;
    width: 16px;
    height: 16px;
    border-color: rgba(234, 231, 223, 0.35);
  }
  .reticle-tl { top: 24px; left: 40px; border-top: 1.5px solid; border-left: 1.5px solid; }
  .reticle-tr { top: 24px; right: 40px; border-top: 1.5px solid; border-right: 1.5px solid; }
  .reticle-bl { bottom: 24px; left: 40px; border-bottom: 1.5px solid; border-left: 1.5px solid; }
  .reticle-br { bottom: 24px; right: 40px; border-bottom: 1.5px solid; border-right: 1.5px solid; }

  /* Scene Base */
  .scene {
    position: absolute;
    inset: 0;
    width: 1920px;
    height: 1080px;
    opacity: 0;
    pointer-events: none;
  }

  /* ========================================================
     SCENE 1: Kinetic Hook (0.0s – 3.5s)
     ======================================================== */
  body.playing .scene-1 {
    animation: scene1Master 3.5s cubic-bezier(0.16, 1, 0.3, 1) forwards;
  }

  @keyframes scene1Master {
    0% { opacity: 0; }
    4% { opacity: 1; }
    92% { opacity: 1; transform: scale(1); filter: blur(0px); }
    100% { opacity: 0; transform: scale(1.06); filter: blur(6px); }
  }

  .scene-1-container {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding-bottom: 30px;
  }

  .hook-badge {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 6px 14px;
    background: rgba(234, 231, 223, 0.08);
    border: 1px solid rgba(234, 231, 223, 0.2);
    border-radius: 4px;
    font-size: 13px;
    font-weight: 700;
    letter-spacing: 0.14em;
    color: #EAE7DF;
    margin-bottom: 24px;
    opacity: 0;
  }
  body.playing .hook-badge {
    animation: fadeIn 0.4s ease-out 0.1s forwards;
  }

  .hook-title {
    font-size: 70px;
    font-weight: 900;
    letter-spacing: -0.025em;
    text-transform: uppercase;
    text-align: center;
    line-height: 1.05;
    color: #FFFFFF;
    text-shadow: 0 10px 40px rgba(0,0,0,0.8);
    opacity: 0;
    transform: scale(1.4);
  }
  body.playing .hook-title {
    animation: slamTitle 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.25) 0.2s forwards;
  }

  @keyframes slamTitle {
    0% { opacity: 0; transform: scale(1.4); }
    100% { opacity: 1; transform: scale(1); }
  }

  .hook-title .accent-quote {
    color: #38BDF8;
    text-shadow: 0 0 30px rgba(56, 189, 248, 0.6);
  }

  /* Red Warning Stamp (1.8s) */
  .warning-stamp-box {
    margin-top: 36px;
    padding: 16px 28px;
    background: rgba(224, 82, 70, 0.16);
    border: 2px solid #E05246;
    border-radius: 6px;
    box-shadow: 0 0 35px rgba(224, 82, 70, 0.45), inset 0 0 20px rgba(224, 82, 70, 0.2);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    opacity: 0;
    transform: scale(2.2) rotate(-2deg);
  }
  body.playing .warning-stamp-box {
    animation: stampSlam 0.3s cubic-bezier(0.12, 0.9, 0.2, 1.25) 1.8s forwards;
  }

  @keyframes stampSlam {
    0% { opacity: 0; transform: scale(2.2) rotate(-2deg); }
    100% { opacity: 1; transform: scale(1) rotate(0deg); }
  }

  .stamp-tag {
    font-size: 13px;
    font-weight: 800;
    letter-spacing: 0.16em;
    color: #FF8F85;
    text-transform: uppercase;
  }
  .stamp-text {
    font-size: 26px;
    font-weight: 800;
    letter-spacing: -0.01em;
    color: #FFFFFF;
  }
  .stamp-text .highlight-red {
    color: #FF5A4D;
    font-weight: 900;
  }

  /* Zoomed-in 9.6% clipped checkout button with scanning laser */
  .clipped-button-card {
    margin-top: 36px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    opacity: 0;
    transform: translateY(20px);
  }
  body.playing .clipped-button-card {
    animation: fadeUp 0.35s ease-out 2.15s forwards;
  }

  @keyframes fadeUp {
    0% { opacity: 0; transform: translateY(20px); }
    100% { opacity: 1; transform: translateY(0); }
  }

  .button-viewport {
    position: relative;
    width: 580px;
    height: 90px;
    background: #EAE7DF;
    border-radius: 6px;
    border: 2px solid #181816;
    overflow: hidden;
    box-shadow: 0 15px 40px rgba(0,0,0,0.6);
  }
  .mock-checkout-btn {
    position: absolute;
    left: 40px;
    top: 18px;
    width: 480px;
    height: 52px;
    background: #181816;
    color: #FFFFFF;
    font-size: 19px;
    font-weight: 700;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    border-radius: 4px;
    letter-spacing: 0.02em;
  }

  /* Cart Drawer 9.6% overlap at right */
  .mock-cart-drawer {
    position: absolute;
    right: 0;
    top: 0;
    width: 95px; /* ~9.6% */
    height: 100%;
    background: rgba(224, 82, 70, 0.45);
    border-left: 2px dashed #E05246;
    background-image: repeating-linear-gradient(
      45deg,
      rgba(224, 82, 70, 0.6),
      rgba(224, 82, 70, 0.6) 8px,
      rgba(224, 82, 70, 0.2) 8px,
      rgba(224, 82, 70, 0.2) 16px
    );
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .drawer-label {
    position: absolute;
    top: 6px;
    right: 8px;
    font-size: 10px;
    font-weight: 800;
    color: #FFFFFF;
    background: #E05246;
    padding: 2px 5px;
    border-radius: 2px;
  }

  /* Laser scanner line */
  .laser-scanner-line {
    position: absolute;
    top: 0;
    bottom: 0;
    width: 3px;
    background: #38BDF8;
    box-shadow: 0 0 12px #38BDF8, 0 0 24px rgba(56, 189, 248, 0.9);
    opacity: 0;
  }
  body.playing .laser-scanner-line {
    animation: laserScan 1.0s cubic-bezier(0.4, 0, 0.2, 1) 2.2s infinite alternate;
  }

  @keyframes laserScan {
    0% { left: 40px; opacity: 1; }
    100% { left: 520px; opacity: 1; }
  }

  .button-telemetry-row {
    display: flex;
    gap: 20px;
    font-size: 13px;
    font-weight: 700;
  }
  .tel-chip-fail {
    color: #FF7B70;
    background: rgba(224, 82, 70, 0.15);
    border: 1px solid rgba(224, 82, 70, 0.4);
    padding: 4px 10px;
    border-radius: 4px;
  }
  .tel-chip-pass {
    color: #38BDF8;
    background: rgba(56, 189, 248, 0.15);
    border: 1px solid rgba(56, 189, 248, 0.4);
    padding: 4px 10px;
    border-radius: 4px;
  }

  /* ========================================================
     SCENE 2: 3D Isometric Field Monitor Reveal (3.5s – 7.5s)
     ======================================================== */
  body.playing .scene-2 {
    animation: scene2Master 4.0s cubic-bezier(0.16, 1, 0.3, 1) 3.5s forwards;
  }

  @keyframes scene2Master {
    0% { opacity: 0; }
    5% { opacity: 1; }
    90% { opacity: 1; transform: scale(1); filter: blur(0px); }
    100% { opacity: 0; transform: scale(1.08); filter: blur(8px); }
  }

  .scene-2-wrap {
    position: absolute;
    inset: 0;
    perspective: 1300px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .chassis-3d {
    width: 1720px;
    height: 968px;
    background: #0D0D0C;
    border-radius: 12px;
    border: 2px solid #33322E;
    box-shadow: 0 40px 100px rgba(0,0,0,0.95), 0 0 0 1px rgba(255,255,255,0.08);
    position: relative;
    overflow: hidden;
    transform: rotateX(14deg) rotateY(-12deg) scale(0.93) translateZ(-40px);
  }
  body.playing .chassis-3d {
    animation: camera3DMove 2.2s cubic-bezier(0.2, 0.8, 0.25, 1) 3.6s forwards;
  }

  @keyframes camera3DMove {
    0% { transform: rotateX(14deg) rotateY(-12deg) scale(0.93) translateZ(-40px); }
    100% { transform: rotateX(0deg) rotateY(0deg) scale(1) translateZ(0); }
  }

  .chassis-image {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }

  /* Animated HUD Reticle Callout (4.8s) */
  .scene-2-callout {
    position: absolute;
    right: 120px;
    bottom: 110px;
    width: 580px;
    background: rgba(24, 24, 22, 0.92);
    backdrop-filter: blur(12px);
    border: 2px solid #38BDF8;
    border-radius: 8px;
    padding: 20px 24px;
    box-shadow: 0 20px 60px rgba(0,0,0,0.9), 0 0 30px rgba(56, 189, 248, 0.35);
    opacity: 0;
    transform: scale(0.7) translateY(40px);
  }
  body.playing .scene-2-callout {
    animation: popCallout 0.45s cubic-bezier(0.175, 0.885, 0.32, 1.25) 4.8s forwards;
  }

  @keyframes popCallout {
    0% { opacity: 0; transform: scale(0.7) translateY(40px); }
    100% { opacity: 1; transform: scale(1) translateY(0); }
  }

  .callout-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 1px solid rgba(234, 231, 223, 0.15);
    padding-bottom: 10px;
    margin-bottom: 14px;
  }
  .callout-title {
    font-size: 13px;
    font-weight: 800;
    letter-spacing: 0.1em;
    color: #38BDF8;
  }
  .callout-tag {
    font-size: 11px;
    font-weight: 800;
    background: #E05246;
    color: #FFFFFF;
    padding: 3px 8px;
    border-radius: 3px;
  }

  .callout-metric-row {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    margin-bottom: 10px;
  }
  .metric-large {
    font-size: 28px;
    font-weight: 900;
    color: #FFFFFF;
    letter-spacing: -0.02em;
  }
  .metric-diff {
    font-size: 18px;
    font-weight: 900;
    color: #FF5A4D;
  }

  .callout-footer {
    font-size: 12px;
    font-weight: 600;
    color: #B5B1A6;
    line-height: 1.4;
  }

  /* Reticle box over actual button in screenshot */
  .viewport-reticle {
    position: absolute;
    right: 48px;
    bottom: 40px;
    width: 280px;
    height: 80px;
    border: 2px dashed #38BDF8;
    background: rgba(224, 82, 70, 0.25);
    opacity: 0;
  }
  body.playing .viewport-reticle {
    animation: fadeInReticle 0.3s ease-out 4.8s forwards;
  }
  @keyframes fadeInReticle {
    0% { opacity: 0; transform: scale(1.15); }
    100% { opacity: 1; transform: scale(1); }
  }

  /* ========================================================
     SCENE 3: High-Speed Split-Curtain Optical Wipe (7.5s – 11.5s)
     ======================================================== */
  body.playing .scene-3 {
    animation: scene3Master 4.0s cubic-bezier(0.16, 1, 0.3, 1) 7.5s forwards;
  }

  @keyframes scene3Master {
    0% { opacity: 0; }
    5% { opacity: 1; }
    90% { opacity: 1; transform: scale(1); filter: blur(0px); }
    100% { opacity: 0; transform: scale(1.08); filter: blur(8px); }
  }

  .scene-3-wrap {
    position: absolute;
    inset: 0;
    width: 1920px;
    height: 1080px;
  }
  .split-image {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }

  /* Animated Optical Curtain Overlay */
  .optical-curtain-strip {
    position: absolute;
    top: 0;
    bottom: 0;
    width: 4px;
    background: #38BDF8;
    box-shadow: 0 0 15px #38BDF8, 0 0 35px rgba(56, 189, 248, 0.9);
    left: 20%;
  }
  body.playing .optical-curtain-strip {
    animation: curtainSweep 3.2s cubic-bezier(0.4, 0, 0.2, 1) 7.6s forwards;
  }

  @keyframes curtainSweep {
    0% { left: 20%; }
    50% { left: 82%; }
    100% { left: 82%; }
  }

  .curtain-rangefinder-knob {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: #181816;
    border: 2px solid #38BDF8;
    color: #38BDF8;
    padding: 8px 16px;
    border-radius: 4px;
    font-size: 13px;
    font-weight: 800;
    letter-spacing: 0.1em;
    white-space: nowrap;
    box-shadow: 0 10px 30px rgba(0,0,0,0.8);
  }

  /* Dual Badges */
  .curtain-badge {
    position: absolute;
    padding: 14px 20px;
    border-radius: 6px;
    box-shadow: 0 15px 40px rgba(0,0,0,0.8);
    backdrop-filter: blur(8px);
    display: flex;
    flex-direction: column;
    gap: 4px;
    opacity: 0;
  }
  .badge-before {
    left: 60px;
    top: 100px;
    background: rgba(24, 24, 22, 0.9);
    border: 2px solid #E05246;
  }
  .badge-after {
    right: 60px;
    top: 100px;
    background: rgba(24, 24, 22, 0.9);
    border: 2px solid #2E7D52;
  }

  body.playing .badge-before {
    animation: fadeBadge 0.35s ease-out 7.7s forwards;
  }
  body.playing .badge-after {
    animation: fadeBadge 0.35s ease-out 8.4s forwards;
  }

  @keyframes fadeBadge {
    0% { opacity: 0; transform: translateY(-20px); }
    100% { opacity: 1; transform: translateY(0); }
  }

  .curtain-tag-fail {
    font-size: 15px;
    font-weight: 900;
    color: #FF6B5E;
  }
  .curtain-tag-pass {
    font-size: 15px;
    font-weight: 900;
    color: #4ADE80;
  }
  .curtain-sub {
    font-size: 12px;
    font-weight: 600;
    color: #DFDCD3;
  }

  .curtain-top-banner {
    position: absolute;
    top: 48px;
    left: 50%;
    transform: translateX(-50%);
    background: #181816;
    border: 1px solid rgba(234, 231, 223, 0.3);
    padding: 8px 24px;
    border-radius: 20px;
    font-size: 12px;
    font-weight: 800;
    letter-spacing: 0.12em;
    color: #FFFFFF;
    display: flex;
    align-items: center;
    gap: 10px;
    box-shadow: 0 10px 30px rgba(0,0,0,0.8);
  }
  .led-live {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #2E7D52;
    box-shadow: 0 0 10px #2E7D52;
  }

  /* ========================================================
     SCENE 4: Final Scoreboard & CTA Card (11.5s – 15.0s)
     ======================================================== */
  body.playing .scene-4 {
    animation: scene4Master 3.5s cubic-bezier(0.16, 1, 0.3, 1) 11.5s forwards;
  }

  @keyframes scene4Master {
    0% { opacity: 0; transform: scale(1.08); }
    6% { opacity: 1; transform: scale(1); }
    100% { opacity: 1; transform: scale(1); }
  }

  .scene-4-container {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .bento-card {
    width: 1480px;
    background: #EAE7DF;
    color: #181816;
    border-radius: 12px;
    border: 2px solid #181816;
    box-shadow: 0 30px 90px rgba(0,0,0,0.9), 0 0 0 1px rgba(255,255,255,0.1);
    padding: 44px 56px;
    display: flex;
    flex-direction: column;
    gap: 32px;
  }

  /* Bento Header */
  .bento-header-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 2px solid #181816;
    padding-bottom: 24px;
  }
  .bento-brand {
    display: flex;
    align-items: baseline;
    gap: 16px;
  }
  .bento-logo {
    font-size: 38px;
    font-weight: 900;
    letter-spacing: -0.03em;
    color: #181816;
  }
  .bento-ver {
    font-size: 18px;
    font-weight: 800;
    background: #181816;
    color: #EAE7DF;
    padding: 3px 8px;
    border-radius: 3px;
  }
  .bento-subtitle {
    font-size: 14px;
    font-weight: 600;
    color: #4A4843;
    letter-spacing: 0.04em;
  }
  .bento-status-pill {
    display: flex;
    align-items: center;
    gap: 8px;
    background: #DCE8DF;
    border: 1px solid #9BB8A5;
    color: #1D4D35;
    font-size: 12px;
    font-weight: 800;
    letter-spacing: 0.1em;
    padding: 6px 14px;
    border-radius: 4px;
  }

  /* 3 Stat Pillars */
  .bento-pillars-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 24px;
  }
  .bento-pillar {
    background: #DFDCD3;
    border: 1.5px solid #B8B4A9;
    border-radius: 8px;
    padding: 24px;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .bento-pillar.emerald-pillar {
    background: #DCE8DF;
    border: 2px solid #2E7D52;
    box-shadow: 0 10px 25px rgba(46, 125, 82, 0.15);
  }
  .pillar-label {
    font-size: 12px;
    font-weight: 800;
    letter-spacing: 0.1em;
    color: #4A4843;
    text-transform: uppercase;
  }
  .pillar-value {
    font-size: 58px;
    font-weight: 900;
    letter-spacing: -0.04em;
    line-height: 1;
    color: #181816;
  }
  .pillar-value.emerald-val {
    color: #2E7D52;
  }
  .pillar-desc {
    font-size: 13px;
    font-weight: 600;
    color: #78756E;
  }

  /* Triple Engine Row */
  .bento-engine-row {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 20px;
  }
  .engine-item {
    background: #D6D3C9;
    border: 1px solid #B8B4A9;
    border-radius: 6px;
    padding: 14px 18px;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .engine-name {
    font-size: 13px;
    font-weight: 800;
    color: #181816;
    letter-spacing: 0.05em;
  }
  .engine-detail {
    font-size: 11px;
    font-weight: 600;
    color: #4A4843;
  }

  /* Integration Bar & URL */
  .bento-tools-bar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: #181816;
    color: #EAE7DF;
    border-radius: 6px;
    padding: 12px 20px;
  }
  .tools-chips {
    display: flex;
    gap: 12px;
    font-size: 12px;
    font-weight: 800;
  }
  .tool-badge {
    color: #B5B1A6;
  }
  .tool-badge.active {
    color: #38BDF8;
  }
  .live-url {
    font-size: 14px;
    font-weight: 800;
    color: #38BDF8;
    letter-spacing: 0.04em;
  }

  /* Climax Tagline Slam (12.8s) */
  .bento-tagline {
    background: #181816;
    color: #FFFFFF;
    font-size: 30px;
    font-weight: 900;
    letter-spacing: 0.02em;
    text-align: center;
    padding: 16px;
    border-radius: 6px;
    box-shadow: 0 10px 30px rgba(0,0,0,0.5);
    opacity: 0;
    transform: scale(0.92);
  }
  body.playing .bento-tagline {
    animation: slamTagline 0.35s cubic-bezier(0.175, 0.885, 0.32, 1.25) 12.8s forwards;
  }

  @keyframes slamTagline {
    0% { opacity: 0; transform: scale(0.92); }
    100% { opacity: 1; transform: scale(1); }
  }
  .tagline-accent {
    color: #E05246;
  }
</style>
</head>
<body>
  <div class="stage">
    <!-- Swiss Technical HUD -->
    <div class="hud-overlay">
      <div class="hud-label hud-tl">SPECTRA V3.0 // DUAL-INSTRUMENT VERIFIER</div>
      <div class="hud-label hud-tr">1080P60 // SWISS INDUSTRIAL TELEMETRY</div>
      <div class="hud-label hud-bl">LAT 47.3769° N · LNG 8.5417° E · CH-8001</div>
      <div class="hud-label hud-br">BENCHMARK: 45-CLIP CALIBRATED SWEEP</div>
      <div class="reticle reticle-tl"></div>
      <div class="reticle reticle-tr"></div>
      <div class="reticle reticle-bl"></div>
      <div class="reticle reticle-br"></div>
    </div>

    <!-- SCENE 1: Kinetic Hook (0.0s – 3.5s) -->
    <div class="scene scene-1">
      <div class="scene-1-container">
        <div class="hook-badge">
          <span>●</span> OPTICAL ANOMALY BENCHMARK REPORT
        </div>
        <div class="hook-title">
          AI AGENTS SAY YOUR UI IS <span class="accent-quote">"DONE."</span>
        </div>

        <div class="warning-stamp-box">
          <div class="stamp-tag">CRITICAL REALITY GAP DETECTED</div>
          <div class="stamp-text">
            PLAYWRIGHT FALSE-PASSES <span class="highlight-red">94.4%</span> · VLMs FALSE-PASS <span class="highlight-red">61.1%</span>
          </div>
        </div>

        <div class="clipped-button-card">
          <div class="button-viewport">
            <div class="mock-checkout-btn">
              <span>🔒</span> Complete Checkout — $149.00
            </div>
            <div class="mock-cart-drawer">
              <span class="drawer-label">DRAWER</span>
            </div>
            <div class="laser-scanner-line"></div>
          </div>
          <div class="button-telemetry-row">
            <div class="tel-chip-fail">DOM document.contains() === TRUE [FALSE PASS]</div>
            <div class="tel-chip-pass">SAM 3.1: -9.60% PIXEL LOSS [REALITY CAUGHT]</div>
          </div>
        </div>
      </div>
    </div>

    <!-- SCENE 2: 3D Isometric Field Monitor Reveal (3.5s – 7.5s) -->
    <div class="scene scene-2">
      <div class="scene-2-wrap">
        <div class="chassis-3d">
          <img src="${arenaImgBase64}" class="chassis-image" alt="Spectra Field Monitor" />
          
          <div class="viewport-reticle"></div>

          <div class="scene-2-callout">
            <div class="callout-header">
              <div class="callout-title">SAM 3.1 TELEMETRY // SCENARIO S3</div>
              <div class="callout-tag">REJECTED</div>
            </div>
            <div class="callout-metric-row">
              <div class="metric-large">17,299 px → 15,708 px</div>
              <div class="metric-diff">-9.60% LOSS CAUGHT</div>
            </div>
            <div class="callout-footer">
              STATUS: THRESHOLD δ = 4.10% EXCEEDED · NOISE-FLOOR 3σ = 1.35%<br>
              RESULT: ZERO FALSE-PASS REFEREE VERIFIED
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- SCENE 3: High-Speed Split-Curtain Optical Wipe (7.5s – 11.5s) -->
    <div class="scene scene-3">
      <div class="scene-3-wrap">
        <img src="${curtainImgBase64}" class="split-image" alt="Split Comparator" />
        
        <div class="curtain-top-banner">
          <span class="led-live"></span>
          <span>OPTICAL COMPARATOR: ZERO DELTA RESTORATION CONFIRMED</span>
        </div>

        <div class="optical-curtain-strip">
          <div class="curtain-rangefinder-knob">
            <span>◆</span> 82.4% SPLIT
          </div>
        </div>

        <div class="curtain-badge badge-before">
          <div class="curtain-tag-fail">PASS #1: 9.6% CLIPPED</div>
          <div class="curtain-sub">FAIL — REJECTED BY SPECTRA REFEREE</div>
        </div>

        <div class="curtain-badge badge-after">
          <div class="curtain-tag-pass">PASS #2: 100.0% RESTORED</div>
          <div class="curtain-sub">via Muse Spark Open 1026 — 0.00% PIXEL LOSS</div>
        </div>
      </div>
    </div>

    <!-- SCENE 4: Final Scoreboard & CTA Card (11.5s – 15.0s) -->
    <div class="scene scene-4">
      <div class="scene-4-container">
        <div class="bento-card">
          <div class="bento-header-row">
            <div class="bento-brand">
              <div class="bento-logo">SPECTRA</div>
              <div class="bento-ver">V3.0</div>
              <div class="bento-subtitle">AUTONOMOUS VISUAL INVARIANT REFEREE</div>
            </div>
            <div class="bento-status-pill">
              <span>●</span> CLOSED-LOOP VERIFIED
            </div>
          </div>

          <div class="bento-pillars-grid">
            <div class="bento-pillar emerald-pillar">
              <div class="pillar-label">FALSE-PASS RATE</div>
              <div class="pillar-value emerald-val">0.0%</div>
              <div class="pillar-desc">0 of 18 occluded clips missed</div>
            </div>
            <div class="bento-pillar">
              <div class="pillar-label">ACCURACY</div>
              <div class="pillar-value">1.11%</div>
              <div class="pillar-desc">Mean Absolute Error (MAE)</div>
            </div>
            <div class="bento-pillar">
              <div class="pillar-label">REFEREE LATENCY</div>
              <div class="pillar-value">~480ms</div>
              <div class="pillar-desc">8 frames @ 4FPS · $0.00 Cached</div>
            </div>
          </div>

          <div class="bento-engine-row">
            <div class="engine-item">
              <div class="engine-name">META SAM 3.1</div>
              <div class="engine-detail">Pixel-Perfect Zero-Shot Segmentation</div>
            </div>
            <div class="engine-item">
              <div class="engine-name">MUSE SPARK 1.3</div>
              <div class="engine-detail">Visual Invariant Compiler & Referee</div>
            </div>
            <div class="engine-item">
              <div class="engine-name">MUSE VOICE 1.0</div>
              <div class="engine-detail">Natural Voice Directive Ingest</div>
            </div>
          </div>

          <div class="bento-tools-bar">
            <div class="tools-chips">
              <span class="tool-badge active">CLI</span>
              <span>·</span>
              <span class="tool-badge active">4-TOOL MCP SERVER</span>
              <span>·</span>
              <span class="tool-badge">CLAUDE CODE</span>
              <span>·</span>
              <span class="tool-badge">CURSOR</span>
              <span>·</span>
              <span class="tool-badge">CODEX</span>
            </div>
            <div class="live-url">spectra-lyart.vercel.app</div>
          </div>

          <div class="bento-tagline">
            "DON'T TRUST 'DONE.' MEASURE IT<span class="tagline-accent">.</span>"
          </div>
        </div>
      </div>
    </div>
  </div>
</body>
</html>`;
}

// -------------------------------------------------------------
// Step 3: Main Orchestration
// -------------------------------------------------------------
async function main() {
  console.log('=== SPECTRA V3.0 MOTION-GRAPHICS LAUNCH TEASER GENERATOR ===');

  // Verify prerequisites
  const screenshot1Path = path.join(rootDir, 'assets', 'screenshots', '01-arena-the-catch.png');
  const screenshot2Path = path.join(rootDir, 'assets', 'screenshots', '02-arena-split-curtain.png');

  if (!fs.existsSync(screenshot1Path) || !fs.existsSync(screenshot2Path)) {
    throw new Error('Required screenshots in assets/screenshots/ do not exist!');
  }

  // 1. Synthesize audio track
  const audioWavPath = path.join(tmpDir, 'soundtrack.wav');
  generateHardwareSoundtrack(audioWavPath, 15.0);

  // 2. Prepare HTML motion graphics
  console.log('[Motion Graphics] Loading screenshot assets and building motion-graphics HTML...');
  const arenaBase64 = `data:image/png;base64,${fs.readFileSync(screenshot1Path).toString('base64')}`;
  const curtainBase64 = `data:image/png;base64,${fs.readFileSync(screenshot2Path).toString('base64')}`;
  const htmlContent = buildMotionGraphicsHtml(arenaBase64, curtainBase64);
  const htmlFilePath = path.join(tmpDir, 'teaser.html');
  fs.writeFileSync(htmlFilePath, htmlContent);

  // 3. Launch Playwright to record 15.0s video
  console.log('[Recorder] Launching Playwright Chromium (1920x1080) for 15s motion-graphics capture...');
  const browser = await chromium.launch({
    channel: 'chrome',
    headless: true,
  });

  const context = await browser.newContext({
    recordVideo: {
      dir: tmpDir,
      size: { width: 1920, height: 1080 },
    },
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 1,
  });

  const page = await context.newPage();
  const fileUrl = 'file:///' + htmlFilePath.replace(/\\/g, '/');
  await page.goto(fileUrl, { waitUntil: 'load' });
  await page.waitForTimeout(600); // browser compositor warm up

  console.log('[Recorder] Triggering animation playback (.playing) for 15.0 seconds...');
  await page.evaluate(() => document.body.classList.add('playing'));
  await page.waitForTimeout(15000); // record for 15.0 seconds

  const video = page.video();
  await page.close();
  await context.close();
  await browser.close();

  if (!video) {
    throw new Error('Playwright did not capture video.');
  }

  const rawWebmPath = await video.path();
  console.log(`[Recorder] Raw Playwright capture saved to: ${rawWebmPath}`);

  // 4. Mux and Encode into 1080p MP4 with AAC Stereo Audio via ffmpeg
  console.log('[Muxer] Muxing video and synthesized audio via ffmpeg into spectra-x-teaser.mp4...');
  const ffmpegCmd = ffmpegPath;
  const ffmpegArgs = [
    '-y',
    '-ss', '0.6', // seek video past initial 600ms compositor warmup
    '-i', rawWebmPath,
    '-i', audioWavPath,
    '-map', '0:v:0',
    '-map', '1:a:0',
    '-c:v', 'libx264',
    '-pix_fmt', 'yuv420p',
    '-preset', 'medium',
    '-crf', '18',
    '-c:a', 'aac',
    '-b:a', '192k',
    '-t', '15.0', // guarantee exact 15.0s output duration
    '-shortest',
    outputMp4Path,
  ];

  const convResult = spawnSync(ffmpegCmd, ffmpegArgs, { stdio: 'inherit' });
  if (convResult.status !== 0) {
    throw new Error(`ffmpeg muxing failed with status: ${convResult.status}`);
  }

  // 5. Verify output file with ffprobe
  console.log('[Verification] Probing output video via ffprobe...');
  const ffprobePath = ffprobeStatic.path;
  const probeResult = spawnSync(ffprobePath, [
    '-v', 'error',
    '-show_entries', 'format=duration,size:stream=index,codec_type,codec_name,width,height,channels',
    '-of', 'json',
    outputMp4Path,
  ]);

  if (probeResult.status !== 0) {
    throw new Error(`ffprobe failed: ${probeResult.stderr.toString()}`);
  }

  const probeData = JSON.parse(probeResult.stdout.toString());
  console.log('[Verification] Stream Metadata:', JSON.stringify(probeData, null, 2));

  const duration = parseFloat(probeData.format.duration);
  const size = parseInt(probeData.format.size, 10);
  const videoStream = probeData.streams.find((s) => s.codec_type === 'video');
  const audioStream = probeData.streams.find((s) => s.codec_type === 'audio');

  if (!videoStream || videoStream.codec_name !== 'h264' || videoStream.width !== 1920 || videoStream.height !== 1080) {
    throw new Error(`Invalid video stream: ${JSON.stringify(videoStream)}`);
  }

  if (!audioStream || audioStream.codec_name !== 'aac' || audioStream.channels !== 2) {
    throw new Error(`Invalid audio stream: ${JSON.stringify(audioStream)}`);
  }

  if (duration < 14.0 || duration > 16.0) {
    throw new Error(`Duration outside target [14s, 16s]: ${duration}s`);
  }

  console.log('\n======================================================');
  console.log('🎉 SUCCESS: SPECTRA X TEASER READY FOR IMMEDIATE POSTING!');
  console.log(`Path:     ${outputMp4Path}`);
  console.log(`Duration: ${duration.toFixed(2)}s`);
  console.log(`Size:     ${(size / 1024 / 1024).toFixed(2)} MB`);
  console.log(`Video:    ${videoStream.codec_name} 1920x1080 (1080p)`);
  console.log(`Audio:    ${audioStream.codec_name} Stereo 48kHz (Synthesized hardware sound design)`);
  console.log('======================================================\n');

  // Clean up temporary files
  try {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    console.log('[Cleanup] Temporary directory removed cleanly.');
  } catch {
    // ignore cleanup errors
  }
}

main().catch((err) => {
  console.error('[Teaser Generator Error]', err);
  process.exit(1);
});
