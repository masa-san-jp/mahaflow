import { Output, Mp4OutputFormat, WebMOutputFormat, BufferTarget, CanvasSource, canEncodeVideo } from 'mediabunny';
import { frameToTime, normalizeTimebase, type Timebase } from '../core/clock';

/** design spec §5 ExportConfig. */
export interface ExportConfig {
  mode: 'realtime' | 'offline';
  width: number;
  height: number;
  /** Seconds. */
  duration: number;
  fps?: Timebase;
  format?: 'mp4' | 'webm';
  startFrame?: number;
  bitrate?: number;
}

export interface ExportProgress {
  frame: number;
  totalFrames: number;
  ratio: number;
}

export type RenderFrameFn = (frameIndex: number, timeSeconds: number) => void | Promise<void>;

export interface OfflineExportDeps {
  canvas: HTMLCanvasElement | OffscreenCanvas;
  /** Deterministically render frame `frameIndex` (at tour-time `timeSeconds`) onto `canvas`. */
  renderFrame: RenderFrameFn;
  /** Return false if the most recently rendered frame produced non-finite field data (design spec §4.9/§15 NaN protection). */
  isFinite?: () => boolean;
}

export interface OfflineExportHooks {
  onProgress?: (p: ExportProgress) => void;
  signal?: AbortSignal;
}

export class ExportCancelledError extends Error {}
export class ExportNonFiniteError extends Error {}

const DEFAULT_BITRATE = 4_000_000;

/**
 * Method B: deterministic offline recording (design spec §11.3). Steps
 * integer frames n=startFrame.. onto `deps.canvas`, feeding each one to a
 * Mediabunny `CanvasSource` at the exact rational-timebase timestamp
 * `frameToTime(n, fps)` — so PTS spacing is exactly CFR regardless of how
 * long each frame took to render (no wall-clock is consulted here).
 * MP4(H.264) is tried first; if unsupported it falls back to WebM(VP9).
 */
export async function exportOffline(
  cfg: ExportConfig,
  deps: OfflineExportDeps,
  hooks: OfflineExportHooks = {},
): Promise<{ blob: Blob; format: 'mp4' | 'webm'; fallback: boolean }> {
  const timebase = cfg.fps ?? 30;
  const { num, den } = normalizeTimebase(timebase);
  const fps = num / den;
  const totalFrames = Math.max(1, Math.round(cfg.duration * fps));
  const startFrame = cfg.startFrame ?? 0;
  const bitrate = cfg.bitrate ?? DEFAULT_BITRATE;

  let useMp4 = (cfg.format ?? 'mp4') === 'mp4';
  let fallback = false;
  if (useMp4) {
    const supported = await canEncodeVideo('avc', { width: cfg.width, height: cfg.height, bitrate });
    if (!supported) {
      useMp4 = false;
      fallback = true;
    }
  }

  const target = new BufferTarget();
  const output = new Output({ format: useMp4 ? new Mp4OutputFormat() : new WebMOutputFormat(), target });
  const source = new CanvasSource(deps.canvas, { codec: useMp4 ? 'avc' : 'vp9', bitrate });
  output.addVideoTrack(source);
  await output.start();

  const frameDurationSeconds = den / num;

  try {
    for (let i = 0; i < totalFrames; i++) {
      if (hooks.signal?.aborted) throw new ExportCancelledError('Export cancelled');

      const n = startFrame + i;
      const t = frameToTime(n, timebase);
      await deps.renderFrame(n, t);

      if (deps.isFinite && !deps.isFinite()) {
        throw new ExportNonFiniteError(`Non-finite field data at export frame ${n}`);
      }

      await source.add(t, frameDurationSeconds);
      hooks.onProgress?.({ frame: i + 1, totalFrames, ratio: (i + 1) / totalFrames });
    }
  } catch (err) {
    await output.cancel();
    throw err;
  }

  await output.finalize();
  const buffer = target.buffer as ArrayBuffer;
  return {
    blob: new Blob([buffer], { type: useMp4 ? 'video/mp4' : 'video/webm' }),
    format: useMp4 ? 'mp4' : 'webm',
    fallback,
  };
}
