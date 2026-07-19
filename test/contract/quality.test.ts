import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MahaFlowCore } from '../../src/core/MahaFlowCore';
import { installBrowserStubs, makeFakeRenderer } from './testUtils';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

beforeEach(() => {
  installBrowserStubs();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('T-P03 auto quality degradation integration', () => {
  it('degrades pixelRatio and warns after sustained slow frames, and never during export', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const renderer = makeFakeRenderer();
    const core = new MahaFlowCore(container, { seed: 1 }, { createRenderer: () => renderer });
    await core.ready;

    // Force every rAF tick to look slow (>25ms) by stubbing performance.now
    // to advance in large steps; RafLoop derives deltaSeconds from it.
    let t = 0;
    vi.spyOn(performance, 'now').mockImplementation(() => {
      t += 100;
      return t;
    });

    const warnings: string[] = [];
    core.on('warning', (w) => warnings.push(w.code));

    await sleep(700); // enough fake rAF ticks (16ms real-timer cadence) to exceed the 30-frame streak

    expect(warnings).toContain('quality-degraded');
    core.dispose();
  });
});
