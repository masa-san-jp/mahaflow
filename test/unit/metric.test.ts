import { describe, expect, it } from 'vitest';
import { mahalanobisMetric } from '../../src/math/metric';
import { generateClusters } from '../../src/math/cluster';
import { tourBasis } from '../../src/math/tour';
import { projectCluster, squaredDistance, gradD } from '../../src/math/project';

describe('T-M11 Metric contract: mahalanobis jsEval matches the existing math/project.ts reference', () => {
  it('d2 and per-cluster gradient agree across a lattice of points and clusters', () => {
    const clusters = generateClusters(21, 8, 4);
    const basis = tourBasis(1.7, 8);
    const projected = clusters.map((c) => mahalanobisMetric.projectParams(c, basis.u, basis.v));

    for (const proj of projected) {
      for (let gx = -3; gx <= 3; gx++) {
        for (let gy = -3; gy <= 3; gy++) {
          const p: [number, number] = [proj.m[0] + gx * 0.4, proj.m[1] + gy * 0.4];
          const { d2, grad } = mahalanobisMetric.jsEval(p, proj);

          expect(d2).toBeCloseTo(squaredDistance(p, proj), 12);

          // For a single-cluster mixture the weight algebraically cancels
          // (gx = w*grad2x/w = grad2x) regardless of tau, as long as the
          // S_MIN log-safety floor isn't hit — a huge tau guarantees that.
          const [gxRef, gyRef] = gradD(p, [proj], [1], 1e6);
          expect(gxRef).toBeCloseTo(grad[0], 9);
          expect(gyRef).toBeCloseTo(grad[1], 9);
        }
      }
    }
  });

  it('projectParams delegates to projectCluster (same output)', () => {
    const clusters = generateClusters(5, 8, 2);
    const basis = tourBasis(0, 8);
    const viaMetric = mahalanobisMetric.projectParams(clusters[0]!, basis.u, basis.v);
    const direct = projectCluster(clusters[0]!, basis.u, basis.v);
    expect(viaMetric).toEqual(direct);
  });
});
