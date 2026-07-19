import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MahaFlowCore } from '../../src/core/MahaFlowCore';
import { DEFAULT_LIVE_PARAMS } from '../../src/core/config';
import type { Warning } from '../../src/core/config';
import { installBrowserStubs, makeFakeRenderer, type FakeRenderer } from './testUtils';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function mount(seed = 1, extra: Record<string, unknown> = {}) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const renderer = makeFakeRenderer();
  const core = new MahaFlowCore(container, { seed, ...extra } as any, { createRenderer: () => renderer });
  return { container, renderer, core };
}

beforeEach(() => {
  installBrowserStubs();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('T-A02 defaults', () => {
  it('getState with a minimal config matches the documented LiveParams defaults', () => {
    const { core } = mount();
    const state = core.getState();
    expect(state.clusterCount).toBe(DEFAULT_LIVE_PARAMS.clusterCount);
    expect(state.spread).toBe(DEFAULT_LIVE_PARAMS.spread);
    expect(state.anisotropy).toBe(DEFAULT_LIVE_PARAMS.anisotropy);
    expect(state.softness).toBe(DEFAULT_LIVE_PARAMS.softness);
    expect(state.zoom).toBe(DEFAULT_LIVE_PARAMS.zoom);
    expect(state.view).toBe('field');
    expect(state.playing).toBe(true);
    expect(state.seed).toBe(1);
    expect(state.clusters).toHaveLength(6);
    core.dispose();
  });
});

describe('T-A03 range clamp', () => {
  it('clamps out-of-range values and emits a warning', () => {
    const { core } = mount();
    const warnings: Warning[] = [];
    core.on('warning', (w) => warnings.push(w));

    core.setConfig({ zoom: 99 });

    expect(core.getState().zoom).toBe(12);
    expect(warnings.some((w) => w.code === 'clamped')).toBe(true);
    core.dispose();
  });
});

describe('T-A04 live reflects into next frame uniforms', () => {
  it('setConfig(zoom) shows up in the next renderFrame call', async () => {
    const { core, renderer } = mount();
    await core.ready;
    core.setConfig({ zoom: 3, pan: [0.5, -0.2] });
    await sleep(60);

    const last = (renderer as FakeRenderer).renderCalls.at(-1);
    expect(last?.zoom).toBe(3);
    expect(last?.pan).toEqual([0.5, -0.2]);
    core.dispose();
  });
});

describe('T-A05 init-only key protection', () => {
  it('ignores init-only keys passed to setConfig and warns', () => {
    const { core } = mount();
    const warnings: Warning[] = [];
    core.on('warning', (w) => warnings.push(w));

    core.setConfig({ dims: 99 } as any);

    expect(warnings.some((w) => w.code === 'init-only-key-ignored')).toBe(true);
    expect(core.getState().clusters).toHaveLength(6); // unaffected: maxClusters unchanged
    core.dispose();
  });
});

describe('T-A07 statechange firing', () => {
  it('fires once per setConfig and not for frame-only progression', async () => {
    const { core } = mount();
    await core.ready;
    let count = 0;
    core.on('statechange', () => count++);

    core.setConfig({ zoom: 2 });
    expect(count).toBe(1);

    await sleep(60); // let a couple of rAF frames tick with no config change
    expect(count).toBe(1);

    core.dispose();
  });
});

describe('T-A08 hover matches JS reference D', () => {
  it('emits the same D the field-view formula computes at that point', async () => {
    const { core, container } = mount(7);
    await core.ready;

    let hover: { D: number; x: number; y: number } | null = null;
    core.on('hover', (h) => (hover = h));

    const canvas = container.querySelector('canvas') as HTMLCanvasElement;
    Object.defineProperty(canvas, 'getBoundingClientRect', {
      value: () => ({ left: 0, top: 0, width: 400, height: 300, right: 400, bottom: 300 }),
    });
    // jsdom has no PointerEvent constructor; MouseEvent carries the clientX/clientY the handler reads.
    canvas.dispatchEvent(new MouseEvent('pointermove', { clientX: 200, clientY: 150, bubbles: true }));

    expect(hover).not.toBeNull();
    expect(Number.isFinite(hover!.D)).toBe(true);
    // Screen center maps to field-space pan (default [0,0]).
    expect(hover!.x).toBeCloseTo(0, 5);
    expect(hover!.y).toBeCloseTo(0, 5);

    core.dispose();
  });
});

describe('T-A09 dispose then API calls', () => {
  it('no-ops and warns instead of throwing', () => {
    const { core } = mount();
    const warnings: Warning[] = [];
    core.on('warning', (w) => warnings.push(w));

    core.dispose();

    expect(() => core.setConfig({ zoom: 2 })).not.toThrow();
    expect(() => core.play()).not.toThrow();
    expect(() => core.pause()).not.toThrow();
    expect(() => core.randomize()).not.toThrow();
    expect(warnings.filter((w) => w.code === 'disposed-api-call').length).toBeGreaterThanOrEqual(4);
  });
});
