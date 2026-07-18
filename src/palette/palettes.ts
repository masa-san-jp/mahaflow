/**
 * IQ-style cosine palettes (design spec §6.2): color(x) = 0.5 + 0.5*cos(2π(freq*x + phase)).
 * The spec designates the mockup HTML's coefficients as canonical, but that
 * asset isn't present in this repository; the three defaults below are a
 * reasonable placeholder set pending that asset. Luminance-monotonicity
 * verification (T-C01~T-C03) is P4 scope.
 */
export interface PaletteDef {
  freq: [number, number, number];
  phase: [number, number, number];
}

export const AURORA_PALETTE: PaletteDef = {
  freq: [1.0, 1.0, 1.0],
  phase: [0.0, 0.33, 0.67],
};

export const ABYSS_PALETTE: PaletteDef = {
  freq: [0.8, 0.9, 1.1],
  phase: [0.6, 0.5, 0.4],
};

export const DAWN_PALETTE: PaletteDef = {
  freq: [1.2, 0.9, 0.7],
  phase: [0.0, 0.15, 0.3],
};

export const DEFAULT_PALETTES: Record<string, PaletteDef> = {
  aurora: AURORA_PALETTE,
  abyss: ABYSS_PALETTE,
  dawn: DAWN_PALETTE,
};

export function resolvePalette(
  name: string,
  extra: Record<string, PaletteDef> = {},
): PaletteDef {
  return extra[name] ?? DEFAULT_PALETTES[name] ?? AURORA_PALETTE;
}
