import { Prng } from './prng';
import { covariance2x2, evalField, gradD, type ProjCluster } from './project';

/**
 * Field-view particle system reference math (design spec §4.7). Pure
 * functions only — the GPU point-sprite renderer and trail buffer are P2c
 * scope; this module exists so spawn/velocity/lifetime are deterministic
 * and unit-testable ahead of that rendering work.
 */

export interface ParticleSpawn {
  p: [number, number];
  life: number;
}

/**
 * Spawn a particle at cluster `clusterIndex` via the Cholesky factor of its
 * projected 2x2 covariance: p = mᵢ + Lz. Lifetime is uniform in [2.5, 8.0]s.
 */
export function spawnParticle(clusterIndex: number, projected: ProjCluster[], rng: Prng): ParticleSpawn {
  const proj = projected[clusterIndex] as ProjCluster;
  const { Suu, Suv, Svv } = covariance2x2(proj);
  const l11 = Math.sqrt(Math.max(Suu, 1e-9));
  const l21 = Suv / l11;
  const l22 = Math.sqrt(Math.max(Svv - l21 * l21, 1e-9));

  const z1 = rng.nextGaussian();
  const z2 = rng.nextGaussian();
  const dx = l11 * z1;
  const dy = l21 * z1 + l22 * z2;

  return {
    p: [proj.m[0] + dx, proj.m[1] + dy],
    life: 2.5 + 5.5 * rng.next(),
  };
}

/**
 * Deterministic trigonometric curl-noise field driving particle drift.
 * The design spec (§4.7) requires only that it be deterministic; this repo
 * doesn't include the reference mockup that would pin the exact formula, so
 * this is a reasonable placeholder pending that asset (see README).
 */
export function evalCurl(p: [number, number], t: number): [number, number] {
  return [
    Math.sin(1.3 * p[1] + 0.7 * t) * Math.cos(0.9 * p[0] - 0.4 * t),
    Math.cos(1.1 * p[0] - 0.6 * t) * Math.sin(1.7 * p[1] + 0.3 * t),
  ];
}

/** v = -0.10*g + 0.75*exp(-0.35D)*g_perp/‖g‖ + 0.44*flow*curl(p,t) (design spec §4.7). */
export function particleVelocity(
  p: [number, number],
  projected: ProjCluster[],
  amps: number[],
  tau: number,
  t: number,
  flow: number,
): [number, number] {
  const { D } = evalField(p, projected, amps, tau);
  const [gx, gy] = gradD(p, projected, amps, tau);
  const gnorm = Math.max(Math.hypot(gx, gy), 1e-6);
  const perpX = -gy / gnorm;
  const perpY = gx / gnorm;
  const [cx, cy] = evalCurl(p, t);
  const drift = 0.75 * Math.exp(-0.35 * D);
  return [-0.1 * gx + drift * perpX + 0.44 * flow * cx, -0.1 * gy + drift * perpY + 0.44 * flow * cy];
}

/** Respawn condition: escaped the field (D > 4.6) or lifetime elapsed (design spec §4.7). */
export function shouldRespawn(
  p: [number, number],
  projected: ProjCluster[],
  amps: number[],
  tau: number,
  life: number,
  age: number,
): boolean {
  const { D } = evalField(p, projected, amps, tau);
  return D > 4.6 || age >= life;
}
