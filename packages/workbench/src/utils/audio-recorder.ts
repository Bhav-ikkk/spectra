// WebAudio 16kHz 16-bit Mono PCM WAV Recorder
// Encodes microphone input directly in memory in the browser

export interface AudioRecordingSession {
  stop: () => Promise<{ wavBlob: Blob; base64Wav: string; durationSec: number }>;
}

/**
 * Resamples raw Float32Array PCM samples from input sample rate to target 16,000 Hz
 */
export function resampleTo16k(audioBuffer: Float32Array, origSampleRate: number): Float32Array {
  if (origSampleRate === 16000) return audioBuffer;
  const ratio = origSampleRate / 16000;
  const newLength = Math.round(audioBuffer.length / ratio);
  const result = new Float32Array(newLength);
  for (let i = 0; i < newLength; i++) {
    const origIndex = i * ratio;
    const indexLow = Math.floor(origIndex);
    const indexHigh = Math.min(indexLow + 1, audioBuffer.length - 1);
    const weight = origIndex - indexLow;
    result[i] = (1 - weight) * audioBuffer[indexLow]! + weight * audioBuffer[indexHigh]!;
  }
  return result;
}

/**
 * Encodes a Float32Array of audio samples into a 44-byte RIFF/WAVE header
 * with 16-bit signed PCM mono audio at 16,000 Hz.
 */
export function encodeWav16kMono(samples: Float32Array): ArrayBuffer {
  const sampleRate = 16000;
  const numChannels = 1;
  const bytesPerSample = 2; // 16-bit PCM
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = samples.length * bytesPerSample;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  function writeString(offset: number, str: string) {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  }

  // RIFF chunk
  writeString(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, 'WAVE');

  // fmt subchunk
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true); // Subchunk1Size (16 for PCM)
  view.setUint16(20, 1, true); // AudioFormat (1 = PCM)
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true); // BitsPerSample (16 bits)

  // data subchunk
  writeString(36, 'data');
  view.setUint32(40, dataSize, true);

  // Write PCM audio data (convert float [-1.0, 1.0] to signed 16-bit int [-32768, 32767])
  let offset = 44;
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i] || 0));
    const intSample = s < 0 ? s * 0x8000 : s * 0x7fff;
    view.setInt16(offset, intSample, true);
    offset += 2;
  }

  return buffer;
}

/**
 * Converts an ArrayBuffer to a base64 string
 */
export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return window.btoa(binary);
}

/**
 * Requests microphone permission and begins capturing audio in memory
 */
export async function startAudioRecording(
  onLevelChange?: (level: number) => void,
): Promise<AudioRecordingSession> {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
    throw new Error('WebAudio/navigator.mediaDevices is not supported in this browser.');
  }

  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      channelCount: 1,
      sampleRate: 16000,
      echoCancellation: true,
      noiseSuppression: true,
    },
  });

  const AudioContextClass =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const audioContext = new AudioContextClass();
  const source = audioContext.createMediaStreamSource(stream);

  // Buffer size 4096, 1 input channel, 1 output channel
  const processor = audioContext.createScriptProcessor(4096, 1, 1);
  const chunks: Float32Array[] = [];
  const startTime = Date.now();

  processor.onaudioprocess = (e) => {
    const channelData = e.inputBuffer.getChannelData(0);
    chunks.push(new Float32Array(channelData));

    if (onLevelChange) {
      let sum = 0;
      for (let i = 0; i < channelData.length; i++) {
        sum += Math.abs(channelData[i] || 0);
      }
      const avg = sum / channelData.length;
      onLevelChange(Math.min(1, avg * 5)); // Scaled for visual meter
    }
  };

  source.connect(processor);
  processor.connect(audioContext.destination);

  return {
    stop: async () => {
      source.disconnect();
      processor.disconnect();
      stream.getTracks().forEach((track) => track.stop());

      const sampleRate = audioContext.sampleRate;
      await audioContext.close();

      // Concatenate all chunks
      let totalLength = 0;
      for (const chunk of chunks) {
        totalLength += chunk.length;
      }
      const fullBuffer = new Float32Array(totalLength);
      let offset = 0;
      for (const chunk of chunks) {
        fullBuffer.set(chunk, offset);
        offset += chunk.length;
      }

      // Resample to 16kHz if audioContext ran at native 44.1k/48k
      const resampled = resampleTo16k(fullBuffer, sampleRate);
      const wavBuffer = encodeWav16kMono(resampled);
      const base64Wav = arrayBufferToBase64(wavBuffer);
      const wavBlob = new Blob([wavBuffer], { type: 'audio/wav' });
      const durationSec = (Date.now() - startTime) / 1000;

      return {
        wavBlob,
        base64Wav,
        durationSec,
      };
    },
  };
}
