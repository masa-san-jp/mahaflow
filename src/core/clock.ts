/**
 * Deterministic clock: phase is derived purely from an integer/fractional
 * frame position and a rational timebase (design spec §7.1). No wall-clock
 * source is consulted here — `advanceByElapsedSeconds` takes elapsed time
 * as an explicit argument so callers (the display rAF loop) own the only
 * place real time is read.
 */

export type Timebase = number | { num: number; den: number };

export function normalizeTimebase(tb: Timebase): { num: number; den: number } {
  return typeof tb === 'number' ? { num: tb, den: 1 } : tb;
}

/**
 * t = n * den / num. When n is an integer, the numerator n*den is computed
 * exactly via BigInt so only the final division rounds — no accumulated
 * floating point drift across frames.
 */
export function frameToTime(n: number, tb: Timebase): number {
  const { num, den } = normalizeTimebase(tb);
  if (Number.isInteger(n)) {
    return Number(BigInt(n) * BigInt(den)) / num;
  }
  return (n * den) / num;
}

export class DeterministicClock {
  private frame: number;
  private timebase: Timebase;

  constructor(timebase: Timebase, startFrame = 0) {
    this.timebase = timebase;
    this.frame = startFrame;
  }

  get currentFrame(): number {
    return this.frame;
  }

  get time(): number {
    return frameToTime(this.frame, this.timebase);
  }

  /** Restore a previously observed frame position exactly (T-M10). */
  setFrame(n: number): void {
    this.frame = n;
  }

  /** Display-loop advance: elapsed wall-clock seconds -> fractional frame delta. */
  advanceByElapsedSeconds(deltaSeconds: number, rate = 1): void {
    const { num, den } = normalizeTimebase(this.timebase);
    const fps = num / den;
    this.frame += deltaSeconds * fps * rate;
  }

  /** Export-loop advance: exactly one integer frame. */
  stepFrame(): void {
    this.frame = Math.floor(this.frame) + 1;
  }
}
