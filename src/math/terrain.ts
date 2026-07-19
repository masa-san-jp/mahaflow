import { evalField, evalWave, type ProjCluster } from './project';
import type { Mode, Terrain } from '../core/config';

/**
 * Deterministic 4-octave value-noise-like function driving the terrain's
 * common "ゆらぎ" term (design spec §4.8's `fbm`). This repo has no access
 * to the mockup's exact noise implementation, so this is a documented
 * placeholder: smooth, deterministic, and bounded to [0,1].
 */
export function fbm(x: number, y: number): number {
  let value = 0;
  let amp = 0.5;
  let fx = x;
  let fy = y;
  for (let i = 0; i < 4; i++) {
    value += amp * (Math.sin(fx * 1.7 + Math.cos(fy * 1.3)) * 0.5 + 0.5);
    fx *= 2.03;
    fy *= 2.03;
    amp *= 0.5;
  }
  return value;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

/** Orbit-view terrain height at field-space point `p` (design spec §4.8). */
export function terrainHeight(
  p: [number, number],
  projected: ProjCluster[],
  amps: number[],
  tau: number,
  t: number,
  terrain: Terrain,
  mode: Mode,
  flow: number,
): number {
  const { D, s } = evalField(p, projected, amps, tau);
  let h = terrain === 1 ? 2.9 * (1 - Math.exp(-0.42 * D)) : (2.3 * s) / (s + 1.1);

  if (mode === 1) {
    const wave = evalWave(p, projected, amps, t);
    h += 0.22 * clamp(wave, -2.2, 2.2) * (0.25 + 0.75 * Math.exp(-0.28 * D));
  } else if (mode === 2) {
    const frac = D * 3 - Math.floor(D * 3);
    const ridge = 1 - Math.abs(frac - 0.5) * 2;
    h += 0.2 * ridge ** 3 * Math.exp(-0.35 * D);
  }

  h += 0.12 * flow * (fbm(1.4 * p[0] + 0.15 * t, 1.4 * p[1] + 0.15 * t) - 0.5);
  return h;
}

/** Projection-floor isoline intensity in [0,1] at field-space point `p` (design spec §4.8, y=-0.55 floor). */
export function floorIsoline(p: [number, number], projected: ProjCluster[], amps: number[], tau: number): number {
  const { D } = evalField(p, projected, amps, tau);
  const frac = D * 2.2 - Math.floor(D * 2.2);
  return frac;
}
