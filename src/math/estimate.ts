import type { ClusterInput } from './dataInjection';

/** Form B: raw sample input (design spec §9.2). */
export interface RawData {
  points: number[][];
  labels?: number[];
}

const SHRINKAGE_SAMPLE_THRESHOLD_MULTIPLIER = 2;

function sampleMean(points: number[][], dims: number): number[] {
  const mean = new Array(dims).fill(0);
  for (const p of points) for (let i = 0; i < dims; i++) mean[i] += (p[i] as number) / points.length;
  return mean;
}

function sampleCovariance(points: number[][], mean: number[], dims: number): number[][] {
  const cov: number[][] = Array.from({ length: dims }, () => new Array(dims).fill(0));
  const denom = Math.max(points.length - 1, 1);
  for (const p of points) {
    for (let i = 0; i < dims; i++) {
      const row = cov[i] as number[];
      for (let j = 0; j < dims; j++) {
        row[j] = (row[j] as number) + (((p[i] as number) - (mean[i] as number)) * ((p[j] as number) - (mean[j] as number))) / denom;
      }
    }
  }
  return cov;
}

/**
 * Diagonal-shrinkage covariance estimator (design spec §9.2: "縮小推定
 * (対角シュリンク...Ledoit-Wolf系)"). Shrinks toward a scaled-identity
 * target as the sample count falls below 2·dims, so undersampled clusters
 * (as few as a single point) still produce a usable, well-conditioned
 * covariance; `injectClusterInputs` additionally PD-projects the result as
 * a final safety net (design spec §4.9).
 */
export function shrinkageCovariance(points: number[][], mean: number[], dims: number): number[][] {
  const cov = sampleCovariance(points, mean, dims);
  const threshold = SHRINKAGE_SAMPLE_THRESHOLD_MULTIPLIER * dims;
  const n = points.length;
  if (n >= threshold) return cov;

  const avgVariance = cov.reduce((s, row, i) => s + (row[i] as number), 0) / dims;
  const alpha = Math.min(0.9, Math.max(0.1, (threshold - n) / threshold));
  return cov.map((row, i) => row.map((v, j) => (1 - alpha) * v + (i === j ? alpha * avgVariance : 0)));
}

/**
 * Estimate one or more ClusterInput(s) from raw samples (design spec §9.2):
 * grouped by `labels` if present, otherwise treated as a single population.
 */
export function estimateClusters(data: RawData, dims: number): ClusterInput[] {
  if (!data.labels) {
    const mean = sampleMean(data.points, dims);
    return [{ mu: mean, sigma: shrinkageCovariance(data.points, mean, dims) }];
  }

  const groups = new Map<number, number[][]>();
  for (let i = 0; i < data.points.length; i++) {
    const label = data.labels[i] as number;
    const group = groups.get(label) ?? [];
    group.push(data.points[i] as number[]);
    groups.set(label, group);
  }

  return Array.from(groups.values()).map((points) => {
    const mean = sampleMean(points, dims);
    return { mu: mean, sigma: shrinkageCovariance(points, mean, dims) };
  });
}
