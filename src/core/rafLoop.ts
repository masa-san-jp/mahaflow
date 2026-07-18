/**
 * The single sanctioned place real elapsed time is read (design spec
 * §3.2 rule 3 / §7.1): converts requestAnimationFrame timestamps into
 * elapsed-seconds deltas fed to DeterministicClock.advanceByElapsedSeconds.
 * Never used to derive math/phase directly.
 */

export type FrameCallback = (deltaSeconds: number) => void;

export class RafLoop {
  private handle: number | null = null;
  private lastTimestamp: number | null = null;
  private readonly reducedMotionScale: number;

  constructor(
    private readonly container: HTMLElement,
    private readonly onFrame: FrameCallback,
    reducedMotionScale = 0.1,
  ) {
    this.reducedMotionScale = reducedMotionScale;
  }

  start(): void {
    if (this.handle !== null) return;
    const tick = (timestamp: number) => {
      const prev = this.lastTimestamp;
      this.lastTimestamp = timestamp;
      if (prev !== null) {
        const rawDelta = (timestamp - prev) / 1000;
        const scale = this.prefersReducedMotion() ? this.reducedMotionScale : 1;
        this.onFrame(rawDelta * scale);
      }
      this.handle = this.container.ownerDocument.defaultView!.requestAnimationFrame(tick);
    };
    this.handle = this.container.ownerDocument.defaultView!.requestAnimationFrame(tick);
  }

  stop(): void {
    if (this.handle !== null) {
      this.container.ownerDocument.defaultView!.cancelAnimationFrame(this.handle);
      this.handle = null;
    }
    this.lastTimestamp = null;
  }

  private prefersReducedMotion(): boolean {
    const view = this.container.ownerDocument.defaultView;
    return view?.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  }
}
