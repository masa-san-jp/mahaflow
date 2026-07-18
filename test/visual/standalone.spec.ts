import { test, expect } from '@playwright/test';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * T-S05: the standalone build must run by opening the HTML file directly
 * (double-click), with no dev server. This loads it via file:// exactly as
 * a user would.
 */
test('standalone HTML renders a canvas with no console errors when opened via file://', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (err) => errors.push(String(err)));
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });

  const filePath = path.resolve(dirname, '../../standalone/index.html');
  await page.goto(pathToFileURL(filePath).href);

  const canvas = page.locator('maha-flow canvas');
  await expect(canvas).toHaveCount(1, { timeout: 10_000 });

  const box = await canvas.boundingBox();
  expect(box?.width).toBeGreaterThan(0);
  expect(box?.height).toBeGreaterThan(0);

  // Give the dev panel's lazy dynamic import (ui:"dev") a moment to land.
  await page.waitForTimeout(300);
  await expect(page.locator('.maha-devpanel')).toHaveCount(1);

  expect(errors).toEqual([]);
});
