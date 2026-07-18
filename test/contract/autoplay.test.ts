import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MahaFlowCore } from '../../src/core/MahaFlowCore';
import { substream } from '../../src/math/prng';
import { installBrowserStubs, makeFakeRenderer } from './testUtils';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function mount(seed = 99) {
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

describe('T-A13 autoplay "randomize" determinism', () => {
  it('draws seeds from the autoplay-randomize substream, in order', async () => {
    const seed = 99;
    const { core } = mount(seed);
    await core.ready;

    const seeds: number[] = [];
    let lastIndexSeen = 0;
    core.on('statechange', (s) => {
      const autoplay = s.autoplay as { index: number } | false;
      if (autoplay && autoplay.index > lastIndexSeen) {
        lastIndexSeen = autoplay.index;
        seeds.push(s.seed);
      }
    });

    // interval: 0 transitions on every rendered frame, independent of wall-clock jitter.
    core.startAutoplay({ interval: 0, sequence: 'randomize' });
    await sleep(120);
    core.stopAutoplay();

    expect(seeds.length).toBeGreaterThanOrEqual(3);

    const rng = substream(seed, 'autoplay-randomize');
    const expected = seeds.map(() => Math.floor(rng.next() * 0xffffffff));
    expect(seeds).toEqual(expected);

    core.dispose();
  });
});

describe('T-A14 autoplay start/stop control', () => {
  it('startAutoplay -> stopAutoplay -> startAutoplay transitions state and fires statechange', () => {
    const { core } = mount();
    let changes = 0;
    core.on('statechange', () => changes++);

    expect(core.getState().autoplay).toBe(false);

    core.startAutoplay({ interval: 20, sequence: 'randomize' });
    expect(core.getState().autoplay).not.toBe(false);
    expect((core.getState().autoplay as any).index).toBe(0);
    expect(changes).toBe(1);

    core.stopAutoplay();
    expect(core.getState().autoplay).toBe(false);
    expect(changes).toBe(2);

    core.startAutoplay({ interval: 5, sequence: 'shuffle' });
    expect(core.getState().autoplay).not.toBe(false);
    expect(changes).toBe(3);

    core.dispose();
  });
});
