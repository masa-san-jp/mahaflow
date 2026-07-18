import { test, expect } from '@playwright/test';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Method B (offline, CFR) export exercised against the real
 * MahaFlowCore + renderer + Mediabunny pipeline in a real browser — jsdom
 * has no WebCodecs, so this is the only place this path can run (design
 * spec §11.3, T-E02).
 */
test('exportVideo({mode:"offline"}) produces a playable video blob', async ({ page }) => {
  const filePath = path.resolve(dirname, '../../standalone/index.html');
  await page.goto(pathToFileURL(filePath).href);

  const canvas = page.locator('maha-flow canvas');
  await expect(canvas).toHaveCount(1, { timeout: 10_000 });

  const result = await page.evaluate(async () => {
    const el = document.querySelector('maha-flow') as unknown as { core: { exportVideo: (cfg: unknown) => Promise<Blob> } };
    const blob = await el.core.exportVideo({ mode: 'offline', width: 160, height: 90, duration: 0.3, fps: 24 });
    return { size: blob.size, type: blob.type };
  });

  expect(result.size).toBeGreaterThan(0);
  expect(['video/mp4', 'video/webm']).toContain(result.type);
});

test('exportprogress/exportdone fire with the expected frame count', async ({ page }) => {
  const filePath = path.resolve(dirname, '../../standalone/index.html');
  await page.goto(pathToFileURL(filePath).href);
  await expect(page.locator('maha-flow canvas')).toHaveCount(1, { timeout: 10_000 });

  const result = await page.evaluate(async () => {
    const el = document.querySelector('maha-flow') as unknown as {
      core: { exportVideo: (cfg: unknown) => Promise<Blob>; on: (e: string, cb: (p: unknown) => void) => () => void };
    };
    const progress: unknown[] = [];
    let done: unknown = null;
    el.core.on('exportprogress', (p) => progress.push(p));
    el.core.on('exportdone', (d) => (done = d));
    await el.core.exportVideo({ mode: 'offline', width: 160, height: 90, duration: 0.2, fps: 24 });
    return { progressCount: progress.length, last: progress.at(-1), done: done !== null };
  });

  expect(result.progressCount).toBe(Math.round(0.2 * 24));
  expect((result.last as { ratio: number }).ratio).toBeCloseTo(1, 5);
  expect(result.done).toBe(true);
});

/** T-E07: cancelExport() interrupts a running export and leaves the core usable afterward. */
test('cancelExport() interrupts the export and normal display resumes', async ({ page }) => {
  const filePath = path.resolve(dirname, '../../standalone/index.html');
  await page.goto(pathToFileURL(filePath).href);
  await expect(page.locator('maha-flow canvas')).toHaveCount(1, { timeout: 10_000 });

  const result = await page.evaluate(async () => {
    const el = document.querySelector('maha-flow') as unknown as {
      core: {
        exportVideo: (cfg: unknown) => Promise<Blob>;
        cancelExport: () => void;
        setConfig: (p: unknown) => void;
        getState: () => { zoom: number };
      };
    };
    let errorMessage: string | null = null;
    const exportPromise = el.core
      .exportVideo({ mode: 'offline', width: 160, height: 90, duration: 5, fps: 24 })
      .catch((e: Error) => {
        errorMessage = e.message;
      });

    await new Promise((r) => setTimeout(r, 50));
    el.core.cancelExport();
    await exportPromise;

    // Core must still be fully usable post-cancel.
    el.core.setConfig({ zoom: 2 });
    return { cancelled: errorMessage !== null, zoomAfter: el.core.getState().zoom };
  });

  expect(result.cancelled).toBe(true);
  expect(result.zoomAfter).toBe(2);
});

/** T-E08: oversized resolution/fps are clamped with a warning instead of failing. */
test('exportVideo clamps resolution/fps above the browser-side limit and warns', async ({ page }) => {
  const filePath = path.resolve(dirname, '../../standalone/index.html');
  await page.goto(pathToFileURL(filePath).href);
  await expect(page.locator('maha-flow canvas')).toHaveCount(1, { timeout: 10_000 });

  const result = await page.evaluate(async () => {
    const el = document.querySelector('maha-flow') as unknown as {
      core: {
        exportVideo: (cfg: unknown) => Promise<Blob>;
        on: (e: string, cb: (p: unknown) => void) => () => void;
      };
    };
    const warnings: string[] = [];
    el.core.on('warning', (w: any) => warnings.push(w.code));
    const blob = await el.core.exportVideo({ mode: 'offline', width: 3000, height: 2000, duration: 0.1, fps: 24 });
    return { size: blob.size, warnings };
  });

  expect(result.size).toBeGreaterThan(0);
  expect(result.warnings).toContain('export-config-clamped');
});
