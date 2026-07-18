export { MahaFlowCore } from './core/MahaFlowCore';
export type { InitConfig } from './core/types';
export { DeterministicClock, frameToTime } from './core/clock';
export type { Timebase } from './core/clock';
export { DEFAULT_LIVE_PARAMS, sanitizeLiveParamsPatch } from './core/config';
export type { LiveParams, Mode, Terrain, ViewMode, OrbitState, Warning } from './core/config';
export type { State, AutoplayState } from './core/state';
export type { MahaEvent, MahaEventMap } from './core/events';
export type { ModulationSource } from './core/modulation';
export { BUILTIN_PRESETS } from './core/presets';
export type { PresetDef } from './core/presets';
export { deterministicShuffle, framesPerInterval } from './core/autoplay';
export type { AutoplayConfig } from './core/autoplay';
export { DEFAULT_PALETTES, AURORA_PALETTE, ABYSS_PALETTE, DAWN_PALETTE, resolvePalette } from './palette/palettes';
export type { PaletteDef } from './palette/palettes';
export { generateClusters, generateRawClusters, buildClusters } from './math/cluster';
export type { GeneratedCluster, RawClusterSeeds } from './math/cluster';
export { tourBasis } from './math/tour';
export type { TourBasis } from './math/tour';
export { projectCluster, evalField, evalWave, covariance2x2, gradD, squaredDistance } from './math/project';
export type { ProjCluster } from './math/project';
export { generatePointCloud, pointDisplayPosition, pointPaletteIntensity, pointVisualSize } from './math/pointcloud';
export type { PointSample } from './math/pointcloud';
export { spawnParticle, evalCurl, particleVelocity, shouldRespawn } from './math/particles';
export type { ParticleSpawn } from './math/particles';
export { Prng, substream } from './math/prng';
export type { DevPanelHost } from './ui/devPanel';
export { mahalanobisMetric, mahalanobisGlslChunk } from './math/metric';
export type { Metric } from './math/metric';
export { injectClusterInputs } from './math/dataInjection';
export type { ClusterInput, InjectOptions, InjectResult } from './math/dataInjection';
export { estimateClusters, shrinkageCovariance } from './math/estimate';
export type { RawData } from './math/estimate';
export {
  jacobiEigenSymmetric,
  nearestPositiveDefinite,
  symmetrize,
  cholesky,
  matVec,
  selfOuter,
  addScaledIdentity,
  quadForm,
} from './math/linalg';
export type { EigenDecomposition } from './math/linalg';
export {
  paletteColor,
  relativeLuminance,
  luminanceCurve,
  isMonotonic,
  applyColorMatrix,
  PROTANOPIA_MATRIX,
  DEUTERANOPIA_MATRIX,
} from './palette/luminance';
export { createFieldRenderer } from './render/fieldView';
export type { FieldRenderer, FrameUniforms } from './render/fieldView';
export { exportOffline, ExportCancelledError, ExportNonFiniteError } from './export/offline';
export type { ExportConfig, ExportProgress, OfflineExportDeps, OfflineExportHooks, RenderFrameFn } from './export/offline';
export { startRealtimeRecording } from './export/realtime';
export type { RealtimeRecording } from './export/realtime';
export {
  validateServerExportJob,
  serializeServerExportJob,
  parseServerExportJob,
  SchemaError,
} from './export/serverContract';
export type { ServerExportJob, ServerExportResult } from './export/serverContract';
