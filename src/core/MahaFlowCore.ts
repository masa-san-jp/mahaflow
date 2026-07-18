import { buildClusters, generateRawClusters, type GeneratedCluster, type RawClusterSeeds } from '../math/cluster';
import { injectClusterInputs, type ClusterInput, type InjectOptions } from '../math/dataInjection';
import { estimateClusters, type RawData } from '../math/estimate';
import { evalField, projectCluster } from '../math/project';
import { tourBasis } from '../math/tour';
import { DeterministicClock, frameToTime, normalizeTimebase } from './clock';
import { RafLoop } from './rafLoop';
import { createFieldRenderer, type FieldRenderer, type FrameUniforms } from '../render/fieldView';
import { screenToField } from '../interact/pointer';
import { attachControls } from '../interact/controls';
import { DEFAULT_LIVE_PARAMS, sanitizeLiveParamsPatch, type LiveParams } from './config';
import { EventBus, type MahaEvent, type MahaEventMap } from './events';
import { ModulationBus, type ModulationSource } from './modulation';
import { BUILTIN_PRESETS, type PresetDef } from './presets';
import { deterministicShuffle, framesPerInterval, type AutoplayConfig, type AutoplayState } from './autoplay';
import { resolvePalette } from '../palette/palettes';
import type { PaletteDef } from '../palette/palettes';
import type { State } from './state';
import type { InitConfig } from './types';
import { Prng, substream } from '../math/prng';
import { exportOffline, type ExportConfig } from '../export/offline';
import { startRealtimeRecording } from '../export/realtime';

const CLOCK_FPS = 30;
const EXPORT_MAX_WIDTH = 1920;
const EXPORT_MAX_HEIGHT = 1080;
const EXPORT_MAX_FPS = 60;
const EXPORT_4K_THRESHOLD = 3840;

export interface CoreDeps {
  createRenderer?: (canvas: HTMLCanvasElement) => FieldRenderer;
}

/**
 * Framework-independent core (design spec §3). Implements the P0 render
 * lifecycle, the P1 config/state/API/event surface, and the P2a additions:
 * mode/palette rendering, element-scoped zoom/pan input, the modulation
 * bus, and presets. Orbit view, terrain, the particle system, and
 * autoplay are P2b scope, layered on without changing this contract.
 */
export class MahaFlowCore {
  readonly ready: Promise<void>;

  private readonly seedInitial: number;
  private readonly dims: number;
  private readonly maxClusters: number;
  private readonly pixelRatio: number;
  private readonly extraPalettes: Record<string, PaletteDef>;

  private readonly events = new EventBus();
  private readonly modulation = new ModulationBus();
  private readonly presets = new Map<string, PresetDef>();
  private seed: number;
  private raw: RawClusterSeeds;
  private clusters: GeneratedCluster[];
  private live: LiveParams;

  private readonly randomizeRng: Prng;
  private readonly clock: DeterministicClock;
  private readonly canvas: HTMLCanvasElement;
  private readonly renderer: FieldRenderer;
  private readonly resizeObserver: ResizeObserver;
  private readonly rafLoop: RafLoop;
  private readonly detachControls: () => void;
  private uiPanelDispose: (() => void) | null = null;
  private disposed = false;

  /** Once data is injected via setData(), spread/anisotropy no longer regenerate clusters (design spec §9.1). */
  private dataSource: 'generated' | 'injected' = 'generated';

  private autoplayConfig: AutoplayConfig | null = null;
  private autoplayIndex = 0;
  private autoplayShuffleOrder: string[] = [];
  private autoplayRandomizeRng: Prng | null = null;
  private lastAutoplayFrame = 0;

  private lastContainerSize = { width: 0, height: 0 };
  private exportAbortController: AbortController | null = null;

  constructor(
    private readonly container: HTMLElement,
    initConfig: InitConfig,
    deps: CoreDeps = {},
  ) {
    if (initConfig.seed === undefined || initConfig.seed === null || Number.isNaN(initConfig.seed)) {
      throw new Error('MahaFlowCore: config.seed is required');
    }

    this.seedInitial = initConfig.seed;
    this.seed = initConfig.seed;
    this.dims = initConfig.dims ?? 8;
    this.maxClusters = initConfig.maxClusters ?? 6;
    this.pixelRatio = initConfig.pixelRatio ?? container.ownerDocument.defaultView?.devicePixelRatio ?? 1;
    this.extraPalettes = initConfig.palettes ?? {};

    this.randomizeRng = new Prng((this.seedInitial ^ 0x9e3779b9) >>> 0);

    for (const preset of [...BUILTIN_PRESETS, ...(initConfig.presets ?? [])]) {
      this.presets.set(preset.name, preset);
    }

    const { value: clampedDefaults } = sanitizeLiveParamsPatch(
      DEFAULT_LIVE_PARAMS as unknown as Record<string, unknown>,
      this.maxClusters,
    );
    this.live = { ...DEFAULT_LIVE_PARAMS, ...clampedDefaults };

    if (initConfig.preset) {
      const preset = this.presets.get(initConfig.preset);
      if (preset) {
        const { value } = sanitizeLiveParamsPatch(preset.state as Record<string, unknown>, this.maxClusters);
        this.live = { ...this.live, ...value };
        if (preset.state.seed !== undefined) this.seed = preset.state.seed;
      }
    }
    if (initConfig.initialLive) {
      const { value } = sanitizeLiveParamsPatch(initConfig.initialLive as Record<string, unknown>, this.maxClusters);
      this.live = { ...this.live, ...value };
    }

    this.raw = generateRawClusters(this.seed, this.dims, this.maxClusters);
    this.clusters = buildClusters(this.raw, this.live.spread, this.live.anisotropy);
    this.clock = new DeterministicClock(CLOCK_FPS);

    this.canvas = container.ownerDocument.createElement('canvas');
    this.canvas.style.display = 'block';
    this.canvas.style.width = '100%';
    this.canvas.style.height = '100%';
    container.appendChild(this.canvas);
    this.canvas.addEventListener('pointermove', this.onPointerMove);

    this.detachControls = attachControls(container, {
      getZoomPan: () => ({ zoom: this.live.zoom, pan: this.live.pan }),
      setZoomPan: (zoom, pan) => this.setConfig({ zoom, pan }),
    });

    const factory = deps.createRenderer ?? createFieldRenderer;
    this.renderer = factory(this.canvas);

    this.resizeObserver = new container.ownerDocument.defaultView!.ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width === 0 || height === 0) continue;
        this.lastContainerSize = { width, height };
        if (this.exportAbortController) continue; // don't fight the export resolution mid-export
        this.canvas.width = Math.round(width * this.pixelRatio);
        this.canvas.height = Math.round(height * this.pixelRatio);
        this.renderer.setSize(this.canvas.width, this.canvas.height, this.pixelRatio);
      }
    });
    this.resizeObserver.observe(container);

    this.rafLoop = new RafLoop(container, (delta) => this.onFrame(delta));

    this.ready = this.renderer.ready.then(() => {
      if (this.disposed) return;
      this.rafLoop.start();
      this.events.emit('ready', {});
    });

    if (initConfig.autoplay) {
      this.startAutoplay(initConfig.autoplay);
    }

    // ui:"dev" only: dynamically import the panel so ui:"none" (default)
    // never pulls its DOM/code into the bundle (design spec §6.3, T-S04).
    if (initConfig.ui === 'dev') {
      const panelContainer = container.ownerDocument.createElement('div');
      container.appendChild(panelContainer);
      import('../ui/devPanel').then(({ mountDevPanel }) => {
        if (this.disposed) {
          panelContainer.remove();
          return;
        }
        this.uiPanelDispose = mountDevPanel(panelContainer, this);
      });
    }
  }

  /** Deterministic frame position; survives across dispose/reconstruct for resume (T-M10). */
  get frame(): number {
    return this.clock.currentFrame;
  }

  private visibleClusters(clusters: GeneratedCluster[], live: LiveParams): GeneratedCluster[] {
    return clusters.slice(0, live.clusterCount);
  }

  private visibleAmps(visible: GeneratedCluster[], live: LiveParams): number[] {
    return visible.map((c, i) => live.amp[i] ?? c.amp);
  }

  private clustersFor(live: LiveParams): GeneratedCluster[] {
    if (this.dataSource === 'injected') return this.clusters;
    if (live.spread === this.live.spread && live.anisotropy === this.live.anisotropy) return this.clusters;
    return buildClusters(this.raw, live.spread, live.anisotropy);
  }

  /**
   * Pure per-frame evaluation shared by the display loop and export (design
   * spec §3.3 frame pipeline / §7.2 determinism condition): given a frame
   * number, resolve modulation, project clusters, and build uniforms.
   * Depends only on `frameNumber` (plus the current base live/cluster
   * state) — never on wall-clock time — so calling it twice with the same
   * frame number always produces the same result, live display or export.
   */
  private evaluateFrame(frameNumber: number): { uniforms: FrameUniforms; finite: boolean } {
    const resolved = this.modulation.resolve(this.live, frameNumber);
    const t = frameToTime(frameNumber, CLOCK_FPS);
    const basis = tourBasis(t, this.dims);
    const clusters = this.clustersFor(resolved);
    const visible = this.visibleClusters(clusters, resolved);
    const projected = visible.map((c) => projectCluster(c, basis.u, basis.v));
    const amps = this.visibleAmps(visible, resolved);
    const tau = resolved.softness;

    const finite =
      Number.isFinite(tau) &&
      projected.every((p) => Number.isFinite(p.a) && Number.isFinite(p.b) && Number.isFinite(p.c) && p.m.every(Number.isFinite)) &&
      amps.every(Number.isFinite);

    const uniforms: FrameUniforms = {
      projected,
      amps,
      tau,
      zoom: resolved.zoom,
      pan: resolved.pan,
      mode: resolved.mode,
      time: t,
      palette: resolvePalette(resolved.palette, this.extraPalettes),
    };
    return { uniforms, finite };
  }

  private onFrame(deltaSeconds: number): void {
    if (this.disposed) return;
    const resolvedForClock = this.modulation.resolve(this.live, this.clock.currentFrame);
    if (resolvedForClock.playing) {
      this.clock.advanceByElapsedSeconds(deltaSeconds, 0.12 + 1.4 * resolvedForClock.speed);
    }
    if (this.autoplayConfig && resolvedForClock.playing) {
      const dueFrames = framesPerInterval(this.autoplayConfig.interval, CLOCK_FPS);
      if (this.clock.currentFrame - this.lastAutoplayFrame >= dueFrames) {
        this.lastAutoplayFrame = this.clock.currentFrame;
        this.advanceAutoplay();
      }
    }

    const { uniforms, finite } = this.evaluateFrame(this.clock.currentFrame);
    if (!finite) {
      this.events.emit('warning', { code: 'nan-frame-skip', message: 'Non-finite field parameters; frame skipped.' });
      return;
    }
    this.renderer.renderFrame(uniforms);
  }

  private readonly onPointerMove = (e: PointerEvent): void => {
    if (this.disposed) return;
    const rect = this.canvas.getBoundingClientRect();
    const width = rect.width || this.canvas.width;
    const height = rect.height || this.canvas.height;
    if (width === 0 || height === 0) return;
    const [px, py] = screenToField(e.clientX - rect.left, e.clientY - rect.top, width, height, this.live.zoom, this.live.pan);

    const basis = tourBasis(this.clock.time, this.dims);
    const visible = this.visibleClusters(this.clusters, this.live);
    const projected = visible.map((c) => projectCluster(c, basis.u, basis.v));
    const amps = this.visibleAmps(visible, this.live);
    const { D } = evalField([px, py], projected, amps, this.live.softness);
    this.events.emit('hover', { D, x: px, y: py });
  };

  /** True (and warns) if the core is disposed; callers should no-op. */
  private guardDisposed(): boolean {
    if (this.disposed) {
      this.events.emit('warning', { code: 'disposed-api-call', message: 'MahaFlowCore API called after dispose(); ignored.' });
      return true;
    }
    return false;
  }

  setConfig(partial: Partial<LiveParams>): void {
    if (this.guardDisposed()) return;
    const { value, warnings } = sanitizeLiveParamsPatch(partial as Record<string, unknown>, this.maxClusters);
    for (const w of warnings) this.events.emit('warning', w);
    if (Object.keys(value).length === 0) return;

    this.live = { ...this.live, ...value };
    if (this.dataSource === 'generated' && (value.spread !== undefined || value.anisotropy !== undefined)) {
      this.clusters = buildClusters(this.raw, this.live.spread, this.live.anisotropy);
    }
    this.events.emit('statechange', this.getState());
  }

  /**
   * Inject cluster data (design spec §9): form A (`ClusterInput[]`, direct
   * μ/Σ) or form B (`RawData`, raw samples — estimated via
   * `estimateClusters` and normalized to form A before injection, §9.2).
   * Dimension mismatches throw synchronously (T-A10); a non-positive-definite
   * sigma is eigenvalue-clipped with a warning, or throws in `strict` mode.
   * After injection, `spread`/`anisotropy` no longer regenerate clusters.
   */
  setData(data: ClusterInput[] | RawData, opts: InjectOptions = {}): void {
    if (this.guardDisposed()) return;
    const clusterInputs = Array.isArray(data) ? data : estimateClusters(data, this.dims);
    const { clusters, warnings } = injectClusterInputs(clusterInputs, this.dims, opts);
    for (const w of warnings) this.events.emit('warning', w);
    this.dataSource = 'injected';
    this.clusters = clusters;
    this.events.emit('statechange', this.getState());
  }

  /** `resolved: true` folds in the current modulation-bus output (design spec §7.2); the base state is otherwise returned. */
  getState(opts: { resolved?: boolean } = {}): State {
    const live = opts.resolved ? this.modulation.resolve(this.live, this.clock.currentFrame) : this.live;
    return {
      ...live,
      amp: [...live.amp],
      pan: [...live.pan] as [number, number],
      orbit: { ...live.orbit },
      seed: this.seed,
      frame: this.clock.currentFrame,
      clusters: opts.resolved ? this.clustersFor(live) : this.clusters,
      autoplay: this.autoplayState(),
    };
  }

  private autoplayState(): AutoplayState {
    return this.autoplayConfig ? { ...this.autoplayConfig, index: this.autoplayIndex } : false;
  }

  randomize(seed?: number): void {
    if (this.guardDisposed()) return;
    const nextSeed = seed ?? Math.floor(this.randomizeRng.next() * 0xffffffff);
    this.seed = nextSeed;
    this.dataSource = 'generated';
    this.raw = generateRawClusters(this.seed, this.dims, this.maxClusters);
    this.clusters = buildClusters(this.raw, this.live.spread, this.live.anisotropy);
    this.events.emit('statechange', this.getState());
  }

  play(): void {
    if (this.guardDisposed()) return;
    if (this.live.playing) return;
    this.live = { ...this.live, playing: true };
    this.events.emit('statechange', this.getState());
  }

  pause(): void {
    if (this.guardDisposed()) return;
    if (!this.live.playing) return;
    this.live = { ...this.live, playing: false };
    this.events.emit('statechange', this.getState());
  }

  addModulation(source: ModulationSource): () => void {
    if (this.guardDisposed()) return () => {};
    return this.modulation.add(source);
  }

  clearModulation(): void {
    if (this.guardDisposed()) return;
    this.modulation.clear();
  }

  applyPreset(name: string): void {
    if (this.guardDisposed()) return;
    const preset = this.presets.get(name);
    if (!preset) {
      this.events.emit('warning', { code: 'unknown-preset', message: `No preset named "${name}".` });
      return;
    }
    const { value, warnings } = sanitizeLiveParamsPatch(preset.state as Record<string, unknown>, this.maxClusters);
    for (const w of warnings) this.events.emit('warning', w);
    this.live = { ...this.live, ...value };
    if (preset.state.seed !== undefined) {
      this.seed = preset.state.seed;
      this.dataSource = 'generated';
      this.raw = generateRawClusters(this.seed, this.dims, this.maxClusters);
    }
    if (this.dataSource === 'generated') {
      this.clusters = buildClusters(this.raw, this.live.spread, this.live.anisotropy);
    }
    this.events.emit('statechange', this.getState());
  }

  savePreset(name: string): PresetDef {
    if (this.guardDisposed()) return { name, state: {} };
    const state = this.getState();
    const preset: PresetDef = {
      name,
      state: {
        clusterCount: state.clusterCount,
        spread: state.spread,
        anisotropy: state.anisotropy,
        softness: state.softness,
        amp: [...state.amp],
        mode: state.mode,
        terrain: state.terrain,
        palette: state.palette,
        isoDensity: state.isoDensity,
        flow: state.flow,
        view: state.view,
        zoom: state.zoom,
        pan: [...state.pan],
        orbit: { ...state.orbit },
        playing: state.playing,
        speed: state.speed,
        seed: state.seed,
      },
    };
    this.presets.set(name, preset);
    return preset;
  }

  listPresets(): string[] {
    return Array.from(this.presets.keys());
  }

  /**
   * Start/restart cycling on a frame-based interval (design spec §8). If
   * `transition` is "crossfade", this falls back to a "cut" (instant switch)
   * with a warning — the interpolated crossfade path is P2c scope.
   */
  startAutoplay(cfg: AutoplayConfig = { interval: 20, sequence: 'randomize' }): void {
    if (this.guardDisposed()) return;
    if (cfg.transition === 'crossfade') {
      this.events.emit('warning', {
        code: 'crossfade-unsupported',
        message: 'Autoplay crossfade transitions are not yet implemented; using a cut instead.',
      });
    }
    this.autoplayConfig = cfg;
    this.autoplayIndex = 0;
    this.lastAutoplayFrame = this.clock.currentFrame;
    this.autoplayRandomizeRng = cfg.sequence === 'randomize' ? substream(this.seedInitial, 'autoplay-randomize') : null;
    this.autoplayShuffleOrder =
      cfg.sequence === 'shuffle' ? deterministicShuffle(this.listPresets(), substream(this.seedInitial, 'autoplay-shuffle')) : [];
    this.events.emit('statechange', this.getState());
  }

  stopAutoplay(): void {
    if (this.guardDisposed()) return;
    if (!this.autoplayConfig) return;
    this.autoplayConfig = null;
    this.events.emit('statechange', this.getState());
  }

  private advanceAutoplay(): void {
    const config = this.autoplayConfig as AutoplayConfig;
    this.autoplayIndex++;
    if (config.sequence === 'randomize') {
      const rng = this.autoplayRandomizeRng as Prng;
      this.randomize(Math.floor(rng.next() * 0xffffffff));
      return;
    }
    const names = config.sequence === 'shuffle' ? this.autoplayShuffleOrder : config.sequence;
    if (names.length > 0) {
      this.applyPreset(names[this.autoplayIndex % names.length] as string);
    }
  }

  on<K extends MahaEvent>(event: K, cb: (payload: MahaEventMap[K]) => void): () => void {
    if (this.guardDisposed()) return () => {};
    return this.events.on(event, cb);
  }

  /**
   * Method A (realtime, VFR) or Method B (offline, CFR — default;
   * design spec §11) export. Resolution/fps are clamped to the browser-in
   * limits (1080p, 60fps) with a warning; 4K+ is pointed at Method C.
   */
  async exportVideo(cfg: ExportConfig): Promise<Blob> {
    if (this.guardDisposed()) throw new Error('MahaFlowCore: exportVideo() called after dispose()');

    const clamped = this.clampExportConfig(cfg);

    if (clamped.mode === 'realtime') {
      const recording = startRealtimeRecording(this.canvas);
      await new Promise((resolve) => setTimeout(resolve, clamped.duration * 1000));
      const blob = await recording.stop();
      this.events.emit('exportdone', { blob, format: 'webm', fallback: false });
      return blob;
    }

    return this.exportOfflineInternal(clamped);
  }

  private clampExportConfig(cfg: ExportConfig): ExportConfig {
    const clamped = { ...cfg };
    let clampedAny = false;

    if (clamped.width > EXPORT_MAX_WIDTH || clamped.height > EXPORT_MAX_HEIGHT) {
      if (clamped.width >= EXPORT_4K_THRESHOLD || clamped.height >= EXPORT_4K_THRESHOLD) {
        this.events.emit('warning', {
          code: 'export-resolution-4k',
          message: '4K+ export is out of browser-side scope; use the Method C server-render job contract instead.',
        });
      }
      clamped.width = Math.min(clamped.width, EXPORT_MAX_WIDTH);
      clamped.height = Math.min(clamped.height, EXPORT_MAX_HEIGHT);
      clampedAny = true;
    }

    const { num, den } = normalizeTimebase(clamped.fps ?? 30);
    if (num / den > EXPORT_MAX_FPS) {
      clamped.fps = EXPORT_MAX_FPS;
      clampedAny = true;
    }

    if (clampedAny) {
      this.events.emit('warning', {
        code: 'export-config-clamped',
        message: `Export resolution/fps clamped to the browser-side limit (${EXPORT_MAX_WIDTH}x${EXPORT_MAX_HEIGHT}, ${EXPORT_MAX_FPS}fps).`,
      });
    }
    return clamped;
  }

  private async exportOfflineInternal(cfg: ExportConfig): Promise<Blob> {
    this.rafLoop.stop();
    const priorWidth = this.canvas.width;
    const priorHeight = this.canvas.height;
    const priorPixelRatio = this.pixelRatio;

    this.canvas.width = cfg.width;
    this.canvas.height = cfg.height;
    this.renderer.setSize(cfg.width, cfg.height, 1);

    const controller = new AbortController();
    this.exportAbortController = controller;

    let lastFrameFinite = true;
    try {
      const result = await exportOffline(
        cfg,
        {
          canvas: this.canvas,
          renderFrame: (frameIndex) => {
            const { uniforms, finite } = this.evaluateFrame(frameIndex);
            lastFrameFinite = finite;
            if (finite) this.renderer.renderFrame(uniforms);
          },
          isFinite: () => lastFrameFinite,
        },
        {
          signal: controller.signal,
          onProgress: (p) => this.events.emit('exportprogress', p),
        },
      );
      this.events.emit('exportdone', result);
      return result.blob;
    } catch (err) {
      this.events.emit('exporterror', { reason: err instanceof Error ? err.message : String(err) });
      throw err;
    } finally {
      this.exportAbortController = null;
      this.canvas.width = priorWidth || Math.round(this.lastContainerSize.width * priorPixelRatio);
      this.canvas.height = priorHeight || Math.round(this.lastContainerSize.height * priorPixelRatio);
      this.renderer.setSize(this.canvas.width, this.canvas.height, priorPixelRatio);
      if (!this.disposed) this.rafLoop.start();
    }
  }

  cancelExport(): void {
    if (this.guardDisposed()) return;
    this.exportAbortController?.abort();
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.rafLoop.stop();
    this.resizeObserver.disconnect();
    this.canvas.removeEventListener('pointermove', this.onPointerMove);
    this.detachControls();
    this.uiPanelDispose?.();
    this.renderer.dispose();
    this.canvas.remove();
    // Note: the event bus is intentionally left intact (not cleared) so a
    // 'warning' listener registered before dispose() can still observe
    // post-dispose API misuse (design spec §15 "dispose後のAPI: no-op+warning").
  }
}
