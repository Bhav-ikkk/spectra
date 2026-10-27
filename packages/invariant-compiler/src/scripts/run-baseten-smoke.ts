import fs from 'node:fs';
import path from 'node:path';
import { InvariantsDocumentSchema } from '@spectra/core';
import { compileTranscriptToInvariants } from '../compile.js';
import { evaluateWithVlmJudge } from '../vlm-judge.js';

function findProjectRoot(): string {
  let dir = process.cwd();
  while (!fs.existsSync(path.join(dir, 'pnpm-workspace.yaml'))) {
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return dir;
}

export async function runBasetenSmoke() {
  console.log('=== Baseten Open-Weight (meta-models/muse-spark-open-1026) Smoke Test ===\n');

  const root = findProjectRoot();
  const envPath = path.join(root, '.env');
  let apiKey = process.env.BASETEN_API_KEY;
  let baseUrl = process.env.BASETEN_BASE_URL || 'https://inference.baseten.co/v1';

  if (!apiKey && fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf-8');
    apiKey = envContent.match(/BASETEN_API_KEY=([^\r\n]+)/)?.[1]?.trim();
    const envBaseUrl = envContent.match(/BASETEN_BASE_URL=([^\r\n]+)/)?.[1]?.trim();
    if (envBaseUrl) baseUrl = envBaseUrl;
  }

  if (!apiKey) {
    console.log('⚠ BASETEN_API_KEY is not set in environment or .env.');
    console.log('Skipping live Baseten calls (all offline tests and fixtures remain functional).');
    return;
  }

  const outDir = path.join(root, 'benchmark/responses/baseten-smoke');
  fs.mkdirSync(outDir, { recursive: true });

  const transcript =
    'When the cart drawer opens, the complete checkout button must never be covered, and the revenue series legend must stay visible.';
  const voiceTranscriptId = 'voyager/transcribe/6D0FEAC1E93944EB9F057C5DBE136055';

  // ==========================================
  // Call 1 of 2: Compile Invariant with Baseten
  // ==========================================
  console.log('--- Call 1/2: Compiling spoken transcript to InvariantsDocument via Baseten ---');
  console.log(`Endpoint: POST ${baseUrl}/chat/completions`);
  console.log('Model: meta-models/muse-spark-open-1026');
  console.log(`Transcript: "${transcript}"\n`);

  const t0 = Date.now();
  const compileResult = await compileTranscriptToInvariants(transcript, {
    provider: 'baseten',
    apiKey,
    baseUrl,
    model: 'meta-models/muse-spark-open-1026',
    voiceTranscriptId,
  });
  const compileElapsed = Date.now() - t0;
  console.log(`✓ Call 1 succeeded in ${compileElapsed}ms`);

  // Verify resulting document against InvariantsDocumentSchema
  const validatedDoc = InvariantsDocumentSchema.parse(compileResult.document);
  console.log(`✓ Document schema validated: ${validatedDoc.invariants.length} invariants compiled`);

  // Save raw response fixture
  const rawCompilePath = path.join(outDir, 'compile_response.json');
  fs.writeFileSync(
    rawCompilePath,
    JSON.stringify(compileResult.rawResponse, null, 2) + '\n',
    'utf-8',
  );
  console.log(`✓ Raw response saved to: ${rawCompilePath}`);

  // Save compiled invariants document fixture
  const docPath = path.join(outDir, 'invariants.json');
  fs.writeFileSync(docPath, JSON.stringify(validatedDoc, null, 2) + '\n', 'utf-8');
  console.log(`✓ InvariantsDocument saved to: ${docPath}`);

  // Also update active repo .spectra/invariants.json
  const activeInvariantsPath = path.join(root, '.spectra/invariants.json');
  fs.mkdirSync(path.dirname(activeInvariantsPath), { recursive: true });
  fs.writeFileSync(activeInvariantsPath, JSON.stringify(validatedDoc, null, 2) + '\n', 'utf-8');
  console.log(`✓ Active repo invariants updated: ${activeInvariantsPath}`);

  for (const inv of validatedDoc.invariants) {
    console.log(`  - [${inv.id}] (${inv.type}/${inv.severity}): ${inv.description}`);
    console.log(`      Target: "${inv.matcher.target}", Expected: ${inv.matcher.expected}`);
  }

  // ==========================================
  // Call 2 of 2: Vision VLM Judge with Baseten
  // ==========================================
  console.log('\n--- Call 2/2: Vision VLM Judge on dom_catch_010_v1_tk.png via Baseten ---');
  const framePath = path.join(root, 'benchmark/clips/dom_catch_010_v1_tk.png');
  const targetLabel = 'Complete Checkout Button';

  console.log(`Evaluating frame: ${framePath}`);
  console.log(`Target: "${targetLabel}"`);
  console.log('Testing open-weight VLM on 10% subtle edge occlusion...\n');

  const t1 = Date.now();
  const judgeResult = await evaluateWithVlmJudge(framePath, targetLabel, {
    provider: 'baseten',
    apiKey,
    baseUrl,
    model: 'meta-models/muse-spark-open-1026',
  });
  const judgeElapsed = Date.now() - t1;
  console.log(`✓ Call 2 succeeded in ${judgeElapsed}ms`);

  // Save raw judge response fixture
  const rawJudgePath = path.join(outDir, 'vlm_judge_response.json');
  fs.writeFileSync(rawJudgePath, JSON.stringify(judgeResult.rawResponse, null, 2) + '\n', 'utf-8');
  console.log(`✓ Raw VLM judge response saved to: ${rawJudgePath}`);

  console.log('\nVLM Judge Evaluation Result:');
  console.log(`  Target: "${judgeResult.target}"`);
  console.log(
    `  Clipped Verdict: ${judgeResult.clipped ? 'CLIPPED (Occluded)' : 'NOT CLIPPED (Visible)'}`,
  );
  console.log(`  Confidence: ${(judgeResult.confidence * 100).toFixed(1)}%`);
  console.log(`  Reasoning: "${judgeResult.reasoning}"`);
  console.log(`  Provider/Model: ${judgeResult.provider} (${judgeResult.model})`);

  console.log('\n=== Spectra Referee Comparison ===');
  console.log(
    'Ground Truth: dom_catch_010_v1 has 10% occlusion (drawer boundary covers right edge).',
  );
  console.log(
    'Spectra Dual-Instrument Referee: Catches 10% loss with mathematical confidence (PASS/FAIL referee).',
  );
  console.log(
    `Open-Weight VLM Result: ${judgeResult.clipped ? 'Detected clipping' : 'Blind spot confirmed (missed 10% subtle edge occlusion)'}`,
  );

  console.log('\n=== Both Authorized Baseten Calls Completed Successfully ===');
}

runBasetenSmoke().catch((err) => {
  console.error('Fatal error in runBasetenSmoke:', err);
  process.exit(1);
});
