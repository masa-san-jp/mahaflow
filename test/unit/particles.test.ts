import { describe, expect, it } from 'vitest';
import { generateClusters } from '../../src/math/cluster';
import { tourBasis } from '../../src/math/tour';
import { projectCluster } from '../../src/math/project';
import { Prng } from '../../src/math/prng';
import { evalCurl, particleVelocity, shouldRespawn, spawnParticle } from '../../src/math/particles';

function makeProjected() {
  const clusters = generateClusters(3, 8, 3);
  const basis = tourBasis(0.4, 8);
  return clusters.map((c) => projectCluster(c, basis.u, basis.v));
}

describe('particle spawn (design spec §4.7)', () => {
  it('is deterministic for a fixed PRNG state and produces a lifetime in [2.5, 8.0]', () => {
    const projected = makeProjected();
    const a = spawnParticle(0, projected, new Prng(11));
    const b = spawnParticle(0, projected, new Prng(11));
    expect(a).toEqual(b);
    expect(a.life).toBeGreaterThanOrEqual(2.5);
    expect(a.life).toBeLessThanOrEqual(8.0);
    expect(a.p.every(Number.isFinite)).toBe(true);
  });
});

describe('curl field', () => {
  it('is deterministic and bounded (sum of two [-1,1] products)', () => {
    const [cx, cy] = evalCurl([0.5, -0.3], 1.2);
    expect(Math.abs(cx)).toBeLessThanOrEqual(1);
    expect(Math.abs(cy)).toBeLessThanOrEqual(1);
    expect(evalCurl([0.5, -0.3], 1.2)).toEqual(evalCurl([0.5, -0.3], 1.2));
  });
});

describe('particle velocity', () => {
  it('returns finite values and scales with flow', () => {
    const projected = makeProjected();
    const amps = [1, 1, 1];
    const p: [number, number] = [0.2, -0.1];
    const vNoFlow = particleVelocity(p, projected, amps, 0.85, 0.5, 0);
    const vFlow = particleVelocity(p, projected, amps, 0.85, 0.5, 1);
    expect(vNoFlow.every(Number.isFinite)).toBe(true);
    expect(vFlow.every(Number.isFinite)).toBe(true);
    expect(vFlow).not.toEqual(vNoFlow); // flow term contributes when amp>0 curl!=0
  });
});

describe('respawn condition (design spec §4.7)', () => {
  it('triggers when the field distance exceeds 4.6 or the lifetime elapses', () => {
    const projected = makeProjected();
    const amps = [1, 1, 1];
    // D is capped at sqrt(tau*(ln(1/1e-6)+ln(2.2))) by the §4.9 log-safety floor;
    // that cap only clears 4.6 for tau above ~1.45, so use a tau where "far away"
    // is actually reachable rather than default softness (0.85, cap ~3.5).
    const tau = 2.5;
    const farAway: [number, number] = [1000, 1000];
    expect(shouldRespawn(farAway, projected, amps, tau, 8, 1)).toBe(true);

    const nearMean: [number, number] = [projected[0]!.m[0], projected[0]!.m[1]];
    expect(shouldRespawn(nearMean, projected, amps, tau, 5, 6)).toBe(true); // age >= life
    expect(shouldRespawn(nearMean, projected, amps, tau, 5, 1)).toBe(false);
  });
});
