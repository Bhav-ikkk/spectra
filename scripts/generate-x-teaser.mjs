import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { chromium } from 'playwright';
import ffmpegPath from 'ffmpeg-static';
import ffprobeStatic from 'ffprobe-static';
import { synthesizeTactileAudio } from './synth-tactile-audio.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const demoRecordingsDir = path.join(rootDir, 'demo-recordings');
const audioWavPath = path.join(demoRecordingsDir, 'tactile-soundtrack.wav');
const outputTeaserPath = path.join(rootDir, 'spectra-x-teaser.mp4');
const outputViralPath = path.join(rootDir, 'spectra-x-viral.mp4');
const tmpDir = path.join(rootDir, '.x-viral-tmp');

if (!fs.existsSync(tmpDir)) {
  fs.mkdirSync(tmpDir, { recursive: true });
}

// -------------------------------------------------------------
// Step 1: Build 100% Vector Live HTML5/CSS3 Macro Choreography
// (Zero static screenshots! 2.5x macro scale for mobile X readability)
// -------------------------------------------------------------
function buildMacroVectorHtml() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Spectra Macro Launch Video</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    width: 1920px;
    height: 1080px;
    overflow: hidden;
    background-color: #EAE7DF;
    color: #181816;
    font-family: 'JetBrains Mono', 'SF Mono', Consolas, Menlo, monospace;
    user-select: none;
    position: relative;
  }

  /* Dot Grid Surface */
  .stage {
    position: absolute;
    inset: 0;
    width: 1920px;
    height: 1080px;
    background-color: #EAE7DF;
    background-image: radial-gradient(#B5B1A6 1.2px, transparent 1.2px);
    background-size: 16px 16px;
    overflow: hidden;
  }

  /* Global Top Swiss Header Bar (Visible across all scenes) */
  .global-top-bar {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 64px;
    background: #181816;
    color: #F5F3EF;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 40px;
    z-index: 200;
    border-bottom: 2px solid #33322E;
  }
  .brand-group {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .brand-led {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: #2E7D52;
    box-shadow: 0 0 10px #2E7D52;
  }
  .brand-name {
    font-size: 18px;
    font-weight: 900;
    letter-spacing: -0.02em;
  }
  .brand-sub {
    font-size: 11px;
    color: #B5B1A6;
    font-weight: 600;
    letter-spacing: 0.08em;
  }
  .global-title {
    font-size: 20px;
    font-weight: 800;
    letter-spacing: 0.06em;
    color: #FFFFFF;
  }
  .global-meta {
    font-size: 12px;
    font-weight: 700;
    color: #38BDF8;
    background: rgba(56, 189, 248, 0.12);
    border: 1px solid rgba(56, 189, 248, 0.35);
    padding: 4px 12px;
    border-radius: 4px;
    letter-spacing: 0.05em;
  }

  /* Scene Management */
  .scene {
    position: absolute;
    top: 64px;
    left: 0;
    right: 0;
    bottom: 0;
    opacity: 0;
    pointer-events: none;
  }

  /* ========================================================
     SCENE 1 (0.0s – 3.8s): The Lie vs. Reality (Frame 0 Visible!)
     ======================================================== */
  .scene-1 {
    opacity: 1; /* Instant Frame 0 visibility! No blank flash! */
    display: flex;
    padding: 30px 40px;
    gap: 32px;
  }
  body.playing .scene-1 {
    animation: scene1Exit 0.4s cubic-bezier(0.4, 0, 0.2, 1) 3.5s forwards;
  }
  @keyframes scene1Exit {
    0% { opacity: 1; transform: scale(1); filter: blur(0px); }
    100% { opacity: 0; transform: scale(0.96); filter: blur(6px); }
  }

  .panel-half {
    flex: 1;
    background: #DFDCD3;
    border: 2px solid #181816;
    border-radius: 8px;
    padding: 24px;
    display: flex;
    flex-direction: column;
    box-shadow: 0 15px 40px rgba(0,0,0,0.12);
    position: relative;
    overflow: hidden;
  }

  .panel-header-tab {
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 2px solid #181816;
    padding-bottom: 12px;
    margin-bottom: 20px;
  }
  .panel-tab-title {
    font-size: 16px;
    font-weight: 800;
    letter-spacing: 0.06em;
    color: #181816;
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .panel-badge-soft {
    font-size: 12px;
    font-weight: 800;
    padding: 4px 10px;
    border-radius: 4px;
  }
  .badge-lie {
    background: #F2C6BE;
    color: #9E2A22;
    border: 1px solid #DF9B90;
  }
  .badge-reality {
    background: #DCE8DF;
    color: #1D4D35;
    border: 1px solid #9BB8A5;
  }

  /* Left Panel: Terminal & False Pass */
  .terminal-box {
    background: #181816;
    color: #F5F3EF;
    border-radius: 6px;
    padding: 18px 20px;
    font-size: 15px;
    line-height: 1.6;
    margin-bottom: 24px;
    box-shadow: inset 0 2px 6px rgba(0,0,0,0.6);
  }
  .term-cmd { color: #38BDF8; font-weight: 700; }
  .term-pass { color: #4ADE80; font-weight: 700; }
  .term-info { color: #B5B1A6; }

  /* Macro Button Preview Viewport */
  .macro-viewport-card {
    background: #EAE7DF;
    border: 2px solid #B8B4A9;
    border-radius: 6px;
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    position: relative;
    overflow: hidden;
  }

  /* 250% Macro Checkout Button */
  .macro-checkout-btn {
    width: 660px;
    height: 84px;
    background: #181816;
    color: #FFFFFF;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 16px;
    font-size: 26px;
    font-weight: 800;
    letter-spacing: 0.02em;
    box-shadow: 0 8px 25px rgba(0,0,0,0.3);
    position: relative;
  }
  .macro-btn-price {
    background: #2E7D52;
    padding: 4px 12px;
    border-radius: 4px;
    font-size: 22px;
  }

  /* Crosshair on left panel */
  .crosshair-point {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    display: flex;
    align-items: center;
    gap: 8px;
    pointer-events: none;
  }
  .crosshair-reticle {
    width: 28px;
    height: 28px;
    border: 2px solid #4ADE80;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    animation: reticlePulse 1s ease-in-out infinite alternate;
  }
  @keyframes reticlePulse {
    0% { transform: scale(1); opacity: 0.8; }
    100% { transform: scale(1.3); opacity: 1; }
  }
  .crosshair-dot {
    width: 6px;
    height: 6px;
    background: #4ADE80;
    border-radius: 50%;
  }
  .crosshair-label {
    background: #181816;
    color: #4ADE80;
    border: 1px solid #4ADE80;
    padding: 3px 8px;
    border-radius: 3px;
    font-size: 12px;
    font-weight: 800;
  }

  /* Giant Red Hardware Stamp Slam at 1.2s */
  .red-stamp-overlay {
    position: absolute;
    inset: 40px;
    background: rgba(224, 82, 70, 0.94);
    border: 6px solid #FFFFFF;
    border-radius: 12px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    padding: 30px;
    color: #FFFFFF;
    box-shadow: 0 25px 80px rgba(0,0,0,0.6);
    opacity: 0;
    transform: scale(2.2) rotate(-3deg);
    z-index: 100;
  }
  body.playing .red-stamp-overlay {
    animation: stampSlam 0.28s cubic-bezier(0.12, 0.9, 0.2, 1.25) 1.2s forwards;
  }
  @keyframes stampSlam {
    0% { opacity: 0; transform: scale(2.2) rotate(-3deg); }
    100% { opacity: 1; transform: scale(1) rotate(-1deg); }
  }
  .stamp-super {
    font-size: 16px;
    font-weight: 900;
    letter-spacing: 0.2em;
    background: #FFFFFF;
    color: #E05246;
    padding: 4px 16px;
    border-radius: 4px;
    margin-bottom: 16px;
  }
  .stamp-main-metric {
    font-size: 44px;
    font-weight: 900;
    line-height: 1.1;
    letter-spacing: -0.02em;
    margin-bottom: 12px;
  }
  .stamp-sub-msg {
    font-size: 18px;
    font-weight: 800;
    letter-spacing: 0.05em;
    opacity: 0.95;
  }

  /* Right Panel: Sticky Cart Drawer & SAM 3.1 Pixel loss */
  .cart-drawer-slider {
    position: absolute;
    left: 40px;
    right: 40px;
    bottom: -160px; /* starts hidden */
    height: 240px;
    background: #181816;
    border-top: 3px solid #33322E;
    border-radius: 8px 8px 0 0;
    box-shadow: 0 -15px 40px rgba(0,0,0,0.5);
    display: flex;
    flex-direction: column;
    padding: 16px 24px;
  }
  body.playing .cart-drawer-slider {
    animation: drawerSlideUp 1.2s cubic-bezier(0.2, 0.8, 0.25, 1) 0.2s forwards;
  }
  @keyframes drawerSlideUp {
    0% { bottom: -160px; }
    100% { bottom: 0px; } /* Slices 9.6% off the bottom of checkout button */
  }

  .drawer-bar-title {
    color: #F5F3EF;
    font-size: 16px;
    font-weight: 800;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .drawer-subtotal { color: #38BDF8; }

  /* Red Diagonal Occlusion Hatch over Clipped Area */
  .occlusion-hatch-strip {
    position: absolute;
    width: 660px;
    height: 26px; /* Exact 9.6% slice */
    top: 50%;
    margin-top: 16px;
    background: rgba(224, 82, 70, 0.4);
    border: 2px dashed #E05246;
    border-radius: 0 0 8px 8px;
    background-image: repeating-linear-gradient(
      45deg,
      rgba(224, 82, 70, 0.8),
      rgba(224, 82, 70, 0.8) 8px,
      rgba(224, 82, 70, 0.2) 8px,
      rgba(224, 82, 70, 0.2) 16px
    );
    opacity: 0;
  }
  body.playing .occlusion-hatch-strip {
    animation: fadeIn 0.2s ease-out 1.4s forwards;
  }

  /* Live Pixel Counter Readout Card */
  .pixel-loss-counter-card {
    margin-top: 20px;
    background: #EAE7DF;
    border: 2px solid #E05246;
    border-radius: 6px;
    padding: 16px 20px;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .pixel-readout {
    font-size: 34px;
    font-weight: 900;
    color: #E05246;
    letter-spacing: -0.03em;
  }
  .loss-pill {
    background: #E05246;
    color: #FFFFFF;
    font-size: 15px;
    font-weight: 800;
    padding: 6px 14px;
    border-radius: 4px;
  }

  /* ========================================================
     SCENE 2 (3.8s – 7.8s): Dual-Instrument 3D Telemetry
     ======================================================== */
  body.playing .scene-2 {
    animation: scene2Master 4.0s cubic-bezier(0.16, 1, 0.3, 1) 3.8s forwards;
  }
  @keyframes scene2Master {
    0% { opacity: 0; transform: perspective(1200px) rotateX(8deg) scale(1.05); }
    10% { opacity: 1; transform: perspective(1200px) rotateX(0deg) scale(1.0); }
    92% { opacity: 1; transform: scale(1.0); filter: blur(0px); }
    100% { opacity: 0; transform: scale(0.96); filter: blur(6px); }
  }

  .scene-2-container {
    position: absolute;
    inset: 0;
    padding: 30px 40px;
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 28px;
  }
  .bento-macro-card {
    background: #DFDCD3;
    border: 2px solid #181816;
    border-radius: 8px;
    padding: 24px;
    display: flex;
    flex-direction: column;
    box-shadow: 0 15px 40px rgba(0,0,0,0.12);
  }
  .card-top-title {
    font-size: 13px;
    font-weight: 800;
    letter-spacing: 0.1em;
    color: #4A4843;
    margin-bottom: 6px;
    text-transform: uppercase;
  }
  .card-hero-num {
    font-size: 46px;
    font-weight: 900;
    letter-spacing: -0.03em;
    color: #181816;
    margin-bottom: 16px;
    line-height: 1;
  }

  /* 8-Frame Bar Chart */
  .frame-bars-wrap {
    display: flex;
    align-items: flex-end;
    gap: 10px;
    height: 180px;
    background: #D6D3C9;
    padding: 16px 12px;
    border-radius: 6px;
    border: 1px solid #B8B4A9;
    margin-bottom: 16px;
  }
  .bar-col {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    height: 100%;
    justify-content: flex-end;
  }
  .bar-rect {
    width: 100%;
    border-radius: 3px;
    background: #2E7D52;
    transition: height 0.3s ease;
  }
  .bar-rect.drop { background: #E05246; }
  .bar-label { font-size: 11px; font-weight: 700; color: #4A4843; }

  /* Instrument B 14-Segment LED Meter */
  .led-meter-box {
    display: grid;
    grid-template-columns: repeat(14, 1fr);
    gap: 4px;
    background: #181816;
    padding: 14px 10px;
    border-radius: 6px;
    margin-bottom: 20px;
  }
  .led-segment {
    height: 48px;
    background: #33322E;
    border-radius: 2px;
  }
  .led-segment.lit-green { background: #2E7D52; box-shadow: 0 0 8px #2E7D52; }
  .led-segment.lit-orange { background: #F59E0B; box-shadow: 0 0 8px #F59E0B; }
  .led-segment.lit-red { background: #E05246; box-shadow: 0 0 8px #E05246; }

  /* Decision Tree Rows */
  .decision-step-row {
    background: #EAE7DF;
    border: 1px solid #B8B4A9;
    border-radius: 6px;
    padding: 12px 14px;
    font-size: 13px;
    font-weight: 700;
    margin-bottom: 10px;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .decision-step-row.ok { border-left: 4px solid #2E7D52; }
  .decision-step-row.reject { border-left: 4px solid #E05246; }

  .reject-stamp-badge {
    margin-top: auto;
    background: #E05246;
    color: #FFFFFF;
    font-size: 16px;
    font-weight: 900;
    text-align: center;
    padding: 14px;
    border-radius: 6px;
    letter-spacing: 0.05em;
    box-shadow: 0 8px 25px rgba(224, 82, 70, 0.4);
  }

  /* ========================================================
     SCENE 3 (7.8s – 12.2s): Autonomous Repair & Split Curtain
     ======================================================== */
  body.playing .scene-3 {
    animation: scene3Master 4.4s cubic-bezier(0.16, 1, 0.3, 1) 7.8s forwards;
  }
  @keyframes scene3Master {
    0% { opacity: 0; transform: translateY(20px); }
    8% { opacity: 1; transform: translateY(0); }
    92% { opacity: 1; transform: scale(1.0); filter: blur(0px); }
    100% { opacity: 0; transform: scale(0.96); filter: blur(6px); }
  }

  .scene-3-container {
    position: absolute;
    inset: 0;
    padding: 24px 40px;
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  /* Code Diff Editor */
  .code-diff-card {
    background: #181816;
    color: #F5F3EF;
    border-radius: 8px;
    border: 2px solid #33322E;
    box-shadow: 0 10px 30px rgba(0,0,0,0.3);
    overflow: hidden;
  }
  .code-editor-top {
    background: #252422;
    padding: 10px 18px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    border-bottom: 1px solid #33322E;
  }
  .code-title {
    font-size: 13px;
    font-weight: 800;
    color: #38BDF8;
    letter-spacing: 0.05em;
  }
  .code-dots {
    display: flex;
    gap: 6px;
  }
  .code-dot { width: 10px; height: 10px; border-radius: 50%; }
  .dot-red { background: #EF4444; }
  .dot-yellow { background: #F59E0B; }
  .dot-green { background: #10B981; }

  .code-lines-body {
    padding: 16px 20px;
    font-size: 16px;
    line-height: 1.6;
  }
  .diff-del {
    color: #FF7B70;
    background: rgba(224, 82, 70, 0.15);
    padding: 2px 8px;
    border-radius: 3px;
    display: block;
    margin-bottom: 4px;
  }
  .diff-add {
    color: #4ADE80;
    background: rgba(46, 125, 82, 0.25);
    padding: 2px 8px;
    border-radius: 3px;
    display: block;
    font-weight: 700;
  }

  /* 300% Zoomed Macro Split Curtain Viewport */
  .macro-split-canvas {
    flex: 1;
    background: #DFDCD3;
    border: 2px solid #181816;
    border-radius: 8px;
    position: relative;
    overflow: hidden;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 15px 40px rgba(0,0,0,0.15);
  }

  /* Full Button Container in Macro View */
  .macro-button-container {
    position: relative;
    width: 1400px;
    height: 180px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  /* Layer 1: Left Broken Button (Occluded) */
  .layer-broken-btn {
    position: absolute;
    width: 1320px;
    height: 130px;
    background: #181816;
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 24px;
    color: #FFFFFF;
    font-size: 38px;
    font-weight: 900;
    overflow: hidden;
  }
  .broken-hatch-overlay {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    height: 38px; /* 9.6% */
    background: repeating-linear-gradient(
      45deg,
      rgba(224, 82, 70, 0.85),
      rgba(224, 82, 70, 0.85) 12px,
      rgba(224, 82, 70, 0.3) 12px,
      rgba(224, 82, 70, 0.3) 24px
    );
    border-top: 2px dashed #E05246;
  }

  /* Layer 2: Right Repaired Button (100% Restored) */
  .layer-repaired-clip {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    clip-path: inset(0 0 0 50%); /* Dynamic wipe */
  }
  body.playing .layer-repaired-clip {
    animation: splitWipeClip 3.4s cubic-bezier(0.4, 0, 0.2, 1) 8.2s forwards;
  }
  @keyframes splitWipeClip {
    0% { clip-path: inset(0 0 0 15%); }
    55% { clip-path: inset(0 0 0 85%); }
    100% { clip-path: inset(0 0 0 50%); }
  }

  .layer-repaired-btn {
    width: 1320px;
    height: 130px;
    background: #181816;
    border: 3px solid #2E7D52;
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 24px;
    color: #FFFFFF;
    font-size: 38px;
    font-weight: 900;
    box-shadow: 0 0 40px rgba(46, 125, 82, 0.3);
  }

  /* Animated Optical Curtain Divider Line */
  .curtain-divider-line {
    position: absolute;
    top: 0;
    bottom: 0;
    left: 50%;
    width: 4px;
    background: #38BDF8;
    box-shadow: 0 0 15px #38BDF8, 0 0 35px rgba(56, 189, 248, 0.9);
    z-index: 50;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  body.playing .curtain-divider-line {
    animation: splitWipeLine 3.4s cubic-bezier(0.4, 0, 0.2, 1) 8.2s forwards;
  }
  @keyframes splitWipeLine {
    0% { left: 15%; }
    55% { left: 85%; }
    100% { left: 50%; }
  }

  .curtain-handle-knob {
    position: absolute;
    background: #181816;
    border: 2px solid #38BDF8;
    color: #38BDF8;
    padding: 8px 18px;
    border-radius: 4px;
    font-size: 16px;
    font-weight: 900;
    white-space: nowrap;
    box-shadow: 0 8px 25px rgba(0,0,0,0.6);
  }

  /* Dynamic Badges on Curtain */
  .badge-curtain-left {
    position: absolute;
    top: 24px;
    left: 40px;
    background: rgba(24, 24, 22, 0.94);
    border: 2px solid #E05246;
    color: #FF7B70;
    padding: 10px 18px;
    border-radius: 6px;
    font-size: 16px;
    font-weight: 900;
  }
  .badge-curtain-right {
    position: absolute;
    top: 24px;
    right: 40px;
    background: rgba(24, 24, 22, 0.94);
    border: 2px solid #2E7D52;
    color: #4ADE80;
    padding: 10px 18px;
    border-radius: 6px;
    font-size: 16px;
    font-weight: 900;
  }

  /* ========================================================
     SCENE 4 (12.2s – 16.0s): Flagship Bento Scoreboard
     ======================================================== */
  body.playing .scene-4 {
    animation: scene4Master 3.8s cubic-bezier(0.16, 1, 0.3, 1) 12.2s forwards;
  }
  @keyframes scene4Master {
    0% { opacity: 0; transform: scale(1.06); }
    8% { opacity: 1; transform: scale(1); }
    100% { opacity: 1; transform: scale(1); }
  }

  .scene-4-container {
    position: absolute;
    inset: 0;
    padding: 30px 40px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .bento-flagship-card {
    width: 1600px;
    background: #EAE7DF;
    border: 2px solid #181816;
    border-radius: 12px;
    padding: 40px 50px;
    display: flex;
    flex-direction: column;
    gap: 28px;
    box-shadow: 0 30px 90px rgba(0,0,0,0.25);
  }

  .bento-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 2px solid #181816;
    padding-bottom: 20px;
  }
  .bento-logo-title {
    font-size: 36px;
    font-weight: 900;
    letter-spacing: -0.02em;
    display: flex;
    align-items: baseline;
    gap: 14px;
  }
  .bento-tag {
    font-size: 15px;
    font-weight: 800;
    background: #181816;
    color: #EAE7DF;
    padding: 4px 10px;
    border-radius: 4px;
  }
  .bento-system-status {
    background: #DCE8DF;
    border: 1.5px solid #2E7D52;
    color: #1D4D35;
    padding: 8px 16px;
    border-radius: 6px;
    font-size: 14px;
    font-weight: 800;
    letter-spacing: 0.05em;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  /* 3 Hero Stat Pillars */
  .hero-pillars-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 24px;
  }
  .hero-stat-card {
    background: #DFDCD3;
    border: 2px solid #B8B4A9;
    border-radius: 8px;
    padding: 24px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .hero-stat-card.emerald-highlight {
    background: #DCE8DF;
    border: 2px solid #2E7D52;
    box-shadow: 0 10px 30px rgba(46, 125, 82, 0.2);
  }
  .stat-card-label {
    font-size: 13px;
    font-weight: 800;
    letter-spacing: 0.1em;
    color: #4A4843;
    text-transform: uppercase;
  }
  .stat-card-val {
    font-size: 68px;
    font-weight: 900;
    letter-spacing: -0.04em;
    line-height: 1;
    color: #181816;
  }
  .stat-card-val.green { color: #2E7D52; }
  .stat-card-sub {
    font-size: 14px;
    font-weight: 700;
    color: #78756E;
  }

  /* Engine Bar */
  .engine-models-bar {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 20px;
  }
  .model-pill {
    background: #D6D3C9;
    border: 1px solid #B8B4A9;
    border-radius: 6px;
    padding: 14px 18px;
  }
  .model-name {
    font-size: 15px;
    font-weight: 900;
    color: #181816;
    margin-bottom: 4px;
  }
  .model-role {
    font-size: 12px;
    font-weight: 600;
    color: #4A4843;
  }

  /* Bottom Launch Banner */
  .bottom-launch-bar {
    background: #181816;
    color: #EAE7DF;
    border-radius: 8px;
    padding: 16px 24px;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .tools-row {
    display: flex;
    gap: 16px;
    font-size: 13px;
    font-weight: 800;
  }
  .tool-item.highlight { color: #38BDF8; }
  .live-cta-url {
    font-size: 16px;
    font-weight: 900;
    color: #38BDF8;
    letter-spacing: 0.05em;
  }

  /* Final Tagline Slam at 13.8s */
  .final-tagline-slam {
    background: #181816;
    color: #FFFFFF;
    font-size: 34px;
    font-weight: 900;
    text-align: center;
    padding: 18px;
    border-radius: 8px;
    letter-spacing: 0.02em;
    opacity: 0;
    transform: scale(0.92);
  }
  body.playing .final-tagline-slam {
    animation: slamFinalTagline 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.25) 13.8s forwards;
  }
  @keyframes slamFinalTagline {
    0% { opacity: 0; transform: scale(0.92); }
    100% { opacity: 1; transform: scale(1); }
  }
  .tagline-dot { color: #E05246; }
</style>
</head>
<body>
  <div class="stage">
    <!-- Global Swiss Top Header Bar -->
    <div class="global-top-bar">
      <div class="brand-group">
        <span class="brand-led"></span>
        <span class="brand-name">SPECTRA V3.0</span>
        <span class="brand-sub">// SWISS INDUSTRIAL REFEREE</span>
      </div>
      <div class="global-title">WHY AI CODING AGENTS BREAK YOUR UI</div>
      <div class="global-meta">60FPS DETERMINISTIC MACRO EVAL</div>
    </div>

    <!-- ========================================================
         SCENE 1: The Lie vs. Reality (Frame 0 Visible!)
         ======================================================== -->
    <div class="scene scene-1">
      <!-- Left Panel: What Playwright & VLMs See -->
      <div class="panel-half">
        <div class="panel-header-tab">
          <div class="panel-tab-title">
            <span>●</span> WHAT PLAYWRIGHT & VLMs SEE
          </div>
          <span class="panel-badge-soft badge-lie">THE LIE</span>
        </div>

        <div class="terminal-box">
          <div><span class="term-cmd">$</span> agent-eval checkout-flow --strict</div>
          <div><span class="term-pass">✓</span> document.querySelector("#checkout-btn") !== null</div>
          <div><span class="term-pass">✓</span> elementFromPoint(1080, 625) → #checkout-btn (PASS)</div>
          <div><span class="term-pass">✓</span> VLM Judge: "Button is fully visible on screen"</div>
          <div class="term-info">STATUS: ALL 3 TESTS PASSED (100%)</div>
        </div>

        <div class="macro-viewport-card">
          <div class="macro-checkout-btn">
            <span>🛒 Complete Checkout</span>
            <span class="macro-btn-price">$149.00</span>
          </div>

          <!-- Pulsing green center dot -->
          <div class="crosshair-point">
            <div class="crosshair-reticle">
              <div class="crosshair-dot"></div>
            </div>
            <div class="crosshair-label">elementFromPoint(1080, 625) [PASS]</div>
          </div>
        </div>

        <!-- Giant Red Stamp Slam at 1.2s -->
        <div class="red-stamp-overlay">
          <div class="stamp-super">CRITICAL REALITY GAP DETECTED</div>
          <div class="stamp-main-metric">94.4% DOM FALSE-PASS<br>61.1% VLM FALSE-PASS</div>
          <div class="stamp-sub-msg">UNCLICKABLE & INVISIBLE TO USERS</div>
        </div>
      </div>

      <!-- Right Panel: What Users Actually See -->
      <div class="panel-half">
        <div class="panel-header-tab">
          <div class="panel-tab-title">
            <span>●</span> WHAT USERS ACTUALLY SEE
          </div>
          <span class="panel-badge-soft badge-reality">SPECTRA REFEREE</span>
        </div>

        <div class="macro-viewport-card">
          <div class="macro-checkout-btn">
            <span>🛒 Complete Checkout</span>
            <span class="macro-btn-price">$149.00</span>
          </div>

          <!-- Animated Red Hatch Strip on the bottom 9.6% -->
          <div class="occlusion-hatch-strip"></div>

          <!-- Sticky Cart Drawer Sliding Up at 0.2s -->
          <div class="cart-drawer-slider">
            <div class="drawer-bar-title">
              <span>▲ YOUR CART (3 ITEMS)</span>
              <span class="drawer-subtotal">SUBTOTAL: $149.00</span>
            </div>
          </div>
        </div>

        <div class="pixel-loss-counter-card">
          <div>
            <div style="font-size: 11px; font-weight: 800; color: #78756E; text-transform: uppercase;">SAM 3.1 OPTICAL LOSS DETECTED</div>
            <div class="pixel-readout">17,299 px → 15,708 px</div>
          </div>
          <div class="loss-pill">-9.60% LOSS CAUGHT</div>
        </div>
      </div>
    </div>

    <!-- ========================================================
         SCENE 2: Dual-Instrument 3D Hardware Telemetry
         ======================================================== -->
    <div class="scene scene-2">
      <div class="scene-2-container">
        <!-- Instrument A: SAM 3.1 Bar Chart -->
        <div class="bento-macro-card">
          <div class="card-top-title">INSTRUMENT A — META SAM 3.1</div>
          <div class="card-hero-num">R_SAM = 90.80%</div>

          <div class="frame-bars-wrap">
            <div class="bar-col"><div class="bar-rect" style="height: 100%;"></div><span class="bar-label">t_0</span></div>
            <div class="bar-col"><div class="bar-rect" style="height: 100%;"></div><span class="bar-label">t_1</span></div>
            <div class="bar-col"><div class="bar-rect" style="height: 100%;"></div><span class="bar-label">t_2</span></div>
            <div class="bar-col"><div class="bar-rect" style="height: 98%;"></div><span class="bar-label">t_3</span></div>
            <div class="bar-col"><div class="bar-rect" style="height: 94%;"></div><span class="bar-label">t_4</span></div>
            <div class="bar-col"><div class="bar-rect drop" style="height: 90.8%;"></div><span class="bar-label">t_5</span></div>
            <div class="bar-col"><div class="bar-rect drop" style="height: 90.8%;"></div><span class="bar-label">t_6</span></div>
            <div class="bar-col"><div class="bar-rect drop" style="height: 90.8%;"></div><span class="bar-label">t_7</span></div>
          </div>

          <div style="font-size: 13px; font-weight: 700; color: #4A4843;">
            8-FRAME TEMPORAL VIDEO TRACKING<br>
            <span style="color: #E05246; font-weight: 800;">-9.20% PIXEL LOSS ON CLIP tk</span>
          </div>
        </div>

        <!-- Instrument B: NCC Template Match -->
        <div class="bento-macro-card">
          <div class="card-top-title">INSTRUMENT B — TEMPLATE NCC</div>
          <div class="card-hero-num">visRatio = 90.00%</div>

          <div class="led-meter-box">
            <div class="led-segment lit-green"></div>
            <div class="led-segment lit-green"></div>
            <div class="led-segment lit-green"></div>
            <div class="led-segment lit-green"></div>
            <div class="led-segment lit-green"></div>
            <div class="led-segment lit-green"></div>
            <div class="led-segment lit-green"></div>
            <div class="led-segment lit-green"></div>
            <div class="led-segment lit-green"></div>
            <div class="led-segment lit-green"></div>
            <div class="led-segment lit-green"></div>
            <div class="led-segment lit-orange"></div>
            <div class="led-segment lit-red"></div>
            <div class="led-segment"></div>
          </div>

          <div style="font-size: 13px; font-weight: 700; color: #4A4843; line-height: 1.5;">
            NCC MATCH COEFFICIENT: 0.941<br>
            ZERO-API SPEND / OFFLINE RUNTIME<br>
            <span style="color: #2E7D52; font-weight: 800;">INDEPENDENT INSTRUMENT CONFIRMATION</span>
          </div>
        </div>

        <!-- Rule 2 Decision Tree -->
        <div class="bento-macro-card">
          <div class="card-top-title">RULE 2 CALIBRATED DECISION TREE</div>
          <div class="card-hero-num" style="color: #E05246;">VERDICT: FAIL</div>

          <div class="decision-step-row ok">
            <span>Agreement |90.8% - 90.0%| = 0.8%</span>
            <span style="color: #2E7D52;">≤ 4.10% (δ) ✓</span>
          </div>
          <div class="decision-step-row reject">
            <span>Noise-Floor Loss: 9.60%</span>
            <span style="color: #E05246;">> 1.35% (3σ) ✗</span>
          </div>
          <div class="decision-step-row ok">
            <span>Safety Refusal Contract</span>
            <span style="color: #2E7D52;">Active ✓</span>
          </div>

          <div class="reject-stamp-badge">
            RULE_3_THREE_SIGMA_OCCLUSION_REJECT
          </div>
        </div>
      </div>
    </div>

    <!-- ========================================================
         SCENE 3: Autonomous Repair & Split Curtain
         ======================================================== -->
    <div class="scene scene-3">
      <div class="scene-3-container">
        <!-- Top Half: Code Diff -->
        <div class="code-diff-card">
          <div class="code-editor-top">
            <span class="code-title">MUSE SPARK OPEN 1026 (BASETEN) — CLOSED-LOOP CSS REPAIR</span>
            <div class="code-dots">
              <span class="code-dot dot-red"></span>
              <span class="code-dot dot-yellow"></span>
              <span class="code-dot dot-green"></span>
            </div>
          </div>
          <div class="code-lines-body">
            <span class="diff-del">- .cart-drawer-footer { margin-top: -14px; height: 124px; }</span>
            <span class="diff-add">+ .cart-drawer-footer { margin-top: 0px;   height: 110px; } /* Restores 1,591 occluded px */</span>
          </div>
        </div>

        <!-- Bottom Half: Giant 300% Macro Split Viewport -->
        <div class="macro-split-canvas">
          <div class="badge-curtain-left">◀ PASS #1: BROKEN (9.6% CLIPPED) · FAIL</div>
          <div class="badge-curtain-right">PASS #2: REPAIRED (0.00% LOSS · 17,299 PX) ▶ · PASS</div>

          <div class="macro-button-container">
            <!-- Left Broken Button -->
            <div class="layer-broken-btn">
              <span>🛒 Complete Checkout</span>
              <span style="background: #2E7D52; padding: 6px 16px; border-radius: 6px; font-size: 32px;">$149.00</span>
              <div class="broken-hatch-overlay"></div>
            </div>

            <!-- Right Repaired Button -->
            <div class="layer-repaired-clip">
              <div class="layer-repaired-btn">
                <span>🛒 Complete Checkout</span>
                <span style="background: #2E7D52; padding: 6px 16px; border-radius: 6px; font-size: 32px;">$149.00</span>
              </div>
            </div>

            <!-- Optical Curtain Divider Line -->
            <div class="curtain-divider-line">
              <div class="curtain-handle-knob">⇄ 82.4% SPLIT</div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ========================================================
         SCENE 4: Flagship Bento Scoreboard & Launch Card
         ======================================================== -->
    <div class="scene scene-4">
      <div class="scene-4-container">
        <div class="bento-flagship-card">
          <div class="bento-header">
            <div class="bento-logo-title">
              <span>SPECTRA</span>
              <span class="bento-tag">V3.0</span>
              <span style="font-size: 18px; color: #4A4843; font-weight: 700;">AUTONOMOUS VISUAL INVARIANT REFEREE</span>
            </div>
            <div class="bento-system-status">
              <span>●</span> CLOSED-LOOP SYSTEM VERIFIED
            </div>
          </div>

          <div class="hero-pillars-grid">
            <div class="hero-stat-card emerald-highlight">
              <div class="stat-card-label">FALSE-PASS RATE</div>
              <div class="stat-card-val green">0.0%</div>
              <div class="stat-card-sub">18 / 18 Occluded Clips Caught vs 94.4% DOM</div>
            </div>
            <div class="hero-stat-card">
              <div class="stat-card-label">ACCURACY (MAE)</div>
              <div class="stat-card-val">1.11%</div>
              <div class="stat-card-sub">Empirical Noise-Floor 3σ = 1.35% · δ = 4.10%</div>
            </div>
            <div class="hero-stat-card">
              <div class="stat-card-label">REFEREE LATENCY</div>
              <div class="stat-card-val">~480ms</div>
              <div class="stat-card-sub">8 frames @ 4FPS · Zero API Spend Cached</div>
            </div>
          </div>

          <div class="engine-models-bar">
            <div class="model-pill">
              <div class="model-name">META SAM 3.1</div>
              <div class="model-role">Zero-Shot Video Mask Segmentation</div>
            </div>
            <div class="model-pill">
              <div class="model-name">MUSE SPARK 1.3</div>
              <div class="model-role">Visual Invariant Compiler & Referee</div>
            </div>
            <div class="model-pill">
              <div class="model-name">MUSE VOICE 1.0</div>
              <div class="model-role">Natural Voice Directive Ingest</div>
            </div>
          </div>

          <div class="bottom-launch-bar">
            <div class="tools-row">
              <span class="tool-item highlight">CLI</span>
              <span>·</span>
              <span class="tool-item highlight">4-TOOL MCP SERVER</span>
              <span>·</span>
              <span class="tool-item">CLAUDE CODE</span>
              <span>·</span>
              <span class="tool-item">CURSOR</span>
              <span>·</span>
              <span class="tool-item">MUSE CODE</span>
            </div>
            <div class="live-cta-url">spectra-lyart.vercel.app</div>
          </div>

          <div class="final-tagline-slam">
            "DON'T TRUST 'DONE.' MEASURE IT<span class="tagline-dot">.</span>"
          </div>
        </div>
      </div>
    </div>
  </div>
</body>
</html>`;
}

// -------------------------------------------------------------
// Step 2: Main Execution Orchestrator
// -------------------------------------------------------------
async function main() {
  console.log('=== SPECTRA V3.0 MACRO LAUNCH VIDEO GENERATOR (60FPS) ===');

  // 1. Synthesize tactile audio soundtrack first
  synthesizeTactileAudio(audioWavPath, 16.0);

  // 2. Prepare HTML macro choreography
  console.log('[Motion Graphics] Building 100% vector macro HTML components (zero screenshots)...');
  const htmlContent = buildMacroVectorHtml();
  const htmlFilePath = path.join(tmpDir, 'viral-teaser.html');
  fs.writeFileSync(htmlFilePath, htmlContent);

  // 3. Launch Playwright Chromium at 1920x1080
  console.log('[Recorder] Launching Playwright Chromium (1920x1080) for 16.0s deterministic capture...');
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
  await page.waitForTimeout(500); // browser compositor warm up

  console.log('[Recorder] Starting animation (.playing) for 16.0 seconds...');
  await page.evaluate(() => document.body.classList.add('playing'));
  await page.waitForTimeout(16000); // capture 16.0 seconds

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
  console.log('[Muxer] Muxing video and tactile audio via ffmpeg...');
  const ffmpegCmd = ffmpegPath;
  const ffmpegArgs = [
    '-y',
    '-ss', '0.5', // seek video past initial 500ms warm-up
    '-i', rawWebmPath,
    '-i', audioWavPath,
    '-map', '0:v:0',
    '-map', '1:a:0',
    '-c:v', 'libx264',
    '-pix_fmt', 'yuv420p',
    '-preset', 'medium',
    '-crf', '18',
    '-r', '60', // 60 FPS output
    '-c:a', 'aac',
    '-b:a', '192k',
    '-t', '16.0', // guarantee exact 16.0s duration
    '-shortest',
    outputTeaserPath,
  ];

  const convResult = spawnSync(ffmpegCmd, ffmpegArgs, { stdio: 'inherit' });
  if (convResult.status !== 0) {
    throw new Error(`ffmpeg muxing failed with status: ${convResult.status}`);
  }

  // Also create spectra-x-viral.mp4 copy so both files exist at repo root
  fs.copyFileSync(outputTeaserPath, outputViralPath);
  console.log(`[Muxer] Copied output to: ${outputViralPath}`);

  // 5. Verify output file with ffprobe
  console.log('[Verification] Probing output video via ffprobe...');
  const ffprobePath = ffprobeStatic.path;
  const probeResult = spawnSync(ffprobePath, [
    '-v', 'error',
    '-show_entries', 'format=duration,size:stream=index,codec_type,codec_name,width,height,channels,r_frame_rate',
    '-of', 'json',
    outputTeaserPath,
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

  if (duration < 15.0 || duration > 17.0) {
    throw new Error(`Duration outside target [15s, 17s]: ${duration}s`);
  }

  console.log('\n======================================================');
  console.log('🎉 SUCCESS: SPECTRA 60FPS MACRO VIDEO READY!');
  console.log(`Paths:    ${outputTeaserPath}`);
  console.log(`          ${outputViralPath}`);
  console.log(`Duration: ${duration.toFixed(2)}s`);
  console.log(`Size:     ${(size / 1024 / 1024).toFixed(2)} MB`);
  console.log(`Video:    ${videoStream.codec_name} 1920x1080 @ ${videoStream.r_frame_rate} (1080p60)`);
  console.log(`Audio:    ${audioStream.codec_name} Stereo 44.1kHz (Tactile mechanical foley & sub-drops)`);
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
  console.error('[Macro Video Generator Error]', err);
  process.exit(1);
});
