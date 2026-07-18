import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MahaFlowElement } from '../../src/element/maha-flow';
import { installBrowserStubs, makeFakeRenderer } from './testUtils';

if (!customElements.get('maha-flow')) {
  customElements.define('maha-flow', MahaFlowElement);
}

beforeEach(() => {
  installBrowserStubs();
});

afterEach(() => {
  vi.restoreAllMocks();
});

function makeElement(attrs: Record<string, string> = {}): MahaFlowElement {
  const el = document.createElement('maha-flow') as MahaFlowElement;
  el.coreDeps = { createRenderer: () => makeFakeRenderer() };
  for (const [k, v] of Object.entries({ seed: '1', ...attrs })) el.setAttribute(k, v);
  return el;
}

describe('T-S01 attribute -> live reflection', () => {
  it('changing an observed attribute after connect updates live state', () => {
    const el = makeElement();
    document.body.appendChild(el);

    expect(el.core?.getState().zoom).toBe(1);
    el.setAttribute('zoom', '3');
    expect(el.core?.getState().zoom).toBe(3);

    el.remove();
  });

  it('binds initial attributes at connect time (preset, view, mode)', () => {
    const el = makeElement({ view: 'field', mode: 'wave' });
    document.body.appendChild(el);

    expect(el.core?.getState().mode).toBe(1);
    expect(el.core?.getState().view).toBe('field');

    el.remove();
  });
});

describe('T-S02 maha-prefixed CustomEvents', () => {
  it('relays statechange as a maha-statechange CustomEvent', async () => {
    const el = makeElement();
    document.body.appendChild(el);
    await el.core?.ready;

    const received: CustomEvent[] = [];
    el.addEventListener('maha-statechange', (e) => received.push(e as CustomEvent));

    el.setAttribute('zoom', '5');

    expect(received).toHaveLength(1);
    expect(received[0]!.detail.zoom).toBe(5);

    el.remove();
  });

  it('relays ready', async () => {
    const el = makeElement();
    const readyPromise = new Promise<void>((resolve) => el.addEventListener('maha-ready', () => resolve()));
    document.body.appendChild(el);
    await readyPromise;
    el.remove();
  });
});

describe('element lifecycle: disconnect disposes the core', () => {
  it('disposes MahaFlowCore on disconnectedCallback', () => {
    const el = makeElement();
    document.body.appendChild(el);
    const core = el.core!;
    let warned = false;
    core.on('warning', (w) => {
      if (w.code === 'disposed-api-call') warned = true;
    });

    el.remove();
    core.setConfig({ zoom: 2 }); // post-dispose call should no-op + warn, not throw
    expect(warned).toBe(true);
  });
});
