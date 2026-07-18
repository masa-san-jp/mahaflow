import { describe, expect, it } from 'vitest';
import { DeterministicClock, frameToTime } from '../../src/core/clock';
import { tourBasis } from '../../src/math/tour';

describe('T-M09 rational timebase', () => {
  it('computes t = n*den/num for an NTSC timebase with no accumulated error', () => {
    const tb = { num: 30000, den: 1001 };
    const n = 1001;
    const t = frameToTime(n, tb);
    const expected = Number(1001n * 1001n) / 30000;
    expect(t).toBe(expected);
  });
});

describe('T-M10 frame resume', () => {
  it('restoring a saved frame reproduces identical downstream inputs', () => {
    const tb = { num: 30000, den: 1001 };
    const original = new DeterministicClock(tb);
    original.advanceByElapsedSeconds(2.3);
    original.advanceByElapsedSeconds(0.7);
    const savedFrame = original.currentFrame;

    const resumed = new DeterministicClock(tb, savedFrame);

    expect(resumed.time).toBe(original.time);
    expect(tourBasis(resumed.time, 8)).toEqual(tourBasis(original.time, 8));
  });
});
