/** Minimal dense linear-algebra helpers used across math/*. */

export function dot(a: number[], b: number[]): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += (a[i] as number) * (b[i] as number);
  return s;
}

/** y = M x, where M is stored row-major as number[][]. */
export function matVec(m: number[][], x: number[]): number[] {
  return m.map((row) => dot(row, x));
}

/** M = A * A^T for an n x n matrix A. */
export function selfOuter(a: number[][]): number[][] {
  const n = a.length;
  const out: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      out[i]![j] = dot(a[i] as number[], a[j] as number[]);
    }
  }
  return out;
}

export function addScaledIdentity(m: number[][], eps: number): number[][] {
  return m.map((row, i) => row.map((v, j) => (i === j ? v + eps : v)));
}

/** u^T M v for symmetric M. */
export function quadForm(m: number[][], u: number[], v: number[]): number {
  return dot(u, matVec(m, v));
}

/**
 * Lower-triangular Cholesky factor of a symmetric matrix, or null if it is
 * not positive definite. Also returns the smallest diagonal pivot seen,
 * useful as a cheap positive-definiteness probe in tests.
 */
export function cholesky(m: number[][]): { L: number[][]; minPivot: number } | null {
  const n = m.length;
  const L: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));
  let minPivot = Infinity;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j <= i; j++) {
      let sum = (m[i]?.[j] as number) ?? 0;
      for (let k = 0; k < j; k++) sum -= (L[i]?.[k] as number) * (L[j]?.[k] as number);
      if (i === j) {
        if (sum <= 0) return null;
        minPivot = Math.min(minPivot, sum);
        (L[i] as number[])[j] = Math.sqrt(sum);
      } else {
        (L[i] as number[])[j] = sum / (L[j]?.[j] as number);
      }
    }
  }
  return { L, minPivot };
}
