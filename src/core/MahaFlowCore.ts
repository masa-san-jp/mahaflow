import { buildClusters, generateRawClusters, type GeneratedCluster, type RawClusterSeeds } from '../math/cluster';
import { evalField, projectCluster } from '../math/project';
import { tourBasis } from '../math/tour';
import { DeterministicClock } from './clock';
import { RafLoop } from './rafLoop';
import { createFieldRenderer, type FieldRenderer, type FrameUniforms } from '../render/fieldView';
import { screenToField } from '../interact/pointer';
import { DEFAULT_LIVE_PARAMS, sanitizeLiveParamsPatch, type LiveParams } from './config';
import { EventBus, type MahaEvent, type MahaEventMap } from './events';
import type { State } from './state';
import type { InitConfig } from './types';
import { Prng } from '../math/prng';

export interface CoreDeps {
  createRenderer?: (canvas: HTMLCanvasElement) => FieldRenderer;
}

/**
 * Framework-independent core (design spec §3). Implements the P0 render
 * lifecycle plus the P1 config/state/API/event surface: setConfig/getState,
 * randomize, play/pause, and the ready/statechange/hover/warning events.
 * Presets, autoplay, data injection, additional views/modes, and export are
 * later phases (P2-P5) layered on top of this without changing this
 * lifecycle or event contract.
 */
export class MahaFlowCore {
  readonly ready: Promise<void>;

  private readonly seedInitial: number;
  private readonly dims: number;
  private readonly maxClusters: number;
  private readonly pixelRatio: number;

  private readonly events = new EventBus();
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
  private disposed = false;

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

    this.randomizeRng = new Prng((this.seedInitial ^ 0x9e3779b9) >>> 0);

    const { value: clampedDefaults } = sanitizeLiveParamsPatch(
      DEFAULT_LIVE_PARAMS as unknown as Record<string, unknown>,
      this.maxClusters,
    );
    this.live = { ...DEFAULT_LIVE_PARAMS, ...clampedDefaults };

    this.raw = generateRawClusters(this.seed, this.dims, this.maxClusters);
    this.clusters = buildClusters(this.raw, this.live.spread, this.live.anisotropy);
    this.clock = new DeterministicClock(30);

    this.canvas = container.ownerDocument.createElement('canvas');
    this.canvas.style.display = 'block';
    this.canvas.style.width = '100%';
    this.canvas.style.height = '100%';
    container.appendChild(this.canvas);
    this.canvas.addEventListener('pointermove', this.onPointerMove);

    const factory = deps.createRenderer ?? createFieldRenderer;
    this.renderer = factory(this.canvas);

    this.resizeObserver = new container.ownerDocument.defaultView!.ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width === 0 || height === 0) continue;
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
  }

  /** Deterministic frame position; survives across dispose/reconstruct for resume (T-M10). */
  get frame(): number {
    return this.clock.currentFrame;
  }

  private visibleClusters(): GeneratedCluster[] {
    return this.clusters.slice(0, this.live.clusterCount);
  }

  private visibleAmps(visible: GeneratedCluster[]): number[] {
    return visible.map((c, i) => this.live.amp[i] ?? c.amp);
  }

  private onFrame(deltaSeconds: number): void {
    if (this.disposed) return;
    if (this.live.playing) {
      this.clock.advanceByElapsedSeconds(deltaSeconds, 0.12 + 1.4 * this.live.speed);
    }
    const t = this.clock.time;
    const basis = tourBasis(t, this.dims);
    const visible = this.visibleClusters();
    const projected = visible.map((c) => projectCluster(c, basis.u, basis.v));
    const amps = this.visibleAmps(visible);
    const tau = this.live.softness;

    const finite =
      Number.isFinite(tau) &&
      projected.every((p) => Number.isFinite(p.a) && Number.isFinite(p.b) && Number.isFinite(p.c) && p.m.every(Number.isFinite)) &&
      amps.every(Number.isFinite);

    if (!finite) {
      this.events.emit('warning', { code: 'nan-frame-skip', message: 'Non-finite field parameters; frame skipped.' });
      return;
    }

    const uniforms: FrameUniforms = { projected, amps, tau, zoom: this.live.zoom, pan: this.live.pan };
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
    const visible = this.visibleClusters();
    const projected = visible.map((c) => projectCluster(c, basis.u, basis.v));
    const amps = this.visibleAmps(visible);
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
    if (value.spread !== undefined || value.anisotropy !== undefined) {
      this.clusters = buildClusters(this.raw, this.live.spread, this.live.anisotropy);
    }
    this.events.emit('statechange', this.getState());
  }

  getState(): State {
    return {
      ...this.live,
      amp: [...this.live.amp],
      pan: [...this.live.pan] as [number, number],
      orbit: { ...this.live.orbit },
      seed: this.seed,
      frame: this.clock.currentFrame,
      clusters: this.clusters,
      autoplay: false,
    };
  }

  randomize(seed?: number): void {
    if (this.guardDisposed()) return;
    const nextSeed = seed ?? Math.floor(this.randomizeRng.next() * 0xffffffff);
    this.seed = nextSeed;
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

  on<K extends MahaEvent>(event: K, cb: (payload: MahaEventMap[K]) => void): () => void {
    if (this.guardDisposed()) return () => {};
    return this.events.on(event, cb);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.rafLoop.stop();
    this.resizeObserver.disconnect();
    this.canvas.removeEventListener('pointermove', this.onPointerMove);
    this.renderer.dispose();
    this.canvas.remove();
    // Note: the event bus is intentionally left intact (not cleared) so a
    // 'warning' listener registered before dispose() can still observe
    // post-dispose API misuse (design spec §15 "dispose後のAPI: no-op+warning").
  }
}
