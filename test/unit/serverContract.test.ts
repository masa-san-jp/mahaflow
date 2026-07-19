import { describe, expect, it } from 'vitest';
import {
  SchemaError,
  parseServerExportJob,
  serializeServerExportJob,
  validateServerExportJob,
  type ServerExportJob,
} from '../../src/export/serverContract';
import { DEFAULT_LIVE_PARAMS } from '../../src/core/config';

function makeJob(): ServerExportJob {
  return {
    state: {
      ...DEFAULT_LIVE_PARAMS,
      seed: 42,
      frame: 100,
      clusters: [{ mu: [0, 0], sigma: [[1, 0], [0, 1]], a: [[1, 0], [0, 1]], amp: 1 }],
      autoplay: false,
    },
    export: { mode: 'offline', width: 1280, height: 720, duration: 5, fps: 30 },
  };
}

describe('T-E10 Method C job contract', () => {
  it('round-trips through serialize/parse with no information loss', () => {
    const job = makeJob();
    const json = serializeServerExportJob(job);
    const parsed = parseServerExportJob(json);
    expect(parsed).toEqual(job);
  });

  it('accepts an optional modulationTable', () => {
    const job = { ...makeJob(), modulationTable: [[1, 2, 3], [4, 5, 6]] };
    const parsed = parseServerExportJob(serializeServerExportJob(job));
    expect(parsed.modulationTable).toEqual(job.modulationTable);
  });

  it('rejects malformed JSON', () => {
    expect(() => parseServerExportJob('{not json')).toThrow(SchemaError);
  });

  it.each([
    ['missing state', { export: makeJob().export }],
    ['missing export', { state: makeJob().state }],
    ['bad export.mode', { ...makeJob(), export: { ...makeJob().export, mode: 'bogus' } }],
    ['negative width', { ...makeJob(), export: { ...makeJob().export, width: -1 } }],
    ['non-array clusters', { ...makeJob(), state: { ...makeJob().state, clusters: 'nope' } }],
    ['malformed modulationTable row', { ...makeJob(), modulationTable: [['a', 1]] }],
  ])('rejects schema violation: %s', (_name, badJob) => {
    expect(() => validateServerExportJob(badJob)).toThrow(SchemaError);
  });
});
