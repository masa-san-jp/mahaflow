import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MahaFlowCore } from '../../src/core/MahaFlowCore';
import { installBrowserStubs, makeFakeRenderer } from './testUtils';

function mount(seed = 1) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const renderer = makeFakeRenderer();
  const core = new MahaFlowCore(container, { seed }, { createRenderer: () => renderer });
  return { container, renderer, core };
}

beforeEach(() => {
  installBrowserStubs();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('built-in presets', () => {
  it('lists the four built-in presets and applying one changes state', () => {
    const { core } = mount();
    const names = core.listPresets();
    expect(names).toEqual(['calm-sea', 'deep-current', 'capillary-bloom', 'shattered-glass']);

    core.applyPreset('deep-current');
    expect(core.getState().mode).toBe(1);
    expect(core.getState().palette).toBe('abyss');
    core.dispose();
  });

  it('warns on an unknown preset name and leaves state unchanged', () => {
    const { core } = mount();
    const before = core.getState();
    let warned = false;
    core.on('warning', (w) => {
      if (w.code === 'unknown-preset') warned = true;
    });

    core.applyPreset('does-not-exist');

    expect(warned).toBe(true);
    expect(core.getState().mode).toBe(before.mode);
    core.dispose();
  });
});

describe('T-A12 preset save/apply round trip', () => {
  it('reproduces the saved state after being overwritten by other changes', () => {
    const { core } = mount();
    core.setConfig({ zoom: 2.5, mode: 2, softness: 1.4 });
    const saved = core.savePreset('my-scene');

    core.setConfig({ zoom: 5, mode: 0, softness: 0.5 });
    expect(core.getState().zoom).toBe(5);

    core.applyPreset('my-scene');
    const restored = core.getState();

    expect(restored.zoom).toBe(saved.state.zoom);
    expect(restored.mode).toBe(saved.state.mode);
    expect(restored.softness).toBe(saved.state.softness);
    core.dispose();
  });
});
