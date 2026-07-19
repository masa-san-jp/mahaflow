import type { LiveParams } from './config';

export interface PresetDef {
  name: string;
  state: Partial<LiveParams> & { seed?: number };
}

/** Four built-in presets (one per field-view mode), design spec §8. */
export const BUILTIN_PRESETS: PresetDef[] = [
  { name: 'calm-sea', state: { mode: 0, softness: 1.1, zoom: 1, speed: 0.2, palette: 'aurora' } },
  { name: 'deep-current', state: { mode: 1, softness: 0.7, zoom: 1, speed: 0.4, palette: 'abyss' } },
  { name: 'capillary-bloom', state: { mode: 2, softness: 0.5, zoom: 1.3, speed: 0.3, palette: 'dawn' } },
  { name: 'shattered-glass', state: { mode: 3, softness: 0.35, zoom: 0.8, speed: 0.5, palette: 'aurora' } },
];
