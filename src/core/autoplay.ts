import type { Prng } from '../math/prng';

/** design spec §5/§8. */
export interface AutoplayConfig {
  /** Seconds between transitions. */
  interval: number;
  sequence: 'randomize' | 'shuffle' | string[];
  transition?: 'cut' | 'crossfade';
  transitionSec?: number;
}

export type AutoplayState = (AutoplayConfig & { index: number }) | false;

/** Deterministic Fisher-Yates shuffle driven by a PRNG substream (design spec §8 "shuffle"). */
export function deterministicShuffle<T>(items: T[], rng: Prng): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng.next() * (i + 1));
    const tmp = arr[i] as T;
    arr[i] = arr[j] as T;
    arr[j] = tmp;
  }
  return arr;
}

/** Frame count for `interval` seconds at the clock's fps — transitions are frame-based, never wall-clock (design spec §8). */
export function framesPerInterval(interval: number, fps: number): number {
  return interval * fps;
}
