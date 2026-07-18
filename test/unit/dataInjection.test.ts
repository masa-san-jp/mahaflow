import { describe, expect, it } from 'vitest';
import { injectClusterInputs } from '../../src/math/dataInjection';
import { generateClusters } from '../../src/math/cluster';
import { projectCluster } from '../../src/math/project';
import { tourBasis } from '../../src/math/tour';
import { jacobiEigenSymmetric } from '../../src/math/linalg';

describe('T-A10 dimension mismatch', () => {
  it('throws synchronously when mu length does not match dims', () => {
    const mu = [0, 0, 0, 0, 0, 0]; // 6, not 8
    const sigma = Array.from({ length: 8 }, (_, i) => Array.from({ length: 8 }, (_, j) => (i === j ? 1 : 0)));
    expect(() => injectClusterInputs([{ mu, sigma }], 8)).toThrow();
  });

  it('throws when sigma is not dims x dims', () => {
    const mu = new Array(8).fill(0);
    const sigma = Array.from({ length: 6 }, () => new Array(6).fill(0));
    expect(() => injectClusterInputs([{ mu, sigma }], 8)).toThrow();
  });
});

describe('T-M12 non-positive-definite sigma is clipped with a warning', () => {
  it('clips eigenvalues and warns by default', () => {
    const mu = [0, 0];
    const sigma = [
      [1, 2],
      [2, 1],
    ]; // eigenvalues 3, -1: not PD
    const { clusters, warnings } = injectClusterInputs([{ mu, sigma }], 2);

    expect(warnings.some((w) => w.code === 'non-positive-definite-clipped')).toBe(true);
    const { values } = jacobiEigenSymmetric(clusters[0]!.sigma);
    for (const v of values) expect(v).toBeGreaterThan(0);
  });

  it('throws instead of clipping in strict mode', () => {
    const mu = [0, 0];
    const sigma = [
      [1, 2],
      [2, 1],
    ];
    expect(() => injectClusterInputs([{ mu, sigma }], 2, { strict: true })).toThrow();
  });

  it('an already positive-definite sigma passes through without warning', () => {
    const mu = [0, 0];
    const sigma = [
      [2, 0.1],
      [0.1, 1.5],
    ];
    const { warnings } = injectClusterInputs([{ mu, sigma }], 2);
    expect(warnings).toHaveLength(0);
  });
});

describe('T-M13 re-injecting generated clusters follows the same path', () => {
  it('produces identical projected distances to the originally generated clusters', () => {
    const generated = generateClusters(11, 6, 3);
    const reinjected = injectClusterInputs(
      generated.map((c) => ({ mu: c.mu, sigma: c.sigma, amp: c.amp })),
      6,
    ).clusters;

    const basis = tourBasis(0.9, 6);
    for (let i = 0; i < generated.length; i++) {
      const a = projectCluster(generated[i]!, basis.u, basis.v);
      const b = projectCluster(reinjected[i]!, basis.u, basis.v);
      // Reconstructing sigma through the eigendecomposition (nearestPositiveDefinite)
      // introduces small floating-point error relative to the original.
      expect(b.m[0]).toBeCloseTo(a.m[0], 9);
      expect(b.m[1]).toBeCloseTo(a.m[1], 9);
      expect(b.a).toBeCloseTo(a.a, 6);
      expect(b.b).toBeCloseTo(a.b, 6);
      expect(b.c).toBeCloseTo(a.c, 6);
    }
  });
});
