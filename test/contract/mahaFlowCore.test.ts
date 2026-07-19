import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MahaFlowCore } from '../../src/core/MahaFlowCore';
import { FakeResizeObserver, installBrowserStubs, makeFakeRenderer } from './testUtils';

beforeEach(() => {
  installBrowserStubs();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('T-A01 seed required', () => {
  it('throws synchronously when seed is missing', () => {
    const container = document.createElement('div');
    expect(() => new MahaFlowCore(container, {} as any)).toThrow(/seed/i);
  });
});

describe('T-I01 container-scoped mounting and resize', () => {
  it('mounts a canvas inside the container and follows ResizeObserver updates', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const renderer = makeFakeRenderer();

    const core = new MahaFlowCore(container, { seed: 1 }, { createRenderer: () => renderer });

    expect(container.querySelector('canvas')).not.toBeNull();
    expect(FakeResizeObserver.instances).toHaveLength(1);
    expect(FakeResizeObserver.instances[0]!.observed).toContain(container);

    FakeResizeObserver.instances[0]!.trigger(400, 300);
    expect(renderer.setSizeCalls.at(-1)).toEqual([400, 300, 1]);

    core.dispose();
    container.remove();
  });
});

describe('T-I05 dispose releases resources with no leak across repeated mounts', () => {
  it('mount -> dispose 20 times cleanly', () => {
    for (let i = 0; i < 20; i++) {
      const container = document.createElement('div');
      const renderer = makeFakeRenderer();
      const core = new MahaFlowCore(container, { seed: i }, { createRenderer: () => renderer });
      core.dispose();
      expect(renderer.disposeCalls).toBe(1);
      expect(FakeResizeObserver.instances.at(-1)!.disconnected).toBe(true);
      // dispose is idempotent
      expect(() => core.dispose()).not.toThrow();
      expect(renderer.disposeCalls).toBe(1);
    }
  });
});
