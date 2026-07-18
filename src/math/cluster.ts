import { substream } from './prng';
import { addScaledIdentity, selfOuter } from './linalg';

export interface GeneratedCluster {
  mu: number[];
  sigma: number[][];
  amp: number;
}

export interface ClusterGenOptions {
  spread?: number;
  anisotropy?: number;
  eps?: number;
}

const DEFAULTS = { spread: 1.15, anisotropy: 0.42, eps: 0.05 };

/**
 * Generate `maxClusters` Gaussian components in `dims`-dimensional space
 * (design spec §4.3). All maxClusters are always generated and centered
 * together so that shrinking `clusterCount` never reshuffles the visible
 * subset.
 */
export function generateClusters(
  seed: number,
  dims: number,
  maxClusters: number,
  opts: ClusterGenOptions = {},
): GeneratedCluster[] {
  const spread = opts.spread ?? DEFAULTS.spread;
  const anisotropy = opts.anisotropy ?? DEFAULTS.anisotropy;
  const eps = opts.eps ?? DEFAULTS.eps;

  const rng = substream(seed, 'clusters');
  const clusters: GeneratedCluster[] = [];

  for (let k = 0; k < maxClusters; k++) {
    const mu = Array.from({ length: dims }, () => spread * rng.nextGaussian());

    const a: number[][] = Array.from({ length: dims }, () =>
      Array.from({ length: dims }, () => anisotropy * rng.nextGaussian()),
    );
    const sigma = addScaledIdentity(selfOuter(a), eps);

    const amp = 0.65 + 0.7 * rng.next();

    clusters.push({ mu, sigma, amp });
  }

  return centerClusters(clusters);
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
