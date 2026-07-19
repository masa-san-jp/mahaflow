import { test, expect } from '@playwright/test';

/**
 * T-E09: a deterministic (frame-only) ModulationSource must drive Method B
 * export identically to how it drives the live display loop — both paths
 * share MahaFlowCore's private evaluateFrame(frameNumber), so this proves
 * that architectural guarantee end-to-end against the real renderer.
 * Requires `npm run build` first (imports dist/maha-flow.js). Served over
 * HTTP (see playwright.config.ts's webServer) because Chromium blocks
 * cross-file module imports under file://.
 */
test('a frame-only modulation source produces the exact expected zoom per exported frame', async ({ page }) => {
  await page.goto('/test/visual/fixtures/export-modulation.html');

  const result = await page.evaluate(() => (window as any).runModulationExportTest(8, 20));

  expect(result.blobSize).toBeGreaterThan(0);
  expect(result.recordedZoom).toEqual(result.expectedZoom);
});
