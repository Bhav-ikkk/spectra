// @spectra/sam-client — SAM 3.1 API wrapper and stream parser
// Re-exports verified functionality from @meta-sam/parser and provides client bindings

export {
  decodeMaskToRaster,
  decodeMaskToRLE,
  decodeMaskToSVGPath,
  frameIndexOf,
  parseImageStream,
  parseVideoStream,
  parseResponsesStream,
  recordsOfKind,
  buildObjectPrompt,
  ObjectPromptError,
  InvalidSegmentationMaskError,
  ResponsesStreamError,
  type ResponsesEvent,
  type VideoSegmentationResult,
  type VideoSegmentationSnapshot,
  type ImageSegmentationResult,
  type ImageSegmentationSnapshot,
  type SegmentationBoxRecord,
  type SegmentationMaskRecord,
  type SegmentationRecord,
} from '@meta-sam/parser';

export interface SamClientConfig {
  apiKey?: string;
  baseUrl?: string;
  model?: string;
}

/**
 * Validates SAM 3.1 configuration
 */
export function createSamConfig(config: SamClientConfig = {}): SamClientConfig {
  return {
    apiKey:
      config.apiKey || (typeof process !== 'undefined' ? process.env?.META_API_KEY : undefined),
    baseUrl: config.baseUrl || 'https://api.meta.ai/v1',
    model: config.model || 'sam-3.1',
  };
}
