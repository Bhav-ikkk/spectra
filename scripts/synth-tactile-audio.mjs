import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const demoRecordingsDir = path.join(rootDir, 'demo-recordings');
const outputWavPath = path.join(demoRecordingsDir, 'tactile-soundtrack.wav');

if (!fs.existsSync(demoRecordingsDir)) {
  fs.mkdirSync(demoRecordingsDir, { recursive: true });
}

export function synthesizeTactileAudio(outputPath = outputWavPath, durationSeconds = 16.0, sampleRate = 44100) {
  console.log(`[Tactile Audio] Synthesizing ${durationSeconds}s 44.1kHz 16-bit stereo mechanical soundtrack...`);
  const numFrames = Math.floor(sampleRate * durationSeconds);
  const left = new Float32Array(numFrames);
  const right = new Float32Array(numFrames);

  const add = (channel, idx, val) => {
    if (idx >= 0 && idx < numFrames) {
      channel[idx] += val;
    }
  };

  // -------------------------------------------------------------
  // 1. Warm Background Sub-Drone (0.0s – 16.0s)
  // Low-pass filtered warm analog pad (110Hz + 164.81Hz) at 280Hz cutoff
  // -------------------------------------------------------------
  const droneCutoff = 280;
  const droneRc = 1 / (2 * Math.PI * droneCutoff);
  const droneDt = 1 / sampleRate;
  const droneAlpha = droneDt / (droneRc + droneDt);
  let lpL1 = 0, lpL2 = 0, lpR1 = 0, lpR2 = 0;

  for (let i = 0; i < numFrames; i++) {
    const t = i / sampleRate;
    // Frequencies: 110Hz (A2), 164.81Hz (E3), with slow detune drift
    const f1L = 110.0 + 0.25 * Math.sin(0.4 * t);
    const f1R = 110.0 - 0.25 * Math.sin(0.4 * t);
    const f2L = 164.81 + 0.3 * Math.cos(0.5 * t);
    const f2R = 164.81 - 0.3 * Math.cos(0.5 * t);

    // Warm triangle/saw shape
    const tri1L = 2 * Math.abs(2 * ((t * f1L) % 1) - 1) - 1;
    const tri1R = 2 * Math.abs(2 * ((t * f1R) % 1) - 1) - 1;
    const tri2L = 2 * Math.abs(2 * ((t * f2L) % 1) - 1) - 1;
    const tri2R = 2 * Math.abs(2 * ((t * f2R) % 1) - 1) - 1;

    const rawL = (tri1L * 0.65 + tri2L * 0.35) * 0.12;
    const rawR = (tri1R * 0.65 + tri2R * 0.35) * 0.12;

    // 2-pole low-pass filter
    lpL1 += droneAlpha * (rawL - lpL1);
    lpL2 += droneAlpha * (lpL1 - lpL2);
    lpR1 += droneAlpha * (rawR - lpR1);
    lpR2 += droneAlpha * (lpR1 - lpR2);

    // Room air subtle pink noise
    const airL = (Math.random() * 2 - 1) * 0.003;
    const airR = (Math.random() * 2 - 1) * 0.003;

    left[i] += lpL2 + airL;
    right[i] += lpR2 + airR;
  }

  // -------------------------------------------------------------
  // 2. Tactile Mechanical Keycap / Leica Shutter Clicks
  // 6ms bandpass noise burst + 12ms woody mechanical thud
  // -------------------------------------------------------------
  function addMechanicalClick(timeSec, pan = 0.0, pitch = 1.0, gain = 1.0) {
    const startIdx = Math.floor(timeSec * sampleRate);
    const clickFrames = Math.floor(0.024 * sampleRate); // 24ms total

    for (let n = 0; n < clickFrames; n++) {
      const tau = n / sampleRate;
      const idx = startIdx + n;

      // 6ms noise burst with 0.3ms attack
      const attack = tau < 0.0003 ? tau / 0.0003 : Math.exp(-650 * (tau - 0.0003));
      // Bandpass noise around 2400Hz
      const noise = (Math.random() * 2 - 1) * attack * 0.42;

      // 12ms woody thud (140Hz -> 60Hz pitch envelope)
      const thudFreq = (60 + 80 * Math.exp(-250 * tau)) * pitch;
      const thud = Math.sin(2 * Math.PI * thudFreq * tau) * Math.exp(-190 * tau) * 0.35;

      // High metallic latch tick
      const latch = Math.sin(2 * Math.PI * (2800 * pitch) * tau) * Math.exp(-400 * tau) * 0.22;

      const sample = (noise + thud + latch) * gain;
      const panL = (1 - pan) * 0.5;
      const panR = (1 + pan) * 0.5;

      add(left, idx, sample * panL * 2);
      add(right, idx, sample * panR * 2);
    }
  }

  // -------------------------------------------------------------
  // 3. Deep Cinematic Sub-Bass Impact Drops
  // Pitch-swept 95Hz -> 38Hz over 450ms with soft saturation
  // -------------------------------------------------------------
  function addSubDrop(timeSec, gain = 0.55) {
    const startIdx = Math.floor(timeSec * sampleRate);
    const dropFrames = Math.floor(0.65 * sampleRate);

    for (let n = 0; n < dropFrames; n++) {
      const tau = n / sampleRate;
      const idx = startIdx + n;
      // Frequency drops exponentially from 95Hz down to 38Hz
      const f = 38 + 57 * Math.exp(-7.5 * tau);
      // Phase integral
      const phase = 2 * Math.PI * (38 * tau + (57 / -7.5) * (Math.exp(-7.5 * tau) - 1));
      const env = Math.exp(-4.2 * tau);
      const raw = Math.sin(phase) * env * gain;
      // Soft saturation for sub punch
      const sub = Math.tanh(raw * 1.3) * 0.9;
      // Upper sub harmonic (76Hz)
      const sub2 = Math.sin(phase * 2) * env * 0.22;

      add(left, idx, sub + sub2);
      add(right, idx, sub + sub2);
    }
  }

  // -------------------------------------------------------------
  // 4. Optical Laser Scan Whoosh (8.2s – 11.5s)
  // Resonant bandpass filter sweeping across stereo field
  // -------------------------------------------------------------
  function addLaserScanWhoosh(startSec = 8.2, endSec = 11.5) {
    const startIdx = Math.floor(startSec * sampleRate);
    const totalDur = endSec - startSec;
    const totalFrames = Math.floor(totalDur * sampleRate);

    let bL1 = 0, bL2 = 0, bR1 = 0, bR2 = 0;

    for (let n = 0; n < totalFrames; n++) {
      const tau = n / sampleRate;
      const idx = startIdx + n;
      const p = tau / totalDur; // 0 to 1

      // Frequency sweeps 300Hz -> 1200Hz -> 400Hz
      const sweepFreq = 300 + 900 * Math.sin(Math.PI * p);
      // Panning tracks 15% -> 85% -> 50%
      const pan = -0.7 + 1.4 * Math.sin(Math.PI * p);

      // Noise source through sweeping resonator
      const noise = (Math.random() * 2 - 1) * 0.28;
      const q = 0.88;
      const omega = (2 * Math.PI * sweepFreq) / sampleRate;
      const sinO = Math.sin(omega);
      const cosO = Math.cos(omega);

      // State variable filter approximation
      bL1 += sinO * (noise - bL1 - q * bL2);
      bL2 += sinO * bL1;
      bR1 += sinO * (noise - bR1 - q * bR2);
      bR2 += sinO * bR1;

      // Amplitude envelope (smooth bell)
      const env = Math.sin(Math.PI * p) * 0.26;
      const tone = Math.sin(2 * Math.PI * sweepFreq * tau) * 0.12 * env;

      const panL = (1 - pan) * 0.5;
      const panR = (1 + pan) * 0.5;

      add(left, idx, (bL1 * 0.6 + tone) * env * panL * 2);
      add(right, idx, (bR1 * 0.6 + tone) * env * panR * 2);
    }
  }

  // -------------------------------------------------------------
  // 5. Warm Emerald Verification Chord (Rhodes-style Fmaj9)
  // F3 (174.61Hz), C4 (261.63Hz), E4 (329.63Hz), G4 (392.00Hz), B4 (493.88Hz)
  // -------------------------------------------------------------
  function addEmeraldChord(timeSec, gain = 0.24) {
    const startIdx = Math.floor(timeSec * sampleRate);
    const chordFrames = Math.floor(2.2 * sampleRate);
    const chordFreqs = [174.61, 261.63, 329.63, 392.00, 493.88];
    const haasFrames = Math.floor(0.018 * sampleRate); // 18ms stereo Haas delay

    for (let n = 0; n < chordFrames; n++) {
      const tau = n / sampleRate;
      const idxL = startIdx + n;
      const idxR = startIdx + n + haasFrames;

      const attack = tau < 0.006 ? tau / 0.006 : 1.0;
      const decay = Math.exp(-2.2 * tau);
      const env = attack * decay * gain;

      let sumL = 0;
      let sumR = 0;

      for (let k = 0; k < chordFreqs.length; k++) {
        const f = chordFreqs[k];
        // Rhodes bell tine (fundamental + 2nd harmonic chime + 3.8x metallic ping)
        const fundamental = Math.sin(2 * Math.PI * f * tau);
        const overtone1 = Math.sin(2 * Math.PI * (f * 2) * tau) * Math.exp(-3.5 * tau) * 0.35;
        const chime = Math.sin(2 * Math.PI * (f * 3.8) * tau) * Math.exp(-6.0 * tau) * 0.15;
        const voice = fundamental + overtone1 + chime;

        // Slight stereo spread per voice
        const spread = (k / (chordFreqs.length - 1)) * 0.6 - 0.3;
        sumL += voice * (0.5 - spread);
        sumR += voice * (0.5 + spread);
      }

      add(left, idxL, sumL * env);
      add(right, idxR, sumR * env);
    }
  }

  // -------------------------------------------------------------
  // SCHEDULE SCENE FOLEY & MUSICAL TIMELINE (0.0s – 16.0s)
  // -------------------------------------------------------------

  // === SCENE 1 (0.0s – 3.8s): The Lie vs. Reality ===
  // Immediate frame 0 impact drop & keycap lock!
  addSubDrop(0.04, 0.58);
  addMechanicalClick(0.05, 0.0, 1.0, 1.2);
  addMechanicalClick(0.12, -0.2, 1.1, 0.8);

  // Agent terminal evaluation ticks (left panel)
  addMechanicalClick(0.35, -0.4, 1.25, 0.7);
  addMechanicalClick(0.60, -0.4, 1.20, 0.75);
  addMechanicalClick(0.85, -0.3, 1.15, 0.8);

  // Drawer slide-up metallic scuff & pixel count ticking
  addMechanicalClick(1.00, 0.4, 0.95, 0.9);
  // Stamp slam at 1.2s: heavy woody impact + sub drop!
  addSubDrop(1.20, 0.62);
  addMechanicalClick(1.20, -0.3, 0.85, 1.4);
  addMechanicalClick(1.22, 0.3, 0.80, 1.1);

  // SAM 3.1 Pixel loss counter tick-down (1.5s - 2.8s)
  for (let t = 1.5; t <= 2.8; t += 0.18) {
    addMechanicalClick(t, 0.45, 1.4 + 0.05 * (t - 1.5), 0.6);
  }

  // === SCENE 2 (3.8s – 7.8s): Dual-Instrument 3D Hardware Telemetry ===
  // 3D Perspective camera transition impact
  addSubDrop(3.80, 0.55);
  addMechanicalClick(3.80, 0.0, 0.95, 1.2);

  // 8-frame bar chart step-down clicks (t_0 .. t_7)
  const frameTimes = [4.20, 4.40, 4.60, 4.80, 5.00, 5.20, 5.40, 5.60];
  frameTimes.forEach((ft, idx) => {
    const pitch = 0.9 + idx * 0.06;
    const pan = -0.5 + idx * 0.1;
    addMechanicalClick(ft, pan, pitch, 0.75);
  });

  // Center Instrument B LED meter lock click (6.0s)
  addMechanicalClick(6.00, 0.0, 1.35, 1.0);
  addMechanicalClick(6.05, 0.1, 1.40, 0.8);

  // Rule 2 Decision tree rejection badge snap (6.8s)
  addMechanicalClick(6.80, 0.5, 0.88, 1.25);
  addSubDrop(6.82, 0.45);

  // === SCENE 3 (7.8s – 12.2s): Autonomous CSS Repair & Split-Curtain Wipe ===
  // Transition impact & code diff reveal
  addSubDrop(7.80, 0.52);
  addMechanicalClick(7.80, -0.2, 1.05, 1.1);

  // CSS diff typing keystrokes (7.9s - 8.6s)
  const typeKeys = [7.92, 8.04, 8.16, 8.28, 8.42, 8.54, 8.68];
  typeKeys.forEach((tk, idx) => {
    addMechanicalClick(tk, -0.3 + (idx % 3) * 0.2, 1.2 + (idx % 4) * 0.08, 0.65);
  });

  // Optical laser whoosh during the split-curtain wipe across checkout button (8.2s - 11.5s)
  addLaserScanWhoosh(8.20, 11.50);

  // Split-curtain handle sweeps across button - tactile optical ticks
  for (let t = 8.8; t <= 11.2; t += 0.3) {
    const p = (t - 8.8) / 2.4;
    addMechanicalClick(t, -0.6 + 1.2 * p, 1.5, 0.45);
  }

  // Emerald verification chord on 100% restored button (10.2s)
  addEmeraldChord(10.20, 0.26);
  addMechanicalClick(10.20, 0.4, 1.1, 1.0);

  // === SCENE 4 (12.2s – 16.0s): Flagship Bento Scoreboard & Launch Card ===
  // Heavy bento snap impact
  addSubDrop(12.20, 0.65);
  addMechanicalClick(12.20, 0.0, 0.9, 1.4);
  addMechanicalClick(12.23, 0.0, 0.85, 1.0);

  // Emerald chime & verification chord for 0.0% False-Pass (12.4s)
  addEmeraldChord(12.40, 0.32);

  // Stat pillars dock in sequence
  addMechanicalClick(12.60, -0.4, 1.1, 0.85);
  addMechanicalClick(12.80, 0.0, 1.15, 0.85);
  addMechanicalClick(13.00, 0.4, 1.2, 0.85);

  // Final tagline lock at 13.8s
  addMechanicalClick(13.80, 0.0, 0.85, 1.3);
  addSubDrop(13.82, 0.5);

  // -------------------------------------------------------------
  // 6. Master Soft Limiting & 16-Bit PCM WAV Writing
  // -------------------------------------------------------------
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
    // Cinematic mastering soft limiter
    const sampleL = Math.tanh(left[i] * 1.1) * 0.94;
    const sampleR = Math.tanh(right[i] * 1.1) * 0.94;

    const intL = Math.max(-32768, Math.min(32767, Math.floor(sampleL * 32767)));
    const intR = Math.max(-32768, Math.min(32767, Math.floor(sampleR * 32767)));

    pcm.writeInt16LE(intL, i * 4);
    pcm.writeInt16LE(intR, i * 4 + 2);
  }

  fs.writeFileSync(outputPath, Buffer.concat([header, pcm]));
  const stat = fs.statSync(outputPath);
  console.log(`[Tactile Audio] Success! Written to ${outputPath} (${(stat.size / 1024 / 1024).toFixed(2)} MB, ${durationSeconds}s @ ${sampleRate}Hz)`);
  return outputPath;
}

// Run standalone if invoked directly
if (process.argv[1] && process.argv[1].endsWith('synth-tactile-audio.mjs')) {
  synthesizeTactileAudio();
}

