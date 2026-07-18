/**
 * Grand tour: continuously rotating orthonormal projection basis in Rⁿ
 * (design spec §4.4). Composed entirely of Givens rotations, so u, v, w
 * remain exactly orthonormal for any t by construction.
 */

export interface TourBasis {
  u: number[];
  v: number[];
  w: number[];
}

const PLANES: Array<[number, number]> = [
  [0, 2],
  [1, 3],
  [2, 4],
  [3, 5],
  [4, 6],
  [5, 7],
  [0, 7],
  [1, 6],
];

const OMEGA = [0.131, 0.093, 0.171, 0.077, 0.149, 0.107, 0.059, 0.121];

function unitVector(dims: number, axis: number): number[] {
  const v = new Array(dims).fill(0);
  if (axis < dims) v[axis] = 1;
  return v;
}

function givensRotate(vec: number[], i: number, j: number, theta: number): void {
  const cos = Math.cos(theta);
  const sin = Math.sin(theta);
  const vi = vec[i] as number;
  const vj = vec[j] as number;
  vec[i] = cos * vi - sin * vj;
  vec[j] = sin * vi + cos * vj;
}

/**
 * Compute the tour basis at tour-phase `t`. Planes/omegas referencing axes
 * beyond `dims` are skipped (the spec's fixed 8-plane schedule targets the
 * default dims=8; lower-dimensional configs simply see fewer active planes).
 */
export function tourBasis(t: number, dims: number): TourBasis {
  const u = unitVector(dims, 0);
  const v = unitVector(dims, 1);
  const w = unitVector(dims, 2);

  for (let p = 0; p < PLANES.length; p++) {
    const [i, j] = PLANES[p] as [number, number];
    if (i >= dims || j >= dims) continue;
    const theta = (OMEGA[p] as number) * t;
    givensRotate(u, i, j, theta);
    givensRotate(v, i, j, theta);
    givensRotate(w, i, j, theta);
  }

  return { u, v, w };
}
