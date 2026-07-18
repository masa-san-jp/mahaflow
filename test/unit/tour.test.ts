import { describe, expect, it } from 'vitest';
import { tourBasis } from '../../src/math/tour';

function norm(v: number[]): number {
  return Math.sqrt(v.reduce((s, x) => s + x * x, 0));
}

function dot(a: number[], b: number[]): number {
  return a.reduce((s, x, i) => s + x * (b[i] as number), 0);
}

describe('T-M06 tour orthonormality', () => {
  it('u, v, w stay unit-length and mutually orthogonal for any t', () => {
    for (const t of [0, 0.01, 1, 3.7, 100, -42, 1234.5678]) {
      const { u, v, w } = tourBasis(t, 8);
      expect(Math.abs(norm(u) - 1)).toBeLessThan(1e-9);
      expect(Math.abs(norm(v) - 1)).toBeLessThan(1e-9);
      expect(Math.abs(norm(w) - 1)).toBeLessThan(1e-9);
      expect(Math.abs(dot(u, v))).toBeLessThan(1e-9);
      expect(Math.abs(dot(u, w))).toBeLessThan(1e-9);
      expect(Math.abs(dot(v, w))).toBeLessThan(1e-9);
    }
  });
});
