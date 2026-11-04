import { defineConfig, devices } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import { resolve } from 'node:path'

// Isolate bundled Firefox from macOS-protected personal Firefox app data.
// Scope these overrides to this test process; no OS permission changes are needed.
if (process.platform === 'darwin') {
  for (const key of ['MOZ_APP_DATA', 'MOZ_LOCAL_APP_DATA']) {
    if (process.env[key]) continue
    const directory = resolve('node_modules/.cache/typedash-firefox', key)
    mkdirSync(directory, { recursive: true })
    process.env[key] = directory
  }
}

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  workers: process.env.CI ? 2 : undefined,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }], ['json', { outputFile: 'test-results/results.json' }]] : 'list',
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
  webServer: {
    command: 'npm run preview -- --port 4173 --strictPort',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: !process.env.CI,
  },
})
