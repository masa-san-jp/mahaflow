import { describe, expect, it } from 'vitest';
import { Prng } from '../../src/math/prng';
import { deterministicShuffle, framesPerInterval } from '../../src/core/autoplay';

describe('deterministicShuffle', () => {
  it('is deterministic for a fixed PRNG seed and preserves the item set', () => {
    const items = ['a', 'b', 'c', 'd', 'e'];
    const a = deterministicShuffle(items, new Prng(5));
    const b = deterministicShuffle(items, new Prng(5));
    expect(a).toEqual(b);
    expect([...a].sort()).toEqual([...items].sort());
  });

  it('does not mutate the input array', () => {
    const items = ['a', 'b', 'c'];
    deterministicShuffle(items, new Prng(1));
    expect(items).toEqual(['a', 'b', 'c']);
  });
});

describe('framesPerInterval', () => {
  it('converts a seconds interval to a frame count at the given fps', () => {
    expect(framesPerInterval(20, 30)).toBe(600);
    expect(framesPerInterval(0.5, 30)).toBe(15);
  });
});
