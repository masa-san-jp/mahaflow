import { centerClusters, type GeneratedCluster } from './cluster';
import { cholesky, nearestPositiveDefinite, symmetrize } from './linalg';

/** Structurally identical to core/config.ts's Warning; duplicated here so math/* stays independent of core/*. */
export interface Warning {
  code: string;
  message: string;
}

/** Form A: direct μ/Σ input (design spec §9.1). */
export interface ClusterInput {
  mu: number[];
  sigma: number[][];
  amp?: number;
}

export interface InjectOptions {
  /** Throw instead of clip+warn on a non-positive-definite sigma. */
  strict?: boolean;
}

export interface InjectResult {
  clusters: GeneratedCluster[];
  warnings: Warning[];
}

const PD_EPS_FLOOR = 1e-6;

/**
 * Validate and normalize form-A cluster inputs into the same
 * `GeneratedCluster` shape (mu/sigma/a/amp) generation produces, so the
 * centering/projection/distance path downstream is identical either way
 * (design spec §9.1). Dimension mismatches throw synchronously (T-A10);
 * non-positive-definite sigma is eigenvalue-clipped to the nearest PD
 * matrix with a warning, or throws in `strict` mode.
 */
export function injectClusterInputs(inputs: ClusterInput[], dims: number, opts: InjectOptions = {}): InjectResult {
  const warnings: Warning[] = [];

  const clusters = inputs.map((input, index): GeneratedCluster => {
    if (input.mu.length !== dims) {
      throw new Error(`ClusterInput[${index}].mu has length ${input.mu.length}, expected dims=${dims}`);
    }
    if (input.sigma.length !== dims || input.sigma.some((row) => row.length !== dims)) {
      throw new Error(`ClusterInput[${index}].sigma must be ${dims}x${dims}`);
    }

    const symmetric = symmetrize(input.sigma);
    const { sigma, wasClipped } = nearestPositiveDefinite(symmetric, PD_EPS_FLOOR);

    if (wasClipped) {
      if (opts.strict) {
        throw new Error(`ClusterInput[${index}].sigma is not positive definite (strict mode)`);
      }
      warnings.push({
        code: 'non-positive-definite-clipped',
        message: `ClusterInput[${index}].sigma was not positive definite; eigenvalues clipped to the nearest PD matrix.`,
      });
    }

    // sigma is now guaranteed PD, so Cholesky always succeeds; used as the
    // "A" matrix so point-cloud sampling (x = mu + A·z, §4.6) works the same
    // as for generated clusters.
    const chol = cholesky(sigma);
    const a = chol ? chol.L : sigma.map((row, i) => row.map((v, j) => (i === j ? Math.sqrt(Math.max(v, PD_EPS_FLOOR)) : 0)));

    return { mu: [...input.mu], sigma, a, amp: input.amp ?? 1 };
  });

  return { clusters: centerClusters(clusters), warnings };
}
