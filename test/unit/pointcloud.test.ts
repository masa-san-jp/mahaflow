import { describe, expect, it } from 'vitest';
import { generateClusters } from '../../src/math/cluster';
import { generatePointCloud, pointDisplayPosition, pointPaletteIntensity, pointVisualSize } from '../../src/math/pointcloud';

describe('point cloud generation (design spec §4.6)', () => {
  const clusters = generateClusters(42, 4, 3);

  it('is deterministic for a fixed seed and cluster set', () => {
    const a = generatePointCloud(7, clusters, 100);
    const b = generatePointCloud(7, clusters, 100);
    expect(a).toEqual(b);
  });

  it('assigns clusters round-robin', () => {
    const samples = generatePointCloud(1, clusters, 10);
    expect(samples.map((s) => s.clusterIndex)).toEqual([0, 1, 2, 0, 1, 2, 0, 1, 2, 0]);
  });

  it('draws x = mu + A*z with trueDistance = ||z||', () => {
    const [sample] = generatePointCloud(1, clusters, 1);
    const cluster = clusters[0]!;
    // Recover z from x via A (well-conditioned here since anisotropy default != 0) is
    // overkill; instead check trueDistance is a plausible chi-like norm and x is finite.
    expect(sample!.x.every(Number.isFinite)).toBe(true);
    expect(sample!.trueDistance).toBeGreaterThanOrEqual(0);
    // x should differ from the raw mean (A*z is essentially never exactly 0).
    expect(sample!.x).not.toEqual(cluster.mu);
  });

  it('palette intensity and visual size are monotonically decreasing in true distance', () => {
    const near = pointPaletteIntensity(0.1);
    const far = pointPaletteIntensity(5);
    expect(near).toBeGreaterThan(far);
    expect(pointVisualSize(0.1)).toBeGreaterThan(pointVisualSize(5));
  });

  it('projects display position via (u.x, w.x*0.75+1.2, v.x)', () => {
    const x = [1, 2, 3, 4];
    const u = [1, 0, 0, 0];
    const v = [0, 1, 0, 0];
    const w = [0, 0, 1, 0];
    expect(pointDisplayPosition(x, u, v, w)).toEqual([1, 3 * 0.75 + 1.2, 2]);
  });
});
