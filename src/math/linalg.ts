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

export function symmetrize(m: number[][]): number[][] {
  const n = m.length;
  return Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) => ((m[i]?.[j] as number) + (m[j]?.[i] as number)) / 2),
  );
}

export interface EigenDecomposition {
  /** Eigenvalues, ascending. */
  values: number[];
  /** Eigenvectors as columns: eigenvectors[i] is the i-th component of every eigenvector. */
  vectors: number[][];
}

/**
 * Classic cyclic Jacobi eigenvalue algorithm for a symmetric matrix.
 * Adequate for the small dims (≤ ~16) this component operates on; not
 * intended for large-scale use.
 */
export function jacobiEigenSymmetric(input: number[][], maxSweeps = 100, tol = 1e-12): EigenDecomposition {
  const n = input.length;
  const a = input.map((row) => [...row]);
  const v: number[][] = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)));

  for (let sweep = 0; sweep < maxSweeps; sweep++) {
    let off = 0;
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) off += (a[i]?.[j] as number) ** 2;
    if (off < tol) break;

    for (let p = 0; p < n; p++) {
      for (let q = p + 1; q < n; q++) {
        const apq = a[p]?.[q] as number;
        if (Math.abs(apq) < 1e-300) continue;
        const app = a[p]?.[p] as number;
        const aqq = a[q]?.[q] as number;
        const phi = 0.5 * Math.atan2(2 * apq, aqq - app);
        const c = Math.cos(phi);
        const s = Math.sin(phi);

        for (let k = 0; k < n; k++) {
          const akp = a[k]?.[p] as number;
          const akq = a[k]?.[q] as number;
          (a[k] as number[])[p] = c * akp - s * akq;
          (a[k] as number[])[q] = s * akp + c * akq;
        }
        for (let k = 0; k < n; k++) {
          const apk = a[p]?.[k] as number;
          const aqk = a[q]?.[k] as number;
          (a[p] as number[])[k] = c * apk - s * aqk;
          (a[q] as number[])[k] = s * apk + c * aqk;
        }
        for (let k = 0; k < n; k++) {
          const vkp = v[k]?.[p] as number;
          const vkq = v[k]?.[q] as number;
          (v[k] as number[])[p] = c * vkp - s * vkq;
          (v[k] as number[])[q] = s * vkp + c * vkq;
        }
      }
    }
  }

  const values = Array.from({ length: n }, (_, i) => a[i]?.[i] as number);
  const order = values.map((_, i) => i).sort((i, j) => (values[i] as number) - (values[j] as number));
  return {
    values: order.map((i) => values[i] as number),
    vectors: Array.from({ length: n }, (_, row) => order.map((i) => v[row]?.[i] as number)),
  };
}

/**
 * Project a symmetric matrix to the nearest positive-definite matrix by
 * clamping its eigenvalues to at least `epsFloor` (design spec §9.1/§4.9).
 */
export function nearestPositiveDefinite(
  m: number[][],
  epsFloor = 1e-6,
): { sigma: number[][]; minEigenvalue: number; wasClipped: boolean } {
  const { values, vectors } = jacobiEigenSymmetric(symmetrize(m));
  const minEigenvalue = Math.min(...values);
  const wasClipped = minEigenvalue < epsFloor;
  const clipped = values.map((lam) => Math.max(lam, epsFloor));

  const n = m.length;
  const sigma: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      let s = 0;
      for (let k = 0; k < n; k++) s += (vectors[i]?.[k] as number) * (clipped[k] as number) * (vectors[j]?.[k] as number);
      (sigma[i] as number[])[j] = s;
    }
  }
  return { sigma: symmetrize(sigma), minEigenvalue, wasClipped };
}
