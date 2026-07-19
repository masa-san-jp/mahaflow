import { defineConfig } from '@playwright/test';
import { existsSync } from 'node:fs';

// This sandbox pre-installs Chromium outside Playwright's managed cache;
// use it when present, otherwise fall back to Playwright's own resolution
// (CI runs `npx playwright install --with-deps chromium` first).
const sandboxChromium = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const executablePath = existsSync(sandboxChromium) ? sandboxChromium : undefined;
const port = 4173;

export default defineConfig({
  testDir: 'test/visual',
  use: {
    launchOptions: executablePath ? { executablePath } : {},
    baseURL: `http://localhost:${port}`,
  },
  // Only needed by tests that import a built module across files (browsers
  // block cross-file module imports under file://); file://-based tests
  // (e.g. the standalone build, which is a single self-contained script)
  // don't use this server.
  webServer: {
    command: `node scripts/static-server.mjs`,
    port,
    reuseExistingServer: !process.env.CI,
    env: { STATIC_SERVER_PORT: String(port) },
  },
});
