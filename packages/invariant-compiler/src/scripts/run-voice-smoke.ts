import fs from 'node:fs';
import path from 'node:path';
import { compileTranscriptToInvariants } from '../compile.js';

function findProjectRoot(): string {
  let dir = process.cwd();
  while (!fs.existsSync(path.join(dir, 'pnpm-workspace.yaml'))) {
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return dir;
}

function matchEnvValue(envContent: string, key: string): string | undefined {
  const match = envContent.match(new RegExp(`^${key}=([^\r\n]+)`, 'm'));
  const raw = match?.[1]?.trim();
  if (!raw) return undefined;
  if (
    raw.length >= 2 &&
    ((raw.startsWith('"') && raw.endsWith('"')) || (raw.startsWith("'") && raw.endsWith("'")))
  ) {
    return raw.slice(1, -1);
  }
  return raw;
}

export async function runVoiceSmoke() {
  console.log('=== Step 2: Live Invariant Compilation (muse-spark-1.3) ===\n');

  const root = findProjectRoot();
  const envContent = fs.readFileSync(path.join(root, '.env'), 'utf-8');
  const apiKey = matchEnvValue(envContent, 'META_API_KEY') || process.env.META_API_KEY;

  if (!apiKey) {
    throw new Error('META_API_KEY is not defined.');
  }

  const voiceSmokeDir = path.join(root, 'benchmark/responses/voice-smoke');
  const transcribeRespPath = path.join(voiceSmokeDir, 'raw_transcribe_response.json');
  const transcribeData = JSON.parse(fs.readFileSync(transcribeRespPath, 'utf-8'));

  const transcript = transcribeData.transcript;
  const sessionId = transcribeData.sessionId;

  console.log(`Transcribed Audio Session: ${sessionId}`);
  console.log(`Spoken Transcript:\n  "${transcript}"\n`);

  console.log('Calling POST https://api.meta.ai/v1/responses (model: muse-spark-1.3)...');
  const startTime = Date.now();
  const compileResult = await compileTranscriptToInvariants(transcript, {
    apiKey,
    voiceTranscriptId: sessionId,
  });
  const elapsed = Date.now() - startTime;
  console.log(`✓ muse-spark-1.3 responded in ${elapsed}ms`);

  // Save raw response
  const rawSparkPath = path.join(voiceSmokeDir, 'raw_spark_response.json');
  fs.writeFileSync(
    rawSparkPath,
    JSON.stringify(compileResult.rawResponse, null, 2) + '\n',
    'utf-8',
  );
  console.log(`✓ Raw spark response saved to: ${rawSparkPath}`);

  // Save compiled invariants document to benchmark/responses/voice-smoke/invariants.json
  const compiledDocPath = path.join(voiceSmokeDir, 'invariants.json');
  fs.writeFileSync(
    compiledDocPath,
    JSON.stringify(compileResult.document, null, 2) + '\n',
    'utf-8',
  );
  console.log(`✓ Compiled invariants document saved to: ${compiledDocPath}`);

  // Save to .spectra/invariants.json
  const spectraDir = path.join(root, '.spectra');
  fs.mkdirSync(spectraDir, { recursive: true });
  const rootInvariantsPath = path.join(spectraDir, 'invariants.json');
  fs.writeFileSync(
    rootInvariantsPath,
    JSON.stringify(compileResult.document, null, 2) + '\n',
    'utf-8',
  );
  console.log(`✓ Active repo invariants saved to: ${rootInvariantsPath}`);

  console.log('\nCompiled Invariants:');
  for (const inv of compileResult.document.invariants) {
    console.log(`  - [${inv.id}] (${inv.type}/${inv.severity}): ${inv.description}`);
    console.log(`      Target: "${inv.matcher.target}", Expected: ${inv.matcher.expected}`);
  }

  console.log('\n=== Voice Smoke Test Complete ===');
  return compileResult;
}

runVoiceSmoke().catch((err) => {
  console.error('Fatal error in runVoiceSmoke:', err);
  process.exit(1);
});
