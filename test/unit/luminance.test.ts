import { describe, expect, it } from 'vitest';
import { AURORA_PALETTE, ABYSS_PALETTE, DAWN_PALETTE, monotonicPalette } from '../../src/palette/palettes';
import {
  DEUTERANOPIA_MATRIX,
  PROTANOPIA_MATRIX,
  isMonotonic,
  luminanceCurve,
} from '../../src/palette/luminance';

describe('T-C01 luminance monotonicity', () => {
  it.each([
    ['aurora', AURORA_PALETTE],
    ['abyss', ABYSS_PALETTE],
    ['dawn', DAWN_PALETTE],
  ])('%s: luminance(x) over 256 samples has no reversals', (_name, palette) => {
    expect(isMonotonic(luminanceCurve(palette, 256))).toBe(true);
  });

  it('monotonicPalette holds for a wide range of hue offsets and frequencies up to 0.5', () => {
    for (const freq of [0.1, 0.25, 0.4, 0.5]) {
      for (const offsets of [
        [0, 0.1, 0.2],
        [0.3, -0.2, 0.4],
        [0.5, 0.5, 0.5],
      ] as [number, number, number][]) {
        const palette = monotonicPalette(freq, offsets);
        expect(isMonotonic(luminanceCurve(palette, 256))).toBe(true);
      }
    }
  });
});

describe('T-C02 CVD simulation preserves distance ordering', () => {
  it.each([
    ['aurora', AURORA_PALETTE],
    ['abyss', ABYSS_PALETTE],
    ['dawn', DAWN_PALETTE],
  ])('%s: protanopia- and deuteranopia-simulated luminance stays monotonic', (_name, palette) => {
    expect(isMonotonic(luminanceCurve(palette, 256, PROTANOPIA_MATRIX))).toBe(true);
    expect(isMonotonic(luminanceCurve(palette, 256, DEUTERANOPIA_MATRIX))).toBe(true);
  });
});

describe('T-C03 non-monotonic palettes are detectable', () => {
  it('a palette with mismatched high frequencies typically fails the monotonic check', () => {
    const nonMonotonic = { freq: [3, 5, 7] as [number, number, number], phase: [0, 0.5, 0.25] as [number, number, number] };
    expect(isMonotonic(luminanceCurve(nonMonotonic, 256))).toBe(false);
  });
});
