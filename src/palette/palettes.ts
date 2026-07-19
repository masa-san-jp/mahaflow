/**
 * IQ-style cosine palettes (design spec §6.2): color(x) = 0.5 + 0.5*cos(2π(freq*x + phase)).
 * The spec designates the mockup HTML's coefficients as canonical, but that
 * asset isn't present in this repository; the three defaults below are a
 * placeholder set pending that asset, built with `monotonicPalette()` so
 * they satisfy the hard luminance-monotonicity requirement (§6.2, T-C01)
 * regardless of the exact hue chosen.
 */
export interface PaletteDef {
  freq: [number, number, number];
  phase: [number, number, number];
}

const REC709 = [0.2126, 0.7152, 0.0722] as const;

/**
 * Build a palette whose three channels share one frequency `freq` (≤ 0.5,
 * so x∈[0,1] spans at most half a period) with per-channel hue offsets, then
 * solve the shared base phase so the Rec.709-weighted luminance sum peaks
 * exactly at x=0 — making luminance(x) a single monotonically-decreasing
 * cosine half-cycle across the whole domain by construction.
 */
export function monotonicPalette(freq: number, hueOffsets: [number, number, number]): PaletteDef {
  // Phasor sum of the three weighted unit vectors at their hue offsets.
  let re = 0;
  let im = 0;
  for (let i = 0; i < 3; i++) {
    const w = REC709[i] as number;
    const angle = 2 * Math.PI * (hueOffsets[i] as number);
    re += w * Math.cos(angle);
    im += w * Math.sin(angle);
  }
  const resultantPhase = Math.atan2(im, re) / (2 * Math.PI);
  const base = -resultantPhase;
  const phase = hueOffsets.map((h) => base + h) as [number, number, number];
  return { freq: [freq, freq, freq], phase };
}

export const AURORA_PALETTE: PaletteDef = monotonicPalette(0.05, [0.0, 0.2, -0.2]);
export const ABYSS_PALETTE: PaletteDef = monotonicPalette(0.05, [0.0, 0.28, -0.08]);
export const DAWN_PALETTE: PaletteDef = monotonicPalette(0.05, [0.0, -0.24, 0.12]);

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
