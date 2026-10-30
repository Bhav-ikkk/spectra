import { runRefereeBenchmark, formatBenchmarkSummary } from '../benchmark-runner.js';

async function main() {
  const allowLiveApi = process.argv.includes('--live');
  const skipLiveCalls = !allowLiveApi;

  console.log('=== SPECTRA 4-EVALUATOR BENCHMARK EXECUTION ===');
  if (skipLiveCalls) {
    console.log(
      '[Spectra Benchmark] Running in OFFLINE CACHE-SAFE mode (skipLiveCalls: true, $0.00 API spend). Pass --live only with explicit Rule 6 approval.',
    );
  } else {
    console.log('[Spectra Benchmark] WARNING: Running in LIVE API mode (--live).');
  }
  console.log('Running across 21 canonical v1 clips + 45 full clips...\n');

  const report = await runRefereeBenchmark({
    skipLiveCalls,
    onProgress: ({ stage, current, total, clipId }) => {
      console.log(`[${stage}] (${current}/${total}) Processing ${clipId}...`);
    },
  });

  console.log('\nBenchmark execution complete!\n');
  console.log(formatBenchmarkSummary(report));
}

main().catch((err) => {
  console.error('Benchmark execution error:', err);
  process.exit(1);
});
