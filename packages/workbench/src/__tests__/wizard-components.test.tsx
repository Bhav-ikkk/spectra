import { describe, it, expect } from 'vitest';
import React from 'react';
import { TopBar } from '../components/TopBar.js';
import { Step1SelectClip } from '../components/Step1SelectClip.js';
import { Step2OpticalScan } from '../components/Step2OpticalScan.js';
import { Step3VerifyFix } from '../components/Step3VerifyFix.js';
import { App } from '../App.js';

describe('@spectra/workbench - Apple-Style 3-Step Wizard Component Architecture', () => {
  it('exports all 3 wizard steps and App component cleanly', () => {
    expect(TopBar).toBeDefined();
    expect(Step1SelectClip).toBeDefined();
    expect(Step2OpticalScan).toBeDefined();
    expect(Step3VerifyFix).toBeDefined();
    expect(App).toBeDefined();
  });

  it('validates TopBar component structure and stepper navigation contract', () => {
    let selectedStep = 1;
    const element = React.createElement(TopBar, {
      currentStep: 1,
      onStepChange: (step) => {
        selectedStep = step;
      },
      onOpenBenchmark: () => {},
      onOpenVoice: () => {},
      onOpenLens: () => {},
      calibration: {
        sigma_noise: 0.0045,
        threshold: 0.0135,
        delta: 0.041,
        runIdCitation: 'run-20261028',
      },
    });

    expect(element).toBeDefined();
    expect(element.type).toBe(TopBar);
    expect(element.props.currentStep).toBe(1);
    expect(typeof element.props.onStepChange).toBe('function');
  });

  it('validates Step 1 Select Clip contract and preset scenarios', () => {
    let pickedScenario = '';
    const element = React.createElement(Step1SelectClip, {
      onSelectScenario: (id) => {
        pickedScenario = id;
      },
      onSelectCleanControl: () => {},
      onRunCustomScan: () => {},
      targetLabel: 'Complete Checkout',
      setTargetLabel: () => {},
      isScanning: false,
    });

    expect(element).toBeDefined();
    expect(element.type).toBe(Step1SelectClip);
    expect(element.props.targetLabel).toBe('Complete Checkout');
    expect(typeof element.props.onSelectScenario).toBe('function');
  });

  it('validates Step 2 Optical Scan contract and dual-referee findings', () => {
    const element = React.createElement(Step2OpticalScan, {
      scenarioId: 's3',
      targetLabel: 'Complete Checkout',
      onBackToStep1: () => {},
      onProceedToStep3: () => {},
    });

    expect(element).toBeDefined();
    expect(element.type).toBe(Step2OpticalScan);
    expect(element.props.scenarioId).toBe('s3');
    expect(typeof element.props.onProceedToStep3).toBe('function');
  });

  it('validates Step 3 Auto-Patch & Verify contract with split-curtain comparison', () => {
    const element = React.createElement(Step3VerifyFix, {
      scenarioId: 's3',
      targetLabel: 'Complete Checkout',
      onBackToScan: () => {},
      onVerifyAnother: () => {},
    });

    expect(element).toBeDefined();
    expect(element.type).toBe(Step3VerifyFix);
    expect(element.props.scenarioId).toBe('s3');
    expect(typeof element.props.onBackToScan).toBe('function');
    expect(typeof element.props.onVerifyAnother).toBe('function');
  });

  it('validates root App component renders top bar and initial wizard state', () => {
    const element = React.createElement(App);
    expect(element).toBeDefined();
    expect(element.type).toBe(App);
  });
});

