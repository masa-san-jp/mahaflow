import { generateClusters, type GeneratedCluster } from '../math/cluster';
import { projectCluster } from '../math/project';
import { tourBasis } from '../math/tour';
import { DeterministicClock } from './clock';
import { RafLoop } from './rafLoop';
import { createFieldRenderer, type FieldRenderer, type FrameUniforms } from '../render/fieldView';
import type { InitConfig } from './types';

export interface CoreDeps {
  createRenderer?: (canvas: HTMLCanvasElement) => FieldRenderer;
}

const DEFAULT_TAU = 0.85;
const DEFAULT_SPEED = 0.3;

/**
 * Framework-independent core (design spec §3). P0 scope: container-scoped
 * lifecycle (mount/resize/dispose) driving the deterministic clock and the
 * smooth field-view render path. The full config/state/API surface
 * (setConfig, getState, presets, autoplay, export, ...) is layered on in
 * P1-P5 without changing this lifecycle contract.
 */
export class MahaFlowCore {
  readonly ready: Promise<void>;

  private readonly config: Required<Pick<InitConfig, 'seed' | 'dims' | 'maxClusters' | 'pixelRatio'>>;
  private readonly clusters: GeneratedCluster[];
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

    this.config = {
      seed: initConfig.seed,
      dims: initConfig.dims ?? 8,
      maxClusters: initConfig.maxClusters ?? 6,
      pixelRatio: initConfig.pixelRatio ?? container.ownerDocument.defaultView?.devicePixelRatio ?? 1,
    };

    this.clusters = generateClusters(this.config.seed, this.config.dims, this.config.maxClusters);
    this.clock = new DeterministicClock(30);

    this.canvas = container.ownerDocument.createElement('canvas');
    this.canvas.style.display = 'block';
    this.canvas.style.width = '100%';
    this.canvas.style.height = '100%';
    container.appendChild(this.canvas);

    const factory = deps.createRenderer ?? createFieldRenderer;
    this.renderer = factory(this.canvas);

    this.resizeObserver = new container.ownerDocument.defaultView!.ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width === 0 || height === 0) continue;
        this.canvas.width = Math.round(width * this.config.pixelRatio);
        this.canvas.height = Math.round(height * this.config.pixelRatio);
        this.renderer.setSize(this.canvas.width, this.canvas.height, this.config.pixelRatio);
      }
    });
    this.resizeObserver.observe(container);

    this.rafLoop = new RafLoop(container, (delta) => this.onFrame(delta));

    this.ready = this.renderer.ready.then(() => {
      if (this.disposed) return;
      this.rafLoop.start();
    });
  }

  /** Deterministic frame position; survives across dispose/reconstruct for resume (T-M10). */
  get frame(): number {
    return this.clock.currentFrame;
  }

  private onFrame(deltaSeconds: number): void {
    if (this.disposed) return;
    this.clock.advanceByElapsedSeconds(deltaSeconds, 0.12 + 1.4 * DEFAULT_SPEED);
    const t = this.clock.time;
    const basis = tourBasis(t, this.config.dims);
    const projected = this.clusters.map((c) => projectCluster(c, basis.u, basis.v));
    const uniforms: FrameUniforms = {
      projected,
      amps: this.clusters.map((c) => c.amp),
      tau: DEFAULT_TAU,
    };
    this.renderer.renderFrame(uniforms);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.rafLoop.stop();
    this.resizeObserver.disconnect();
    this.renderer.dispose();
    this.canvas.remove();
  }
}
