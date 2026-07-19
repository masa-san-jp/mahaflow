import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MahaFlowCore } from '../../src/core/MahaFlowCore';
import { installBrowserStubs, makeFakeRenderer, type FakeRenderer } from './testUtils';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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

describe('mode reflects into renderFrame uniforms', () => {
  it('setConfig({mode: 1}) shows up as uniforms.mode on the next frame', async () => {
    const { core, renderer } = mount();
    await core.ready;
    core.setConfig({ mode: 1 });
    await sleep(60);

    const last = (renderer as FakeRenderer).renderCalls.at(-1);
    expect(last?.mode).toBe(1);
    core.dispose();
  });
});

describe('T-D01/T-D02 modulation bus drives frames non-destructively', () => {
  it('addModulation overrides zoom per-frame without changing getState()', async () => {
    const { core, renderer } = mount();
    await core.ready;

    const unsubscribe = core.addModulation(() => ({ zoom: 7 }));
    await sleep(60);

    const last = (renderer as FakeRenderer).renderCalls.at(-1);
    expect(last?.zoom).toBe(7);
    expect(core.getState().zoom).not.toBe(7); // base state untouched
    expect(core.getState({ resolved: true }).zoom).toBe(7);

    unsubscribe();
    core.dispose();
  });

  it('clearModulation removes all sources', async () => {
    const { core, renderer } = mount();
    await core.ready;
    core.addModulation(() => ({ zoom: 7 }));
    core.clearModulation();
    await sleep(60);

    const last = (renderer as FakeRenderer).renderCalls.at(-1);
    expect(last?.zoom).toBe(1); // back to default
    core.dispose();
  });
});
