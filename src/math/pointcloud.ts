import { substream } from './prng';
import { matVec } from './linalg';
import type { GeneratedCluster } from './cluster';

/** A single orbit-view point-cloud sample (design spec §4.6). */
export interface PointSample {
  /** x = mu + A·z, the full n-dimensional sample. */
  x: number[];
  /** D₈ = ‖z‖, the true (unprojected) Mahalanobis distance the sample was drawn at. */
  trueDistance: number;
  clusterIndex: number;
}

const DEFAULT_SAMPLE_COUNT = 1500;

/**
 * Draw the orbit-view point cloud: z ~ N(0, I)ⁿ, x = μᵢ + Aᵢz, round-robin
 * assigned across `clusters` (design spec §4.6). Deterministic given `seed`
 * and the cluster list; consumes the dedicated 'points' PRNG substream so
 * it never perturbs cluster generation.
 */
export function generatePointCloud(
  seed: number,
  clusters: GeneratedCluster[],
  sampleCount: number = DEFAULT_SAMPLE_COUNT,
): PointSample[] {
  if (clusters.length === 0) return [];
  const rng = substream(seed, 'points');
  const samples: PointSample[] = [];

  for (let i = 0; i < sampleCount; i++) {
    const clusterIndex = i % clusters.length;
    const cluster = clusters[clusterIndex] as GeneratedCluster;
    const dims = cluster.mu.length;
    const z = Array.from({ length: dims }, () => rng.nextGaussian());
    const az = matVec(cluster.a, z);
    const x = cluster.mu.map((m, d) => m + (az[d] as number));
    const trueDistance = Math.sqrt(z.reduce((s, v) => s + v * v, 0));
    samples.push({ x, trueDistance, clusterIndex });
  }

  return samples;
}

/** Orbit-view display coordinates for a sample: (u·x, w·x·0.75 + 1.2, v·x) (design spec §4.6). */
export function pointDisplayPosition(x: number[], u: number[], v: number[], w: number[]): [number, number, number] {
  return [dotN(u, x), dotN(w, x) * 0.75 + 1.2, dotN(v, x)];
}

/** Palette input in [0,1]: brighter/more saturated near the cluster mean (design spec §4.6). */
export function pointPaletteIntensity(trueDistance: number): number {
  return Math.exp(-0.32 * trueDistance) * 0.9 + 0.06;
}

/** Point sprite size in pixels (design spec §4.6). */
export function pointVisualSize(trueDistance: number): number {
  return 2.2 + 2.8 * Math.exp(-0.4 * trueDistance);
}

function dotN(a: number[], b: number[]): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += (a[i] as number) * (b[i] as number);
  return s;
}
