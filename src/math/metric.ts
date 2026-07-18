import { projectCluster, type ProjCluster } from './project';
import type { GeneratedCluster } from './cluster';

/**
 * Distance-metric abstraction (design spec §10). The core/shader depend
 * only on this contract; swapping in a non-Mahalanobis metric later
 * shouldn't require touching the mixture/soft-min pipeline. Only the
 * Mahalanobis implementation ships in this repo (per spec, additional
 * metrics are out of scope for the initial version).
 */
export interface Metric {
  id: string;
  /** GLSL fragment implementing this metric's per-cluster d²/gradient, meant to be spliced into the field shader. */
  glslChunk: string;
  /** Per-cluster squared distance and its gradient at point `p` (JS reference, must match `glslChunk` pointwise). */
  jsEval(p: [number, number], proj: ProjCluster): { d2: number; grad: [number, number] };
  /** Project an n-dimensional cluster onto the current 2D tour plane into this metric's per-cluster uniform representation. */
  projectParams(cluster: GeneratedCluster, u: number[], v: number[]): ProjCluster;
}

/**
 * GLSL functions matching `mahalanobisMetric.jsEval` exactly, for pointwise
 * cross-checking (T-M11) and eventual chunk-injection into the field
 * shader (render/fieldView.ts currently inlines the same formulas directly
 * rather than splicing this chunk in — wiring that through is a follow-up).
 */
export const mahalanobisGlslChunk = /* glsl */ `
  float metric_d2(vec2 p, vec2 m, vec3 abc) {
    vec2 d = p - m;
    return abc.x * d.x * d.x + 2.0 * abc.y * d.x * d.y + abc.z * d.y * d.y;
  }

  vec2 metric_grad(vec2 p, vec2 m, vec3 abc) {
    vec2 d = p - m;
    return 2.0 * vec2(abc.x * d.x + abc.y * d.y, abc.y * d.x + abc.z * d.y);
  }
`;

export const mahalanobisMetric: Metric = {
  id: 'mahalanobis',
  glslChunk: mahalanobisGlslChunk,
  jsEval(p, proj) {
    const dx = p[0] - proj.m[0];
    const dy = p[1] - proj.m[1];
    const d2 = proj.a * dx * dx + 2 * proj.b * dx * dy + proj.c * dy * dy;
    const grad: [number, number] = [2 * (proj.a * dx + proj.b * dy), 2 * (proj.b * dx + proj.c * dy)];
    return { d2, grad };
  },
  projectParams: projectCluster,
};
