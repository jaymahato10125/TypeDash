import { test } from '@playwright/test'
import { mkdir, writeFile } from 'node:fs/promises'

declare global { interface Window { __nativeKeyPaint: number[] } }

// A native textarea isolates the browser/display pipeline from TypeDash code.
test('record a native-textarea presentation baseline', async ({ page, browser }, testInfo) => {
  await page.setContent('<label>Native typing reference<textarea aria-label="Native typing reference" rows="12" cols="70" style="font:28px monospace"></textarea></label>')
  await page.bringToFront()
  await page.evaluate(() => {
    window.__nativeKeyPaint = []
    new PerformanceObserver(list => {
      for (const entry of list.getEntries()) if (entry.name === 'keydown') window.__nativeKeyPaint.push(entry.duration)
    }).observe({ type: 'event', durationThreshold: 16 } as PerformanceObserverInit & { durationThreshold: number })
  })
  const text = 'the quick brown fox jumps over the lazy dog '.repeat(7).slice(0, 265)
  await page.getByRole('textbox', { name: 'Native typing reference' }).pressSequentially(text, { delay: 40 })
  // Event Timing entries arrive after presentation in an asynchronous observer.
  await page.waitForTimeout(200)
  const durations = await page.evaluate(() => window.__nativeKeyPaint)
  const bounds = [...durations.map(duration => duration + 4), ...Array(Math.max(0, text.length - durations.length)).fill(16)].toSorted((a, b) => a - b)
  const report = {
    measuredAt: new Date().toISOString(), browser: browser.version(), headless: testInfo.project.use.headless ?? true,
    scope: 'Native textarea with no TypeDash code. Event Timing is rounded to 8 ms; reported values add 4 ms as a conservative rounding bound.',
    keydowns: text.length, observedEntries: durations.length,
    p95UpperBoundMs: bounds[Math.ceil(bounds.length * 0.95) - 1], maxUpperBoundMs: bounds.at(-1),
    roundedDurations: durations,
  }
  await mkdir('performance-results', { recursive: true })
  await writeFile('performance-results/native-baseline.json', JSON.stringify(report, null, 2) + '\n')
})
