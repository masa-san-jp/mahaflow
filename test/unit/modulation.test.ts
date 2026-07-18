import { describe, expect, it } from 'vitest';
import { ModulationBus } from '../../src/core/modulation';
import { DEFAULT_LIVE_PARAMS } from '../../src/core/config';

describe('T-D01 modulation bus applies non-destructively', () => {
  it('resolve() merges registered sources without mutating the base state', () => {
    const bus = new ModulationBus();
    bus.add((frame) => ({ zoom: 1 + frame * 0.1 }));

    const base = { ...DEFAULT_LIVE_PARAMS };
    const resolved = bus.resolve(base, 5);

    expect(resolved.zoom).toBeCloseTo(1.5, 9);
    expect(base.zoom).toBe(DEFAULT_LIVE_PARAMS.zoom); // base untouched
  });

  it('applies sources in registration order, later sources winning on overlapping keys', () => {
    const bus = new ModulationBus();
    bus.add(() => ({ zoom: 2 }));
    bus.add(() => ({ zoom: 3 }));

    expect(bus.resolve({ ...DEFAULT_LIVE_PARAMS }, 0).zoom).toBe(3);
  });
});

describe('T-D02 unsubscribe and clear', () => {
  it('unsubscribe removes only that source; clear removes all', () => {
    const bus = new ModulationBus();
    const unsubscribe = bus.add(() => ({ zoom: 9 }));
    bus.add(() => ({ speed: 0.9 }));

    unsubscribe();
    const afterUnsub = bus.resolve({ ...DEFAULT_LIVE_PARAMS }, 0);
    expect(afterUnsub.zoom).toBe(DEFAULT_LIVE_PARAMS.zoom);
    expect(afterUnsub.speed).toBe(0.9);

    bus.clear();
    const afterClear = bus.resolve({ ...DEFAULT_LIVE_PARAMS }, 0);
    expect(afterClear).toEqual(DEFAULT_LIVE_PARAMS);
  });
});

describe('frame-only dependence gives identical results across repeated resolves', () => {
  it('is deterministic: same frame -> same output (design spec §7.2 determinism condition)', () => {
    const bus = new ModulationBus();
    bus.add((frame) => ({ zoom: Math.sin(frame) + 2 }));

    const a = bus.resolve({ ...DEFAULT_LIVE_PARAMS }, 42);
    const b = bus.resolve({ ...DEFAULT_LIVE_PARAMS }, 42);
    expect(a).toEqual(b);
  });
});
