// @spectra/workbench — Web UI, 3-pane layout
// Consumes @spectra/sdk for measurement and verdicts

export { SpectraClient, type SpectraClientConfig } from '@spectra/sdk';
export * from '@spectra/sdk';
export * from './types.js';
export * from './server/api-middleware.js';
export { bundleWorkbenchData } from './scripts/bundle-workbench-data.js';
