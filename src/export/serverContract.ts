import type { State } from '../core/state';
import type { ExportConfig } from './offline';

/**
 * Method C job contract (design spec §11.4): input for a server-side render
 * job. Implementation of the render itself is out of scope (P5-5 ships the
 * contract + validation only); the point is that the core's determinism
 * guarantees the server can reproduce the exact same frames from this JSON.
 */
export interface ServerExportJob {
  state: State;
  export: ExportConfig;
  /** Per-frame resolved LiveParams overrides, one row per frame, mirroring the modulation bus output (design spec §7.2). */
  modulationTable?: number[][];
}

export interface ServerExportResult {
  format: 'mp4' | 'webm';
  width: number;
  height: number;
  durationSeconds: number;
  frameCount: number;
}

class SchemaError extends Error {}

function assert(cond: unknown, message: string): asserts cond {
  if (!cond) throw new SchemaError(message);
}

function isFiniteNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

/** Throws SchemaError describing the first violation found; returns void on success. */
export function validateServerExportJob(job: unknown): asserts job is ServerExportJob {
  assert(job !== null && typeof job === 'object', 'job must be an object');
  const j = job as Record<string, unknown>;

  assert(j.state !== null && typeof j.state === 'object', 'job.state must be an object');
  const state = j.state as Record<string, unknown>;
  assert(isFiniteNumber(state.seed), 'job.state.seed must be a finite number');
  assert(isFiniteNumber(state.frame), 'job.state.frame must be a finite number');
  assert(Array.isArray(state.clusters), 'job.state.clusters must be an array');

  assert(j.export !== null && typeof j.export === 'object', 'job.export must be an object');
  const exp = j.export as Record<string, unknown>;
  assert(exp.mode === 'realtime' || exp.mode === 'offline', 'job.export.mode must be "realtime" or "offline"');
  assert(isFiniteNumber(exp.width) && exp.width > 0, 'job.export.width must be a positive finite number');
  assert(isFiniteNumber(exp.height) && exp.height > 0, 'job.export.height must be a positive finite number');
  assert(isFiniteNumber(exp.duration) && exp.duration > 0, 'job.export.duration must be a positive finite number');

  if (j.modulationTable !== undefined) {
    assert(Array.isArray(j.modulationTable), 'job.modulationTable must be an array of rows');
    for (const row of j.modulationTable as unknown[]) {
      assert(Array.isArray(row) && row.every(isFiniteNumber), 'job.modulationTable rows must be arrays of finite numbers');
    }
  }
}

export function serializeServerExportJob(job: ServerExportJob): string {
  validateServerExportJob(job);
  return JSON.stringify(job);
}

/** Round-trips through validation; throws SchemaError on malformed JSON or a schema violation. */
export function parseServerExportJob(json: string): ServerExportJob {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new SchemaError('job is not valid JSON');
  }
  validateServerExportJob(parsed);
  return parsed;
}

export { SchemaError };
