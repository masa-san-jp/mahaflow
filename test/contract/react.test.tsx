import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRoot, type Root } from 'react-dom/client';
import { act, createElement } from 'react';
import { MahaFlow, type MahaFlowHandle } from '../../src/react/MahaFlow';
import { installBrowserStubs, makeFakeRenderer, type FakeRenderer } from './testUtils';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

beforeEach(() => {
  installBrowserStubs();
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('T-S03 React wrapper round trip', () => {
  it('mounts, reflects live prop changes via setConfig, and disposes cleanly on unmount', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const renderer = makeFakeRenderer();
    const ref: { current: MahaFlowHandle | null } = { current: null };

    let root: Root;
    act(() => {
      root = createRoot(container);
      root.render(
        createElement(MahaFlow, {
          ref: (h: MahaFlowHandle | null) => {
            ref.current = h;
          },
          seed: 1,
          live: { zoom: 2 },
          coreDeps: { createRenderer: () => renderer },
        } as any),
      );
    });

    await ref.current!.core!.ready;
    await sleep(10);
    expect(ref.current!.core!.getState().zoom).toBe(2);

    act(() => {
      root.render(
        createElement(MahaFlow, {
          ref: (h: MahaFlowHandle | null) => {
            ref.current = h;
          },
          seed: 1,
          live: { zoom: 4 },
          coreDeps: { createRenderer: () => renderer },
        } as any),
      );
    });
    expect(ref.current!.core!.getState().zoom).toBe(4);

    act(() => {
      root.unmount();
    });
    expect((renderer as FakeRenderer).disposeCalls).toBe(1);

    container.remove();
  });
});
