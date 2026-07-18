/**
 * P0 subset of the API contract (design spec §5). Only the fields needed to
 * stand up the core lifecycle and the smooth field-view render path are
 * included here; the full InitConfig/LiveParams surface (data injection,
 * presets, autoplay, export, ...) lands in later phases (P1-P5).
 */
export interface InitConfig {
  /** Required: all math/phase is derived deterministically from this seed. */
  seed: number;
  dims?: number;
  maxClusters?: number;
  pixelRatio?: number;
}
