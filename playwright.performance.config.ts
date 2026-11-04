import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests/performance',
  workers: 1,
  retries: 0,
  timeout: 120_000,
  reporter: 'list',
  use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 }, baseURL: 'http://127.0.0.1:4185' },
  projects: [{ name: 'chromium-performance' }],
  webServer: { command: 'npm run preview -- --port 4185 --strictPort', url: 'http://127.0.0.1:4185', reuseExistingServer: false },
})
