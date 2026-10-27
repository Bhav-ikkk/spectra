export interface DecodedMaskFrame {
  frameIndex: number;
  bounds: {
    left: number;
    top: number;
    right: number;
    bottom: number;
  };
  svgPath: string;
  box?: {
    left: number;
    top: number;
    right: number;
    bottom: number;
  } | null;
  area?: number;
}

export interface WorkbenchClipAsset {
  clipId: string;
  environment: 'canvas' | 'mobile_mp4' | 'dom_catch';
  groundTruthOcclusion: number;
  variant: string;
  targetLabel: string;
  targetBBox: [number, number, number, number];
  t0AssetUrl: string;
  tkAssetUrl: string;
  videoAssetUrl?: string;
  samAvailable: boolean;
  t0Mask?: DecodedMaskFrame | null;
  tkMask?: DecodedMaskFrame | null;
  allMasks?: DecodedMaskFrame[];
  evaluators?: {
    dom_hit_test?: {
      verdict: string;
      lossPct: number;
      latencyMs: number;
    };
    vlm_open_weight?: {
      verdict: string;
      lossPct: number;
      latencyMs: number;
      explanation?: string;
    };
    vlm_flagship?: {
      verdict: string;
      lossPct: number;
      latencyMs: number;
      explanation?: string;
    };
    spectra_referee?: {
      verdict: string;
      lossPct: number;
      rSam: number;
      visRatio: number;
      pixelLossCount: number;
      latencyMs: number;
    };
  };
}

export interface WorkbenchScenarioBundle {
  scenarioId: 's1' | 's2' | 's3';
  title: string;
  environment: 'canvas' | 'mobile_mp4' | 'dom_catch';
  targetLabel: string;
  pass1: {
    clipId: string;
    t0AssetUrl: string;
    tkAssetUrl: string;
    verdict: Record<string, unknown>;
    masks?: DecodedMaskFrame[];
  };
  repairPatch: {
    description?: string;
    reasoning?: string;
    patchDiff?: string;
    suggestedFix?: string;
    rawPatch?: Record<string, unknown>;
  };
  pass2: {
    clipId: string;
    t0AssetUrl: string;
    tkAssetUrl: string;
    verdict: Record<string, unknown>;
    masks?: DecodedMaskFrame[];
  };
  summary: Record<string, unknown>;
}

export interface WorkbenchDataBundle {
  version: string;
  generatedAt: string;
  calibration: {
    sigma_noise: number;
    delta: number;
    threshold: number;
    runIdCitation: string;
  };
  invariants: Record<string, unknown>;
  voiceTranscript: Record<string, unknown>;
  scenarios: {
    s1: WorkbenchScenarioBundle;
    s2: WorkbenchScenarioBundle;
    s3: WorkbenchScenarioBundle;
  };
  benchmarkReport: Record<string, unknown>;
  clips: WorkbenchClipAsset[];
}
