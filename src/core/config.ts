/**
 * Config/state schema (design spec §5). Full LiveParams surface is defined
 * here for API-contract completeness (P1-1); only the subset consumed by
 * the current smooth field-view renderer (P0/P2 scope) has visible effect
 * today — the rest is stored/validated/round-tripped so later phases (P2
 * orbit/modes/terrain/palette, P2 autoplay) can adopt it without another
 * schema change.
 */

export type Mode = 0 | 1 | 2 | 3; // smooth | wave | capillary | particle
export type Terrain = 0 | 1; // density mountains | distance bowl
export type ViewMode = 'field' | 'orbit';

export interface OrbitState {
  theta: number;
  phi: number;
  r: number;
  tx: number;
  ty: number;
  tz: number;
}

export interface LiveParams {
  clusterCount: number;
  spread: number;
  anisotropy: number;
  softness: number;
  /** Per-cluster amplitude override, indexed like the generated clusters. Missing entries fall back to the generated amp. */
  amp: number[];
  mode: Mode;
  terrain: Terrain;
  palette: string;
  isoDensity: number;
  flow: number;
  view: ViewMode;
  zoom: number;
  pan: [number, number];
  orbit: OrbitState;
  playing: boolean;
  speed: number;
}

export const DEFAULT_LIVE_PARAMS: LiveParams = {
  clusterCount: 4,
  spread: 1.15,
  anisotropy: 0.42,
  softness: 0.85,
  amp: [],
  mode: 0,
  terrain: 0,
  palette: 'aurora',
  isoDensity: 0.55,
  flow: 0.45,
  view: 'field',
  zoom: 1,
  pan: [0, 0],
  orbit: { theta: 0.6, phi: 0.5, r: 6, tx: 0, ty: 0, tz: 0 },
  playing: true,
  speed: 0.3,
};

export interface Warning {
  code: string;
  message: string;
}

/** Init-only keys (design spec §5 InitConfig) — never valid inside setConfig. */
export const INIT_ONLY_KEYS = new Set([
  'seed',
  'dims',
  'maxClusters',
  'data',
  'metric',
  'palettes',
  'presets',
  'preset',
  'autoplay',
  'ui',
  'pixelRatio',
]);

const NUMERIC_RANGES: Partial<Record<keyof LiveParams, [number, number]>> = {
  spread: [0.2, 3],
  anisotropy: [0.05, 1],
  softness: [0.1, 3],
  isoDensity: [0, 1],
  flow: [0, 1],
  zoom: [0.25, 12],
  speed: [0, 1],
};

const ENUMS: Partial<Record<keyof LiveParams, readonly unknown[]>> = {
  mode: [0, 1, 2, 3],
  terrain: [0, 1],
  view: ['field', 'orbit'],
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Validate + clamp a partial LiveParams patch (design spec §15). Unknown /
 * init-only keys and out-of-range values are dropped with a warning rather
 * than throwing, matching the "setConfig(init-onlyキー) -> 無視+warning"
 * and "範囲クランプ" error-handling rows.
 */
export function sanitizeLiveParamsPatch(
  patch: Record<string, unknown>,
  maxClusters: number,
): { value: Partial<LiveParams>; warnings: Warning[] } {
  const value: Partial<LiveParams> = {};
  const warnings: Warning[] = [];

  for (const [key, raw] of Object.entries(patch)) {
    if (INIT_ONLY_KEYS.has(key)) {
      warnings.push({
        code: 'init-only-key-ignored',
        message: `"${key}" is an init-only key and cannot be changed via setConfig; ignored.`,
      });
      continue;
    }
    if (!(key in DEFAULT_LIVE_PARAMS)) {
      warnings.push({ code: 'unknown-key-ignored', message: `Unknown config key "${key}" ignored.` });
      continue;
    }

    const typedKey = key as keyof LiveParams;

    if (typedKey === 'clusterCount') {
      const n = Math.round(raw as number);
      const clamped = clamp(n, 2, maxClusters);
      if (clamped !== raw) {
        warnings.push({ code: 'clamped', message: `clusterCount clamped to [2, ${maxClusters}].` });
      }
      value.clusterCount = clamped;
      continue;
    }

    const range = NUMERIC_RANGES[typedKey];
    if (range) {
      const n = raw as number;
      const [min, max] = range;
      const clamped = clamp(n, min, max);
      if (clamped !== n) {
        warnings.push({ code: 'clamped', message: `${key} clamped to [${min}, ${max}].` });
      }
      (value as Record<string, unknown>)[typedKey] = clamped;
      continue;
    }

    const allowed = ENUMS[typedKey];
    if (allowed) {
      if (!allowed.includes(raw)) {
        warnings.push({
          code: 'invalid-enum-ignored',
          message: `Invalid value for ${key}: ${String(raw)}; ignored.`,
        });
        continue;
      }
      (value as Record<string, unknown>)[typedKey] = raw;
      continue;
    }

    // amp / pan / orbit / palette / playing: stored as-is (no numeric range in spec).
    (value as Record<string, unknown>)[typedKey] = raw;
  }

  return { value, warnings };
}
