import { describe, expect, it } from 'vitest';
import { evalField, projectCluster, squaredDistance } from '../../src/math/project';
import type { GeneratedCluster } from '../../src/math/cluster';

describe('T-M07 projected distance correctness', () => {
  it('matches a hand-computed Mahalanobis squared distance under identity projection', () => {
    const sigma = [
      [2, 0.5],
      [0.5, 1],
    ];
    const cluster: GeneratedCluster = { mu: [0, 0], sigma, amp: 1 };
    const u = [1, 0];
    const v = [0, 1];

    const proj = projectCluster(cluster, u, v);

    // Manual inverse of a 2x2 symmetric matrix.
    const [[s00, s01], [s10, s11]] = sigma as [[number, number], [number, number]];
    const det = s00 * s11 - s01 * s10;
    const invA = s11 / det;
    const invB = -s01 / det;
    const invC = s00 / det;

    const p: [number, number] = [1, 0.4];
    const manualD2 = invA * p[0] * p[0] + 2 * invB * p[0] * p[1] + invC * p[1] * p[1];

    expect(squaredDistance(p, proj)).toBeCloseTo(manualD2, 9);
  });
});

describe('T-M08 soft-min convergence', () => {
  it('approaches the analytic Mahalanobis distance as tau -> 0.1 for a single cluster', () => {
    const sigma = [
      [1.6, 0.2],
      [0.2, 0.9],
    ];
    const cluster: GeneratedCluster = { mu: [0.3, -0.2], sigma, amp: 1 };
    const u = [1, 0];
    const v = [0, 1];
    const proj = projectCluster(cluster, u, v);

    const tau = 0.1;
    // At tau's floor, D(p) = sqrt(d2 + tau*ln(2.2)) only tracks sqrt(d2) while
    // s = exp(-d2/tau) stays clear of the 1e-6 log-safety floor (spec §4.9);
    // d2 just inside that boundary is where the soft-min is tightest against
    // the hard analytic distance.
    const d2Target = 1.3;
    const dx = Math.sqrt(d2Target / proj.a); // squaredDistance(p, proj) = a*dx^2 when dy=0
    const p: [number, number] = [proj.m[0] + dx, proj.m[1]];
    const d2 = squaredDistance(p, proj);
    const analytic = Math.sqrt(d2);

    const { D } = evalField(p, [proj], [1], tau);

    expect(Math.abs(D - analytic) / analytic).toBeLessThan(0.05);
  });
});
