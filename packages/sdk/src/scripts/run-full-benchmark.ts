import { runRefereeBenchmark, formatBenchmarkSummary } from '../benchmark-runner.js';

async function main() {
  console.log('=== SPECTRA 4-EVALUATOR BENCHMARK EXECUTION ===');
  console.log('Running across 21 canonical v1 clips + 45 full clips...\n');

  const report = await runRefereeBenchmark({
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
