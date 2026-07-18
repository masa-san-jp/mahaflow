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

describe('T-S04 ui:"none" mounts no built-in UI DOM', () => {
  it('produces zero dev-panel nodes with the default config', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const core = new MahaFlowCore(container, { seed: 1 }, { createRenderer: () => makeFakeRenderer() });
    await core.ready;
    await sleep(30);

    expect(container.querySelectorAll('.maha-devpanel')).toHaveLength(0);

    core.dispose();
    container.remove();
  });
});

describe('ui:"dev" lazy-loads the dev panel', () => {
  it('mounts exactly one panel and removes it on dispose', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const core = new MahaFlowCore(container, { seed: 1, ui: 'dev' }, { createRenderer: () => makeFakeRenderer() });
    await core.ready;
    await sleep(30); // dynamic import() microtask/macrotask settle

    expect(container.querySelectorAll('.maha-devpanel')).toHaveLength(1);

    core.dispose();
    expect(container.querySelectorAll('.maha-devpanel')).toHaveLength(0);

    container.remove();
  });
});
