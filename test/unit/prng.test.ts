import { describe, expect, it } from 'vitest';
import { Prng, substream } from '../../src/math/prng';

describe('T-M01 PRNG reproducibility', () => {
  it('two streams from the same seed produce identical sequences', () => {
    const a = new Prng(12345);
    const b = new Prng(12345);
    const seqA = Array.from({ length: 1000 }, () => a.next());
    const seqB = Array.from({ length: 1000 }, () => b.next());
    expect(seqA).toEqual(seqB);
  });
});

describe('T-M02 substream independence', () => {
  it('consuming one substream does not affect another', () => {
    const seed = 777;
    const streamB1 = substream(seed, 'points');

    const before = Array.from({ length: 50 }, () => streamB1.next());

    // Consume many values from the unrelated substream.
    const streamA2 = substream(seed, 'clusters');
    for (let i = 0; i < 10_000; i++) streamA2.next();

    const streamB2 = substream(seed, 'points');
    const after = Array.from({ length: 50 }, () => streamB2.next());

    expect(after).toEqual(before);
    // sanity: the two purposes actually diverge from each other
    const streamA3 = substream(seed, 'clusters');
    const aVals = Array.from({ length: 50 }, () => streamA3.next());
    expect(aVals).not.toEqual(before);
  });
});

describe('T-M03 Gaussian distribution', () => {
  it('mean/variance/skewness approximate the standard normal', () => {
    const rng = new Prng(2026);
    const n = 100_000;
    const samples = Array.from({ length: n }, () => rng.nextGaussian());

    const mean = samples.reduce((s, v) => s + v, 0) / n;
    const variance = samples.reduce((s, v) => s + (v - mean) ** 2, 0) / n;
    const skew =
      samples.reduce((s, v) => s + (v - mean) ** 3, 0) / n / variance ** 1.5;

    expect(mean).toBeCloseTo(0, 1);
    expect(variance).toBeCloseTo(1, 1);
    expect(skew).toBeCloseTo(0, 1);
  });
});
