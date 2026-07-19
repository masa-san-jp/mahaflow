import type { PaletteDef } from './palettes';

const TWO_PI = 2 * Math.PI;
const REC709 = [0.2126, 0.7152, 0.0722] as const;

export function paletteColor(p: PaletteDef, x: number): [number, number, number] {
  return [0, 1, 2].map(
    (i) => 0.5 + 0.5 * Math.cos(TWO_PI * ((p.freq[i] as number) * x + (p.phase[i] as number))),
  ) as [number, number, number];
}

/** CIE-style relative luminance (Rec.709 coefficients) of an RGB triple in [0,1]. */
export function relativeLuminance([r, g, b]: [number, number, number]): number {
  return REC709[0] * r + REC709[1] * g + REC709[2] * b;
}

/**
 * Simplified protanopia/deuteranopia simulation matrices (Brettel/Viénot-style
 * linear RGB approximation), used to check that distance ordering survives
 * common color-vision deficiencies (design spec §6.2 T-C02).
 */
export const PROTANOPIA_MATRIX: readonly (readonly number[])[] = [
  [0.567, 0.433, 0.0],
  [0.558, 0.442, 0.0],
  [0.0, 0.242, 0.758],
];
export const DEUTERANOPIA_MATRIX: readonly (readonly number[])[] = [
  [0.625, 0.375, 0.0],
  [0.7, 0.3, 0.0],
  [0.0, 0.3, 0.7],
];

export function applyColorMatrix(m: readonly (readonly number[])[], [r, g, b]: [number, number, number]): [number, number, number] {
  return [
    (m[0]?.[0] as number) * r + (m[0]?.[1] as number) * g + (m[0]?.[2] as number) * b,
    (m[1]?.[0] as number) * r + (m[1]?.[1] as number) * g + (m[1]?.[2] as number) * b,
    (m[2]?.[0] as number) * r + (m[2]?.[1] as number) * g + (m[2]?.[2] as number) * b,
  ];
}

export function luminanceCurve(
  palette: PaletteDef,
  samples = 256,
  matrix?: readonly (readonly number[])[],
): number[] {
  return Array.from({ length: samples }, (_, i) => {
    const x = i / (samples - 1);
    const color = paletteColor(palette, x);
    return relativeLuminance(matrix ? applyColorMatrix(matrix, color) : color);
  });
}

/** True if `values` is entirely non-decreasing or entirely non-increasing (no reversals). */
export function isMonotonic(values: number[]): boolean {
  const increasing = values.every((v, i) => i === 0 || v >= (values[i - 1] as number));
  const decreasing = values.every((v, i) => i === 0 || v <= (values[i - 1] as number));
  return increasing || decreasing;
}
