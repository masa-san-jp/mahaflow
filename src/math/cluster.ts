import { substream } from './prng';
import { addScaledIdentity, selfOuter } from './linalg';

export interface GeneratedCluster {
  mu: number[];
  sigma: number[][];
  /** The anisotropy-scaled matrix A with sigma = A·Aᵀ + εI. Point-cloud sampling (§4.6) draws x = mu + A·z directly from it. */
  a: number[][];
  amp: number;
}

export interface ClusterGenOptions {
  spread?: number;
  anisotropy?: number;
  eps?: number;
}

export const CLUSTER_DEFAULTS = { spread: 1.15, anisotropy: 0.42, eps: 0.05 };

/**
 * Seed-derived raw Gaussian components, independent of `spread`/`anisotropy`.
 * These are the only PRNG-consuming values (design spec §4.3); `spread` and
 * `anisotropy` are live parameters (§5 LiveParams) applied afterwards as a
 * cheap scalar rescale, so changing them never perturbs the PRNG stream or
 * requires re-drawing samples.
 */
export interface RawClusterSeeds {
  zMu: number[][];
  zA: number[][][];
  ampBase: number[];
}

/** Draw the raw per-cluster Gaussian components for `maxClusters` clusters in `dims` dimensions. */
export function generateRawClusters(seed: number, dims: number, maxClusters: number): RawClusterSeeds {
  const rng = substream(seed, 'clusters');
  const zMu: number[][] = [];
  const zA: number[][][] = [];
  const ampBase: number[] = [];

  for (let k = 0; k < maxClusters; k++) {
    zMu.push(Array.from({ length: dims }, () => rng.nextGaussian()));
    zA.push(
      Array.from({ length: dims }, () => Array.from({ length: dims }, () => rng.nextGaussian())),
    );
    ampBase.push(0.65 + 0.7 * rng.next());
  }

  return { zMu, zA, ampBase };
}

/** Rescale raw seeds by the live spread/anisotropy parameters and center the mixture. */
export function buildClusters(
  raw: RawClusterSeeds,
  spread: number,
  anisotropy: number,
  eps: number = CLUSTER_DEFAULTS.eps,
): GeneratedCluster[] {
  const clusters = raw.zMu.map((zMu, i): GeneratedCluster => {
    const mu = zMu.map((v) => spread * v);
    const a = (raw.zA[i] as number[][]).map((row) => row.map((v) => anisotropy * v));
    const sigma = addScaledIdentity(selfOuter(a), eps);
    return { mu, sigma, a, amp: raw.ampBase[i] as number };
  });
  return centerClusters(clusters);
}

/**
 * Generate `maxClusters` Gaussian components in `dims`-dimensional space
 * (design spec §4.3). All maxClusters are always generated and centered
 * together so that shrinking `clusterCount` never reshuffles the visible
 * subset. Convenience wrapper over generateRawClusters + buildClusters for
 * one-shot (non-live) use.
 */
export function generateClusters(
  seed: number,
  dims: number,
  maxClusters: number,
  opts: ClusterGenOptions = {},
): GeneratedCluster[] {
  const raw = generateRawClusters(seed, dims, maxClusters);
  return buildClusters(
    raw,
    opts.spread ?? CLUSTER_DEFAULTS.spread,
    opts.anisotropy ?? CLUSTER_DEFAULTS.anisotropy,
    opts.eps ?? CLUSTER_DEFAULTS.eps,
  );
}

/** Subtract the centroid of all cluster means so the mixture is centered at the origin. */
export function centerClusters(clusters: GeneratedCluster[]): GeneratedCluster[] {
  const dims = clusters[0]?.mu.length ?? 0;
  const centroid = new Array(dims).fill(0);
  for (const c of clusters) {
    for (let i = 0; i < dims; i++) centroid[i] += (c.mu[i] as number) / clusters.length;
  }
  return clusters.map((c) => ({
    ...c,
    mu: c.mu.map((v, i) => v - centroid[i]),
  }));
}
