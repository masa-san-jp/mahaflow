import { test, expect } from '@playwright/test';

/**
 * P2b orbit view smoke test: constructs a real MahaFlowCore with
 * view:"orbit" against the real Three.js orbit renderer and confirms it
 * renders (canvas draws, no console errors) — jsdom can't exercise real
 * WebGL, so this is the only place the terrain/points/camera path runs.
 */
test('view:"orbit" renders a terrain+points scene with no console errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (err) => errors.push(String(err)));
  page.on('requestfailed', (req) => errors.push(`requestfailed: ${req.url()}`));
  page.on('response', (res) => {
    if (res.status() >= 400) errors.push(`http ${res.status()}: ${res.url()}`);
  });

  await page.goto('/test/visual/fixtures/export-modulation.html');

  const result = await page.evaluate(async () => {
    const modPath = '/dist/maha-flow.js'; const { MahaFlowCore } = await import(modPath);
    const container = document.createElement('div');
    container.style.width = '200px';
    container.style.height = '150px';
    document.body.appendChild(container);
    const core = new MahaFlowCore(container, { seed: 3, initialLive: { view: 'orbit' } });
    await core.ready;
    await new Promise((r) => setTimeout(r, 200));
    const canvas = container.querySelector('canvas');
    const size = { width: canvas?.width, height: canvas?.height };
    core.dispose();
    return size;
  });

  expect(result.width).toBeGreaterThan(0);
  expect(result.height).toBeGreaterThan(0);
  expect(errors).toEqual([]);
});

test('setConfig({view:"orbit"}) switches from field to orbit rendering live', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (err) => errors.push(String(err)));

  await page.goto('/test/visual/fixtures/export-modulation.html');

  const result = await page.evaluate(async () => {
    const modPath = '/dist/maha-flow.js'; const { MahaFlowCore } = await import(modPath);
    const container = document.createElement('div');
    container.style.width = '200px';
    container.style.height = '150px';
    document.body.appendChild(container);
    const core = new MahaFlowCore(container, { seed: 3 });
    await core.ready;
    await new Promise((r) => setTimeout(r, 100));
    core.setConfig({ view: 'orbit' });
    await new Promise((r) => setTimeout(r, 200));
    const state = core.getState();
    core.dispose();
    return { view: state.view };
  });

  expect(result.view).toBe('orbit');
  expect(errors).toEqual([]);
});
