import type { LiveParams } from './config';
import type { PresetDef } from './presets';
import type { PaletteDef } from '../palette/palettes';
import type { AutoplayConfig } from './autoplay';

/**
 * InitConfig (design spec §5). Data injection (`data`/`metric`) is P4 and
 * accepted-but-inert here.
 */
export interface InitConfig {
  /** Required: all math/phase is derived deterministically from this seed. */
  seed: number;
  dims?: number;
  maxClusters?: number;
  pixelRatio?: number;
  palettes?: Record<string, PaletteDef> | null;
  presets?: PresetDef[] | null;
  preset?: string | null;
  /** Initial live-param overrides applied on top of the defaults (and any `preset`). */
  initialLive?: Partial<LiveParams>;
  autoplay?: AutoplayConfig | false;
  /** `"dev"` lazy-loads the dev control panel; `"none"` (default) mounts no built-in UI DOM. */
  ui?: 'dev' | 'none';
}
