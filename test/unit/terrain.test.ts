import { describe, expect, it } from 'vitest';
import { fbm, floorIsoline, terrainHeight } from '../../src/math/terrain';
import { generateClusters } from '../../src/math/cluster';
import { projectCluster } from '../../src/math/project';
import { tourBasis } from '../../src/math/tour';

function makeProjected() {
  const clusters = generateClusters(4, 8, 3);
  const basis = tourBasis(0.3, 8);
  return { projected: clusters.map((c) => projectCluster(c, basis.u, basis.v)), amps: clusters.map((c) => c.amp) };
}

describe('fbm', () => {
  it('is deterministic and bounded to [0,1]', () => {
    for (const [x, y] of [[0, 0], [1.3, -2.1], [10, 10]] as [number, number][]) {
      const v = fbm(x, y);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
      expect(fbm(x, y)).toBe(v);
    }
  });
});

describe('terrainHeight (design spec §4.8)', () => {
  it('mountains (terrain=0) peak near a cluster mean and flatten far away', () => {
    const { projected, amps } = makeProjected();
    const tau = 0.85;
    const near: [number, number] = [projected[0]!.m[0], projected[0]!.m[1]];
    const far: [number, number] = [100, 100];

    const hNear = terrainHeight(near, projected, amps, tau, 0, 0, 0, 0);
    const hFar = terrainHeight(far, projected, amps, tau, 0, 0, 0, 0);
    expect(hNear).toBeGreaterThan(hFar);
  });

  it('bowl (terrain=1) is shallow near a cluster mean and deepens with distance', () => {
    const { projected, amps } = makeProjected();
    const tau = 0.85;
    const near: [number, number] = [projected[0]!.m[0], projected[0]!.m[1]];
    const far: [number, number] = [100, 100];

    const hNear = terrainHeight(near, projected, amps, tau, 0, 1, 0, 0);
    const hFar = terrainHeight(far, projected, amps, tau, 0, 1, 0, 0);
    expect(hFar).toBeGreaterThan(hNear);
  });

  it('is finite and deterministic across mode/terrain combinations', () => {
    const { projected, amps } = makeProjected();
    const p: [number, number] = [0.3, -0.2];
    for (const terrain of [0, 1] as const) {
      for (const mode of [0, 1, 2, 3] as const) {
        const a = terrainHeight(p, projected, amps, 0.85, 1.2, terrain, mode, 0.45);
        const b = terrainHeight(p, projected, amps, 0.85, 1.2, terrain, mode, 0.45);
        expect(Number.isFinite(a)).toBe(true);
        expect(a).toBe(b);
      }
    }
  });
});

describe('floorIsoline', () => {
  it('stays within [0,1) and is deterministic', () => {
    const { projected, amps } = makeProjected();
    const p: [number, number] = [1.1, -0.4];
    const v = floorIsoline(p, projected, amps, 0.85);
    expect(v).toBeGreaterThanOrEqual(0);
    expect(v).toBeLessThan(1);
    expect(floorIsoline(p, projected, amps, 0.85)).toBe(v);
  });
});
