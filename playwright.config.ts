import { defineConfig } from '@playwright/test';
import { existsSync } from 'node:fs';

// This sandbox pre-installs Chromium outside Playwright's managed cache;
// use it when present, otherwise fall back to Playwright's own resolution
// (CI runs `npx playwright install --with-deps chromium` first).
const sandboxChromium = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const executablePath = existsSync(sandboxChromium) ? sandboxChromium : undefined;

export default defineConfig({
  testDir: 'test/visual',
  use: {
    launchOptions: executablePath ? { executablePath } : {},
  },
});
