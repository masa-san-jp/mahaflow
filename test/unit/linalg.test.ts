import { describe, expect, it } from 'vitest';
import { jacobiEigenSymmetric, nearestPositiveDefinite, selfOuter } from '../../src/math/linalg';

function matMul(a: number[][], b: number[][]): number[][] {
  const n = a.length;
  const m = b[0]!.length;
  const k = b.length;
  return Array.from({ length: n }, (_, i) =>
    Array.from({ length: m }, (_, j) => {
      let s = 0;
      for (let t = 0; t < k; t++) s += a[i]![t]! * b[t]![j]!;
      return s;
    }),
  );
}

function transpose(a: number[][]): number[][] {
  return a[0]!.map((_, j) => a.map((row) => row[j] as number));
}

describe('jacobiEigenSymmetric', () => {
  it('reconstructs a known symmetric matrix as V diag(values) V^T', () => {
    const m = [
      [4, 1, 0],
      [1, 3, 1],
      [0, 1, 2],
    ];
    const { values, vectors } = jacobiEigenSymmetric(m);
    expect(values).toHaveLength(3);

    const diag = values.map((v, i) => values.map((_, j) => (i === j ? v : 0)));
    const reconstructed = matMul(matMul(vectors, diag), transpose(vectors));
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        expect(reconstructed[i]![j]).toBeCloseTo(m[i]![j] as number, 9);
      }
    }
  });

  it('finds all-positive eigenvalues for a random positive-definite matrix', () => {
    const a = [
      [1, 0.2, -0.1],
      [0.4, 1, 0.3],
      [-0.2, 0.1, 1],
    ];
    const spd = selfOuter(a).map((row, i) => row.map((v, j) => v + (i === j ? 0.1 : 0)));
    const { values } = jacobiEigenSymmetric(spd);
    for (const v of values) expect(v).toBeGreaterThan(0);
  });
});

describe('nearestPositiveDefinite', () => {
  it('leaves an already positive-definite matrix (nearly) unchanged', () => {
    const spd = [
      [2, 0.3],
      [0.3, 1.5],
    ];
    const { sigma, wasClipped } = nearestPositiveDefinite(spd);
    expect(wasClipped).toBe(false);
    expect(sigma[0]![0]).toBeCloseTo(2, 9);
    expect(sigma[1]![1]).toBeCloseTo(1.5, 9);
    expect(sigma[0]![1]).toBeCloseTo(0.3, 9);
  });

  it('clips a negative-eigenvalue matrix to positive-definite', () => {
    const notPD = [
      [1, 2],
      [2, 1],
    ]; // eigenvalues 3, -1
    const { sigma, wasClipped, minEigenvalue } = nearestPositiveDefinite(notPD, 1e-6);
    expect(wasClipped).toBe(true);
    expect(minEigenvalue).toBeCloseTo(-1, 6);
    const { values } = jacobiEigenSymmetric(sigma);
    for (const v of values) expect(v).toBeGreaterThanOrEqual(1e-6 - 1e-9);
  });

  it('symmetrizes an asymmetric input', () => {
    const asym = [
      [2, 0],
      [1, 2],
    ];
    const { sigma } = nearestPositiveDefinite(asym);
    expect(sigma[0]![1]).toBeCloseTo(sigma[1]![0] as number, 9);
  });
});
