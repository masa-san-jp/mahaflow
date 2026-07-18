import { describe, expect, it } from 'vitest';
import { QUALITY_LADDER, QualityManager } from '../../src/core/quality';

describe('T-P03 auto quality degradation', () => {
  it('stays at full quality under budget', () => {
    const q = new QualityManager();
    for (let i = 0; i < 100; i++) expect(q.recordFrame(10)).toBeNull();
    expect(q.current).toEqual(QUALITY_LADDER[0]);
    expect(q.isDegraded).toBe(false);
  });

  it('degrades pixelRatio first, then point count, after sustained overrun', () => {
    const q = new QualityManager();
    let degradations = 0;
    for (let i = 0; i < 30 * (QUALITY_LADDER.length - 1) + 5; i++) {
      const step = q.recordFrame(100); // way over budget every frame
      if (step) degradations++;
    }
    expect(degradations).toBe(QUALITY_LADDER.length - 1);
    expect(q.current).toEqual(QUALITY_LADDER[QUALITY_LADDER.length - 1]);
    expect(q.isDegraded).toBe(true);
  });

  it('a single slow frame does not degrade (requires a sustained streak)', () => {
    const q = new QualityManager();
    expect(q.recordFrame(100)).toBeNull();
    expect(q.recordFrame(5)).toBeNull(); // resets the streak
    expect(q.current).toEqual(QUALITY_LADDER[0]);
  });

  it('never degrades past the last ladder step', () => {
    const q = new QualityManager();
    for (let i = 0; i < 30 * 20; i++) q.recordFrame(1000);
    expect(q.current).toEqual(QUALITY_LADDER[QUALITY_LADDER.length - 1]);
  });

  it('reset() returns to full quality', () => {
    const q = new QualityManager();
    for (let i = 0; i < 30; i++) q.recordFrame(100);
    expect(q.isDegraded).toBe(true);
    q.reset();
    expect(q.isDegraded).toBe(false);
    expect(q.current).toEqual(QUALITY_LADDER[0]);
  });
});
