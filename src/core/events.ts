import type { State } from './state';
import type { Warning } from './config';

/** Event payload map (design spec §5.2). Export-related events are declared for
 * contract completeness; they are only emitted once export (P5) lands. */
export interface MahaEventMap {
  ready: Record<string, never>;
  statechange: State;
  hover: { D: number; x: number; y: number };
  warning: Warning;
  exportprogress: { frame: number; totalFrames: number; ratio: number };
  exportdone: { blob: Blob; format: string; fallback: boolean };
  exporterror: { reason: string };
}

export type MahaEvent = keyof MahaEventMap;

export class EventBus {
  private listeners = new Map<MahaEvent, Set<(payload: unknown) => void>>();

  on<K extends MahaEvent>(event: K, cb: (payload: MahaEventMap[K]) => void): () => void {
    let set = this.listeners.get(event);
    if (!set) {
      set = new Set();
      this.listeners.set(event, set);
    }
    const wrapped = cb as (payload: unknown) => void;
    set.add(wrapped);
    return () => set!.delete(wrapped);
  }

  emit<K extends MahaEvent>(event: K, payload: MahaEventMap[K]): void {
    const set = this.listeners.get(event);
    if (!set) return;
    for (const cb of set) cb(payload);
  }

  clear(): void {
    this.listeners.clear();
  }
}
