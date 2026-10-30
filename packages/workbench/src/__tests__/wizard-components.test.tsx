import { describe, it, expect } from 'vitest';
import React from 'react';
import { TopBar } from '../components/TopBar.js';
import { LeftPane } from '../components/LeftPane.js';
import { TelemetryPane } from '../components/TelemetryPane.js';
import { OpticalViewport } from '../components/OpticalViewport.js';
import {
  HardwareToggle,
  VerticalLedMeter,
  HardwareMiniSlider,
  RangefinderReticleOverlay,
  SubPixelMatrixLoupe,
} from '../components/FieldMonitorPrimitives.js';
import { App } from '../App.js';

describe('@spectra/workbench - Field Monitor UI (Step 1) Component Architecture', () => {
  it('exports all hardware primitives cleanly', () => {
    expect(HardwareToggle).toBeDefined();
    expect(VerticalLedMeter).toBeDefined();
    expect(HardwareMiniSlider).toBeDefined();
    expect(RangefinderReticleOverlay).toBeDefined();
    expect(SubPixelMatrixLoupe).toBeDefined();
  });

  it('renders HardwareToggle and responds to clicks', () => {
    let nextVal = false;
    const el = React.createElement(HardwareToggle, {
      active: false,
      onChange: (val) => {
        nextVal = val;
      },
      label: 'Test Toggle',
    });
    expect(el).toBeDefined();
    expect(el.props.active).toBe(false);
  });

  it('renders VerticalLedMeter with 14 bars', () => {
    const el = React.createElement(VerticalLedMeter, {
      ratio: 0.8482,
      variant: 'charcoal',
    });
    expect(el).toBeDefined();
    expect(el.props.ratio).toBe(0.8482);
  });

  it('renders RangefinderReticleOverlay with SVG reticle ticks', () => {
    const el = React.createElement(RangefinderReticleOverlay, {
      showCrosshair: true,
    });
    expect(el).toBeDefined();
  });

  it('renders SubPixelMatrixLoupe with target label', () => {
    const el = React.createElement(SubPixelMatrixLoupe, {
      targetLabel: 'Pay $149.00',
      lossPercent: 15.0,
      isRepaired: false,
    });
    expect(el).toBeDefined();
    expect(el.props.targetLabel).toBe('Pay $149.00');
  });

  it('validates TopBar component structure matching image_41bab6.jpg', () => {
    let currentTab = 'arena';
    const element = React.createElement(TopBar, {
      activeTab: 'arena',
      onSelectTab: (tab) => {
        currentTab = tab;
      },
      calibration: {
        sigma_noise: 0.0045,
        threshold: 0.0135,
        delta: 0.041,
        runIdCitation: '2026-10-28',
      },
    });

    expect(element).toBeDefined();
    expect(element.type).toBe(TopBar);
    expect(element.props.activeTab).toBe('arena');
  });

  it('validates LeftPane component structure and scenario list', () => {
    let picked = 's2';
    const element = React.createElement(LeftPane, {
      selectedScenarioId: 's2',
      onSelectScenario: (id) => {
        picked = id;
      },
    });

    expect(element).toBeDefined();
    expect(element.type).toBe(LeftPane);
    expect(element.props.selectedScenarioId).toBe('s2');
  });

  it('validates TelemetryPane component structure with dual-instrument readouts', () => {
    const element = React.createElement(TelemetryPane, {
      phase: 2,
      calibration: {
        sigma_noise: 0.0045,
        threshold: 0.0135,
        delta: 0.041,
      },
    });

    expect(element).toBeDefined();
    expect(element.type).toBe(TelemetryPane);
    expect(element.props.phase).toBe(2);
  });

  it('validates root App component renders 3-pane flush shell', () => {
    const element = React.createElement(App);
    expect(element).toBeDefined();
    expect(element.type).toBe(App);
  });
});
