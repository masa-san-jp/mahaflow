import { describe, expect, it } from 'vitest';
import { generateClusters } from '../../src/math/cluster';
import { cholesky } from '../../src/math/linalg';

describe('T-M04 covariance positive definiteness', () => {
  it('every generated cluster has strictly positive eigenvalues', () => {
    for (let seed = 0; seed < 1000; seed++) {
      const clusters = generateClusters(seed, 8, 4);
      for (const c of clusters) {
        const chol = cholesky(c.sigma);
        expect(chol).not.toBeNull();
        expect(chol!.minPivot).toBeGreaterThan(0);
      }
    }
  });
});

describe('T-M05 centering', () => {
  it('the centroid of generated cluster means is at the origin', () => {
    const clusters = generateClusters(42, 8, 6);
    const dims = 8;
    const centroid = new Array(dims).fill(0);
    for (const c of clusters) {
      for (let i = 0; i < dims; i++) centroid[i] += c.mu[i]! / clusters.length;
    }
    const norm = Math.sqrt(centroid.reduce((s, v) => s + v * v, 0));
    expect(norm).toBeLessThan(1e-9);
  });
});
