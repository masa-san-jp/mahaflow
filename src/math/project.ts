import { quadForm } from './linalg';
import type { GeneratedCluster } from './cluster';

/** A cluster projected onto the current 2D tour plane (design spec §4.5). */
export interface ProjCluster {
  m: [number, number];
  a: number;
  b: number;
  c: number;
}

const DET_MIN = 1e-5;
const S_MIN = 1e-6;

export function projectCluster(cluster: GeneratedCluster, u: number[], v: number[]): ProjCluster {
  const m: [number, number] = [dotN(u, cluster.mu), dotN(v, cluster.mu)];
  const suu = quadForm(cluster.sigma, u, u);
  const suv = quadForm(cluster.sigma, u, v);
  const svv = quadForm(cluster.sigma, v, v);
  const det = Math.max(suu * svv - suv * suv, DET_MIN);
  return { m, a: svv / det, b: -suv / det, c: suu / det };
}

function dotN(a: number[], b: number[]): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += (a[i] as number) * (b[i] as number);
  return s;
}

export function squaredDistance(p: [number, number], proj: ProjCluster): number {
  const dx = p[0] - proj.m[0];
  const dy = p[1] - proj.m[1];
  return proj.a * dx * dx + 2 * proj.b * dx * dy + proj.c * dy * dy;
}

/** Forward 2x2 covariance recovered from a projected cluster's precision matrix (design spec §4.7 particle spawning needs Σ, not Σ⁻¹). */
export function covariance2x2(proj: ProjCluster): { Suu: number; Suv: number; Svv: number } {
  const det = proj.a * proj.c - proj.b * proj.b;
  const safeDet = Math.abs(det) < 1e-9 ? (det < 0 ? -1e-9 : 1e-9) : det;
  return { Suu: proj.c / safeDet, Suv: -proj.b / safeDet, Svv: proj.a / safeDet };
}

export interface FieldSample {
  D: number;
  s: number;
}

/** Mixture density and soft-min composite distance D(p) (spec §4.5). */
export function evalField(
  p: [number, number],
  projected: ProjCluster[],
  amps: number[],
  tau: number,
): FieldSample {
  let s = 0;
  for (let i = 0; i < projected.length; i++) {
    const d2 = squaredDistance(p, projected[i] as ProjCluster);
    s += (amps[i] as number) * Math.exp(-d2 / tau);
  }
  const D = Math.sqrt(Math.max(-tau * Math.log(Math.max(s, S_MIN)) + tau * Math.log(2.2), 0));
  return { D, s };
}

/** Gradient of the composite field, weighted by per-cluster responsibility (spec §4.5). */
export function gradD(
  p: [number, number],
  projected: ProjCluster[],
  amps: number[],
  tau: number,
): [number, number] {
  let s = 0;
  let gx = 0;
  let gy = 0;
  for (let i = 0; i < projected.length; i++) {
    const proj = projected[i] as ProjCluster;
    const dx = p[0] - proj.m[0];
    const dy = p[1] - proj.m[1];
    const d2 = proj.a * dx * dx + 2 * proj.b * dx * dy + proj.c * dy * dy;
    const w = (amps[i] as number) * Math.exp(-d2 / tau);
    s += w;
    const grad2x = 2 * (proj.a * dx + proj.b * dy);
    const grad2y = 2 * (proj.b * dx + proj.c * dy);
    gx += w * grad2x;
    gy += w * grad2y;
  }
  const denom = Math.max(s, S_MIN);
  return [gx / denom, gy / denom];
}

/**
 * Interference-wave term (design spec §4.5): wave(p) = Σ ampᵢ·sin(6.5·dᵢ − 1.9t)·exp(−0.42·dᵢ),
 * dᵢ = √d²ᵢ. Drives the field-view "wave" mode's color modulation.
 */
export function evalWave(
  p: [number, number],
  projected: ProjCluster[],
  amps: number[],
  t: number,
): number {
  let wave = 0;
  for (let i = 0; i < projected.length; i++) {
    const d2 = squaredDistance(p, projected[i] as ProjCluster);
    const d = Math.sqrt(d2);
    wave += (amps[i] as number) * Math.sin(6.5 * d - 1.9 * t) * Math.exp(-0.42 * d);
  }
  return wave;
}
