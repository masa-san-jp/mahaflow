/**
 * Automatic quality degradation (design spec §13): if measured frame time
 * sustains above budget, step pixelRatio down first, then the orbit-view
 * point count. Never applied during export (callers simply don't feed
 * export frames into this — see MahaFlowCore).
 */
export interface QualityStep {
  pixelRatio: number;
  pointCount: number;
}

export const QUALITY_LADDER: readonly QualityStep[] = [
  { pixelRatio: 1, pointCount: 1500 },
  { pixelRatio: 0.85, pointCount: 1500 },
  { pixelRatio: 0.7, pointCount: 1000 },
  { pixelRatio: 0.55, pointCount: 600 },
  { pixelRatio: 0.4, pointCount: 300 },
];

const FRAME_BUDGET_MS = (1000 / 60) * 1.5;
const SUSTAINED_FRAMES = 30;

export class QualityManager {
  private level = 0;
  private overrunStreak = 0;

  get current(): QualityStep {
    return QUALITY_LADDER[this.level] as QualityStep;
  }

  get isDegraded(): boolean {
    return this.level > 0;
  }

  /** Feed one frame's duration in ms. Returns the new step if it just degraded a level, else null. */
  recordFrame(durationMs: number): QualityStep | null {
    if (durationMs > FRAME_BUDGET_MS) {
      this.overrunStreak++;
    } else {
      this.overrunStreak = 0;
    }
    if (this.overrunStreak >= SUSTAINED_FRAMES && this.level < QUALITY_LADDER.length - 1) {
      this.level++;
      this.overrunStreak = 0;
      return this.current;
    }
    return null;
  }

  reset(): void {
    this.level = 0;
    this.overrunStreak = 0;
  }
}
