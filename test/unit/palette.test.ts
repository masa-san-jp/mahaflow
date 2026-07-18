import { describe, expect, it } from 'vitest';
import { AURORA_PALETTE, DEFAULT_PALETTES, resolvePalette } from '../../src/palette/palettes';

describe('palette registry', () => {
  it('resolves the three built-in defaults by name', () => {
    expect(resolvePalette('aurora')).toEqual(DEFAULT_PALETTES.aurora);
    expect(resolvePalette('abyss')).toEqual(DEFAULT_PALETTES.abyss);
    expect(resolvePalette('dawn')).toEqual(DEFAULT_PALETTES.dawn);
  });

  it('falls back to aurora for an unknown name', () => {
    expect(resolvePalette('does-not-exist')).toEqual(AURORA_PALETTE);
  });

  it('prefers a caller-registered palette over a built-in of the same name', () => {
    const custom = { freq: [2, 2, 2] as [number, number, number], phase: [0, 0, 0] as [number, number, number] };
    expect(resolvePalette('aurora', { aurora: custom })).toEqual(custom);
  });
});
