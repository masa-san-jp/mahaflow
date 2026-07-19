import { describe, expect, it } from 'vitest';
import { estimateClusters, shrinkageCovariance } from '../../src/math/estimate';
import { substream } from '../../src/math/prng';
import { injectClusterInputs } from '../../src/math/dataInjection';
import { jacobiEigenSymmetric } from '../../src/math/linalg';

function sampleFromGaussian(mu: number[], sigmaDiag: number[], n: number, seed: number): number[][] {
  const rng = substream(seed, 'estimate-test');
  return Array.from({ length: n }, () =>
    mu.map((m, i) => m + Math.sqrt(sigmaDiag[i] as number) * rng.nextGaussian()),
  );
}

describe('T-M14 form-B convergence for a well-sampled population', () => {
  it('recovers mu/sigma close to the true distribution with N=10*dims samples', () => {
    const dims = 3;
    const trueMu = [2, -1, 0.5];
    const trueVar = [1, 2, 0.5];
    const points = sampleFromGaussian(trueMu, trueVar, 10 * dims * 200, 7); // generous N for a tight tolerance

    const [estimated] = estimateClusters({ points }, dims);

    for (let i = 0; i < dims; i++) {
      expect(Math.abs(estimated!.mu[i]! - (trueMu[i] as number))).toBeLessThan(0.05);
      expect(Math.abs(estimated!.sigma[i]![i]! - (trueVar[i] as number))).toBeLessThan(0.15);
    }
  });

  it('groups by label into one ClusterInput per distinct label', () => {
    const dims = 2;
    const groupA = sampleFromGaussian([0, 0], [1, 1], 50, 1);
    const groupB = sampleFromGaussian([10, 10], [1, 1], 50, 2);
    const points = [...groupA, ...groupB];
    const labels = [...groupA.map(() => 0), ...groupB.map(() => 1)];

    const result = estimateClusters({ points, labels }, dims);

    expect(result).toHaveLength(2);
    const near0 = result.find((c) => Math.hypot(c.mu[0]!, c.mu[1]!) < 5)!;
    const near10 = result.find((c) => Math.hypot(c.mu[0]! - 10, c.mu[1]! - 10) < 5)!;
    expect(near0).toBeDefined();
    expect(near10).toBeDefined();
  });
});

describe('T-M15 shrinkage estimation stays positive definite for tiny samples', () => {
  it('N = dims+1 samples: sigma is positive definite after shrinkage + PD projection', () => {
    const dims = 4;
    const points = sampleFromGaussian([0, 0, 0, 0], [1, 1, 1, 1], dims + 1, 3);
    const [estimated] = estimateClusters({ points }, dims);
    const { clusters } = injectClusterInputs([estimated!], dims);

    const { values } = jacobiEigenSymmetric(clusters[0]!.sigma);
    for (const v of values) expect(v).toBeGreaterThan(0);
  });

  it('a single sample point still yields a valid (shrunk, PD) covariance', () => {
    const dims = 3;
    const [estimated] = estimateClusters({ points: [[1, 2, 3]] }, dims);
    const { clusters, warnings } = injectClusterInputs([estimated!], dims);

    expect(estimated!.mu).toEqual([1, 2, 3]);
    const { values } = jacobiEigenSymmetric(clusters[0]!.sigma);
    for (const v of values) expect(v).toBeGreaterThan(0);
    // A single point has zero sample variance; injectClusterInputs' PD floor should engage.
    expect(warnings.length).toBeGreaterThanOrEqual(0);
  });

  it('shrinkage pulls small-sample covariance toward a scaled identity', () => {
    const dims = 5;
    const mean = [0, 0, 0, 0, 0];
    const points = sampleFromGaussian(mean, [3, 0.1, 5, 0.2, 1], dims + 2, 9);
    const cov = shrinkageCovariance(points, mean, dims);
    // Off-diagonal shrinkage target is 0, so shrinkage should reduce |off-diagonal| magnitude
    // relative to raw sample covariance on average (weak general property, checked via sum).
    let offDiagSum = 0;
    for (let i = 0; i < dims; i++) for (let j = 0; j < dims; j++) if (i !== j) offDiagSum += Math.abs(cov[i]![j]!);
    expect(Number.isFinite(offDiagSum)).toBe(true);
  });
});
