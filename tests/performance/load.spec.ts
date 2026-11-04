import { expect, test } from '@playwright/test'
import { mkdir, writeFile } from 'node:fs/promises'
import { cpus, platform, arch } from 'node:os'

declare global { interface Window { __typedashLcp: number } }

test('five cold loads meet the Fast 4G and 4x CPU reference budgets', async ({ browser, baseURL }) => {
  const runs: { lcpMs: number; readyMs: number }[] = []
  for (let run = 0; run < 5; run++) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
    try {
      const page = await context.newPage()
      const client = await context.newCDPSession(page)
      await client.send('Network.enable')
      await client.send('Network.setCacheDisabled', { cacheDisabled: true })
      await client.send('Network.emulateNetworkConditions', { offline: false, downloadThroughput: 1_012_500, uploadThroughput: 168_750, latency: 165 })
      await client.send('Emulation.setCPUThrottlingRate', { rate: 4 })
      await page.addInitScript(() => {
        window.__typedashLcp = 0
        new PerformanceObserver(list => { for (const entry of list.getEntries()) window.__typedashLcp = entry.startTime }).observe({ type: 'largest-contentful-paint', buffered: true })
      })
      await page.goto(baseURL!)
      await page.waitForFunction(() => performance.getEntriesByName('typedash:ready').length > 0)
      await page.evaluate(() => document.fonts.ready)
      await page.waitForLoadState('networkidle')
      const result = await page.evaluate(() => ({ lcpMs: window.__typedashLcp, readyMs: performance.getEntriesByName('typedash:ready')[0]!.startTime }))
      expect(result.lcpMs).toBeGreaterThan(0)
      runs.push(result)
    } finally { await context.close() }
  }
  const median = (values: number[]) => values.toSorted((a, b) => a - b)[2]!
  const report = { measuredAt: new Date().toISOString(), browser: browser.version(), host: { platform: platform(), architecture: arch(), cpu: cpus()[0]?.model }, profile: { coldCache: true, cpuSlowdown: 4, downloadBytesPerSecond: 1_012_500, uploadBytesPerSecond: 168_750, latencyMs: 165 }, runs, medianLcpMs: median(runs.map(run => run.lcpMs)), medianReadyMs: median(runs.map(run => run.readyMs)) }
  await mkdir('performance-results', { recursive: true })
  await writeFile('performance-results/loading.json', JSON.stringify(report, null, 2) + '\n')
  expect(report.medianLcpMs).toBeLessThanOrEqual(1500)
  expect(report.medianReadyMs).toBeLessThanOrEqual(2000)
})
