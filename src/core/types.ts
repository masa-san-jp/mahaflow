import type { LiveParams } from './config';
import type { PresetDef } from './presets';
import type { PaletteDef } from '../palette/palettes';

/**
 * InitConfig (design spec §5). Data injection (`data`/`metric`), autoplay,
 * and `ui` are later phases (P3-P4) and accepted-but-inert here.
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
}
