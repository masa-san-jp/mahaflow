import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MahaFlowCore } from '../../src/core/MahaFlowCore';
import { installBrowserStubs, makeFakeRenderer } from './testUtils';
import type { OrbitRenderer, OrbitFrameData } from '../../src/render/orbitView';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function makeFakeOrbitRenderer() {
  const setSizeCalls: Array<[number, number, number]> = [];
  const renderCalls: OrbitFrameData[] = [];
  let disposeCalls = 0;
  const renderer: OrbitRenderer & { setSizeCalls: typeof setSizeCalls; renderCalls: typeof renderCalls; disposeCalls: number } = {
    canvas: document.createElement('canvas'),
    ready: Promise.resolve(),
    setSize(w, h, pr) {
      setSizeCalls.push([w, h, pr]);
    },
    renderFrame(frame) {
      renderCalls.push(frame);
    },
    dispose() {
      disposeCalls++;
    },
    setSizeCalls,
    renderCalls,
    get disposeCalls() {
      return disposeCalls;
    },
  };
  return renderer;
}

function mount(view: 'field' | 'orbit' = 'field') {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const fieldRenderer = makeFakeRenderer();
  const orbitRenderer = makeFakeOrbitRenderer();
  const core = new MahaFlowCore(
    container,
    { seed: 1, initialLive: { view } },
    { createRenderer: () => fieldRenderer, createOrbitRenderer: () => orbitRenderer },
  );
  return { container, core, fieldRenderer, orbitRenderer };
}

beforeEach(() => {
  installBrowserStubs();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('view switching creates/disposes the matching renderer', () => {
  it('starts with the field renderer for the default view', async () => {
    const { core, fieldRenderer, orbitRenderer } = mount('field');
    await core.ready;
    await sleep(60);

    expect(fieldRenderer.renderCalls.length).toBeGreaterThan(0);
    expect(orbitRenderer.renderCalls.length).toBe(0);
    core.dispose();
  });

  it('constructs directly into the orbit renderer when initialLive.view is "orbit"', async () => {
    const { core, fieldRenderer, orbitRenderer } = mount('orbit');
    await core.ready;
    await sleep(60);

    expect(orbitRenderer.renderCalls.length).toBeGreaterThan(0);
    expect(fieldRenderer.renderCalls.length).toBe(0);
    core.dispose();
  });

  it('setConfig({view:"orbit"}) disposes the field renderer and switches to orbit', async () => {
    const { core, fieldRenderer, orbitRenderer } = mount('field');
    await core.ready;
    await sleep(60);
    expect(fieldRenderer.renderCalls.length).toBeGreaterThan(0);

    core.setConfig({ view: 'orbit' });
    await sleep(60);

    expect(fieldRenderer.disposeCalls).toBe(1);
    expect(orbitRenderer.renderCalls.length).toBeGreaterThan(0);
    core.dispose();
    expect(orbitRenderer.disposeCalls).toBe(1);
  });

  it('orbit frame data carries clusters/basis/orbit state for point-cloud rendering', async () => {
    const { core, orbitRenderer } = mount('orbit');
    await core.ready;
    await sleep(60);

    const frame = orbitRenderer.renderCalls.at(-1)!;
    expect(frame.clusters.length).toBeGreaterThan(0);
    expect(frame.basis.u).toHaveLength(8);
    expect(frame.orbit).toBeDefined();
    core.dispose();
  });
});
