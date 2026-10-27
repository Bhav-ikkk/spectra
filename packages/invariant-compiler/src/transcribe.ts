import fs from 'node:fs';

export interface TranscribeAudioOptions {
  apiKey?: string;
  baseUrl?: string;
  model?: string;
}

export interface TranscribeResult {
  sessionId: string;
  transcript: string;
  audioDurationMs?: number;
  rawResponse: Record<string, unknown>;
}

export async function transcribeAudioFile(
  audioPath: string,
  options: TranscribeAudioOptions = {},
): Promise<TranscribeResult> {
  const apiKey =
    options.apiKey || (typeof process !== 'undefined' ? process.env?.META_API_KEY : undefined);
  if (!apiKey) {
    throw new Error('META_API_KEY is required for audio transcription.');
  }

  const baseUrl = options.baseUrl || 'https://api.meta.ai/v1';
  const model = options.model || 'muse-voice-transcribe-1.0';

  if (!fs.existsSync(audioPath)) {
    throw new Error(`Audio file not found at: ${audioPath}`);
  }

  const audioBuffer = fs.readFileSync(audioPath);
  const form = new FormData();

  const reqBlob = new Blob(
    [
      JSON.stringify({
        model,
        audioEncoding: 'WAV',
        mode: 'PUSH_TO_TALK',
      }),
    ],
    { type: 'application/json' },
  );

  form.append('request', reqBlob);
  form.append('audio', new Blob([audioBuffer], { type: 'audio/wav' }), 'audio.wav');

  const endpoint = `${baseUrl}/asr/transcribe`;
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: 'application/json',
    },
    body: form,
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Meta ASR error (${res.status}): ${errorText}`);
  }

  const rawJson = (await res.json()) as Record<string, unknown>;
  const transcript = String(rawJson.transcript || '').trim();
  const sessionId = String(rawJson.sessionId || '');
  const audioDurationMs =
    typeof rawJson.audioDurationMs === 'number' ? rawJson.audioDurationMs : undefined;

  return {
    sessionId,
    transcript,
    audioDurationMs,
    rawResponse: rawJson,
  };
}
