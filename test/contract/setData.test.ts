import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MahaFlowCore } from '../../src/core/MahaFlowCore';
import { installBrowserStubs, makeFakeRenderer } from './testUtils';

function mount(seed = 1, dims = 3) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const renderer = makeFakeRenderer();
  const core = new MahaFlowCore(container, { seed, dims }, { createRenderer: () => renderer });
  return { container, core };
}

beforeEach(() => {
  installBrowserStubs();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('setData (form A)', () => {
  it('replaces the generated clusters and fires statechange', () => {
    const { core } = mount();
    let changed = 0;
    core.on('statechange', () => changed++);

    core.setData([
      { mu: [1, 0, 0], sigma: [[1, 0, 0], [0, 1, 0], [0, 0, 1]], amp: 0.8 },
      { mu: [-1, 0, 0], sigma: [[1, 0, 0], [0, 1, 0], [0, 0, 1]] },
    ]);

    expect(changed).toBe(1);
    expect(core.getState().clusters).toHaveLength(2);
    core.dispose();
  });

  it('warns on non-positive-definite sigma instead of throwing', () => {
    const { core } = mount();
    const warnings: string[] = [];
    core.on('warning', (w) => warnings.push(w.code));

    core.setData([{ mu: [0, 0, 0], sigma: [[1, 2, 0], [2, 1, 0], [0, 0, 1]] }]);

    expect(warnings).toContain('non-positive-definite-clipped');
    core.dispose();
  });

  it('throws synchronously on a dimension mismatch (T-A10)', () => {
    const { core } = mount(1, 3);
    expect(() => core.setData([{ mu: [0, 0], sigma: [[1, 0], [0, 1]] }])).toThrow();
    core.dispose();
  });

  it('after injection, changing spread/anisotropy no longer regenerates clusters', () => {
    const { core } = mount();
    core.setData([{ mu: [1, 0, 0], sigma: [[1, 0, 0], [0, 1, 0], [0, 0, 1]] }]);
    const before = core.getState().clusters[0];

    core.setConfig({ spread: 2.5, anisotropy: 0.9 });
    const after = core.getState().clusters[0];

    expect(after).toEqual(before);
    core.dispose();
  });

  it('randomize() reverts to generated data', () => {
    const { core } = mount();
    core.setData([{ mu: [1, 0, 0], sigma: [[1, 0, 0], [0, 1, 0], [0, 0, 1]] }]);
    expect(core.getState().clusters).toHaveLength(1);

    core.randomize(42);
    expect(core.getState().clusters.length).toBeGreaterThan(1); // back to maxClusters-generated set
    core.dispose();
  });
});
