/**
 * Deterministic 32-bit PRNG (mulberry32) with purpose-hashed substreams and
 * rejection-free Box-Muller normal sampling.
 *
 * Design spec §4.2: consuming one substream must never perturb another, and
 * every call must consume a fixed, deterministic number of underlying
 * uniforms so replay is exact.
 */

export class Prng {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0;
  }

  /** Uniform sample in [0, 1). */
  next(): number {
    this.state = (this.state + 0x6d2b79f5) | 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /**
   * Standard normal sample via the non-rejecting Box-Muller transform
   * (log/cos branch only). Always consumes exactly two uniforms.
   */
  nextGaussian(): number {
    const u1 = Math.max(this.next(), 1e-12);
    const u2 = this.next();
    return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  }
}

/** 32-bit FNV-1a hash of a string, used to derive independent substreams. */
export function hashPurpose(purpose: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < purpose.length; i++) {
    hash ^= purpose.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/**
 * Derive an independent substream for a given purpose. Consuming one
 * substream never affects the sequence produced by another.
 */
export function substream(seed: number, purpose: string): Prng {
  return new Prng((seed ^ hashPurpose(purpose)) >>> 0);
}
