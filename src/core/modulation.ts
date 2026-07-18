import type { LiveParams } from './config';

/** design spec §7.2: a source is a pure function of the frame number, returning a partial live-param override. */
export type ModulationSource = (frame: number) => Partial<LiveParams>;

/**
 * Non-destructive modulation bus. Sources are evaluated in registration
 * order each frame and shallow-merged onto the base LiveParams to produce
 * the frame's *effective* params; the base state itself is never mutated
 * (design spec §7.2), so getState() keeps returning the unresolved state
 * unless the caller explicitly asks for the resolved view.
 */
export class ModulationBus {
  private sources: ModulationSource[] = [];

  add(source: ModulationSource): () => void {
    this.sources.push(source);
    return () => {
      const i = this.sources.indexOf(source);
      if (i !== -1) this.sources.splice(i, 1);
    };
  }

  clear(): void {
    this.sources = [];
  }

  resolve(base: LiveParams, frame: number): LiveParams {
    let merged = base;
    for (const source of this.sources) {
      merged = { ...merged, ...source(frame) };
    }
    return merged;
  }
}
