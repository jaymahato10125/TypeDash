import { expect, test } from '@playwright/test'
import type { CDPSession } from '@playwright/test'
import { mkdir, writeFile } from 'node:fs/promises'
import { cpus, platform, arch } from 'node:os'
import { fullHistory } from '../fixtures/progress'

declare global { interface Window { __typedashInteraction: { tracing: boolean; keydowns: number; clickTiming: number[]; eventTiming: { duration: number; startTime: number }[]; inputTimestamps: number[]; processingMs: number[]; feedbackRafMs: number[]; restartRafMs: number[] } } }

function distribution(values: number[]) {
  const sorted = values.toSorted((a, b) => a - b)
  return { samples: sorted.length, medianMs: sorted[Math.floor(sorted.length / 2)] ?? null, p95Ms: sorted[Math.max(0, Math.ceil(sorted.length * 0.95) - 1)] ?? null, maxMs: sorted.at(-1) ?? null }
}

async function listeners(client: CDPSession, appScripts: Set<string>) {
  const counts: Record<string, number> = {}
  const application: Record<string, number> = {}
  for (const expression of ['window', 'document', 'document.getElementById("typing-input")']) {
    const { result } = await client.send('Runtime.evaluate', { expression })
    try {
      const { listeners } = await client.send('DOMDebugger.getEventListeners', { objectId: result.objectId! })
      counts[expression] = listeners.length
      application[expression] = listeners.filter(listener => appScripts.has(listener.scriptId)).length
    } finally { await client.send('Runtime.releaseObject', { objectId: result.objectId! }) }
  }
  return { all: counts, application }
}

test('record fast typing, full-history restarts, listener stability, and a presentation trace', async ({ page, context, browser }, testInfo) => {
  await page.addInitScript(progress => localStorage.setItem('typedash.progress', JSON.stringify(progress)), fullHistory())
  await page.goto('/')
  await page.getByRole('button', { name: '120 seconds', exact: true }).click()
  await page.getByRole('button', { name: 'History', exact: true }).click()
  await expect(page.getByTestId('history-count')).toHaveText('100')
  await page.getByRole('button', { name: 'Close history' }).click()
  await page.evaluate(() => document.fonts.ready)
  await page.waitForLoadState('networkidle')
  await page.bringToFront()
  const cadence = await page.evaluate(() => new Promise<number[]>(resolve => {
    const intervals: number[] = []
    let previous = 0
    function frame(now: number) {
      if (previous) intervals.push(now - previous)
      previous = now
      if (intervals.length >= 120) resolve(intervals)
      else requestAnimationFrame(frame)
    }
    requestAnimationFrame(frame)
  }))
  await page.evaluate(() => {
    const stats = { tracing: false, keydowns: 0, clickTiming: [] as number[], eventTiming: [] as { duration: number; startTime: number }[], inputTimestamps: [] as number[], processingMs: [] as number[], feedbackRafMs: [] as number[], restartRafMs: [] as number[] }
    window.__typedashInteraction = stats
    new PerformanceObserver(list => {
      for (const entry of list.getEntries()) {
        if (entry.name === 'keydown') stats.eventTiming.push({ duration: entry.duration, startTime: entry.startTime })
        if (entry.name === 'click') stats.clickTiming.push(entry.duration)
      }
    }).observe({ type: 'event', durationThreshold: 16 } as PerformanceObserverInit & { durationThreshold: number })
    document.addEventListener('keydown', event => { if ((event.target as Element).id === 'typing-input' && event.isTrusted) stats.keydowns++ }, true)
    const starts = new WeakMap<Event, number>()
    let pending: { start: number; sequence: number }[] = []
    let sequence = 0
    let scheduled = false
    document.addEventListener('beforeinput', event => {
      if ((event.target as Element)?.id !== 'typing-input') return
      const now = performance.now()
      starts.set(event, now)
      stats.inputTimestamps.push(now)
      const sample = stats.tracing ? ++sequence : 0
      pending.push({ start: now, sequence: sample })
      if (sample) performance.mark(`typedash:input:${sample}`)
    }, true)
    document.addEventListener('beforeinput', event => {
      const start = starts.get(event)
      if (start !== undefined) stats.processingMs.push(performance.now() - start)
    })
    new MutationObserver(() => {
      if (!pending.length || scheduled) return
      scheduled = true
      for (const sample of pending) if (sample.sequence) performance.mark(`typedash:commit:${sample.sequence}`)
      requestAnimationFrame(() => {
        const now = performance.now()
        stats.feedbackRafMs.push(...pending.map(sample => now - sample.start))
        pending = []
        scheduled = false
      })
    }).observe(document.querySelector('[data-testid="typing-test"]')!, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-state', 'data-active'] })
    document.addEventListener('click', event => {
      if (!(event.target as Element).closest('[aria-label="Restart test"]')) return
      const start = event.timeStamp
      function ready() {
        if (document.querySelector('[data-testid="typing-test"]')?.getAttribute('data-status') === 'ready' && document.activeElement?.id === 'typing-input') stats.restartRafMs.push(performance.now() - start)
        else if (performance.now() - start < 5000) requestAnimationFrame(ready)
      }
      requestAnimationFrame(ready)
    })
  })
  const client = await context.newCDPSession(page)
  const appScripts = new Set<string>()
  client.on('Debugger.scriptParsed', script => { if (script.url.startsWith('http://127.0.0.1:4185/assets/')) appScripts.add(script.scriptId) })
  await client.send('Debugger.enable')
  const beforeListeners = await listeners(client, appScripts)
  const requests: string[] = []
  page.on('request', request => requests.push(request.url()))
  const targets = await page.locator('[data-target]').evaluateAll(nodes => nodes.map(node => node.getAttribute('data-target')!))
  const text = targets.slice(0, 55).join(' ') + ' '
  await page.getByRole('textbox', { name: 'Typing input' }).pressSequentially(text, { delay: 40 })
  expect(await page.locator('[data-target]').count()).toBeLessThanOrEqual(64)
  for (let index = 0; index < 20; index++) {
    await page.getByRole('button', { name: 'Restart test' }).click()
    await expect(page.getByRole('textbox', { name: 'Typing input' })).toBeFocused()
    await expect.poll(() => page.evaluate(() => window.__typedashInteraction.restartRafMs.length)).toBe(index + 1)
  }
  await page.waitForTimeout(200)
  const afterListeners = await listeners(client, appScripts)
  const samples = await page.evaluate(() => window.__typedashInteraction)
  const report = {
    measuredAt: new Date().toISOString(), browser: browser.version(),
    headless: testInfo.project.use.headless ?? true,
    host: { platform: platform(), architecture: arch(), cpu: cpus()[0]?.model },
    scope: 'Native beforeinput propagation includes application handlers. Feedback/restart rAF timings are pre-paint proxies, not proof of physical presentation latency. Inspect browser-trace.json and a headed 60 Hz reference run for the 32 ms release gate.',
    requestedInterKeyDelayMs: 40,
    measuredWpm: (samples.inputTimestamps.length - 1) * 12000 / (samples.inputTimestamps.at(-1)! - samples.inputTimestamps[0]!),
    fullHistory: 100, cadence: distribution(cadence),
    processing: distribution(samples.processingMs), feedbackRafProxy: distribution(samples.feedbackRafMs), restartRafProxy: distribution(samples.restartRafMs),
    keyboardNextPaint: {
      source: 'Event Timing API without trace recording; duration is rounded to 8 ms. Add 4 ms for a conservative rounding bound. Entries below the 16 ms observation threshold are included with a conservative 16 ms bound.',
      keydowns: samples.keydowns, observedEntries: samples.eventTiming.length,
      observedRoundedDurations: samples.eventTiming.map(entry => entry.duration),
      observedRounded: distribution(samples.eventTiming.map(entry => entry.duration)),
      upperBound: distribution([...samples.eventTiming.map(entry => entry.duration + 4), ...Array(Math.max(0, samples.keydowns - samples.eventTiming.length)).fill(16)]),
    },
    restartNextPaint: {
      clicks: 20, observedEntries: samples.clickTiming.length,
      upperBound: distribution([...samples.clickTiming.map(duration => duration + 4), ...Array(Math.max(0, 20 - samples.clickTiming.length)).fill(16)]),
    },
    listeners: { before: beforeListeners, after: afterListeners }, networkRequestsDuringTypingAndRestarts: requests,
  }
  const gates = {
    inputProcessing: report.processing.p95Ms !== null && report.processing.p95Ms <= 4,
    restartReady: report.restartRafProxy.p95Ms !== null && report.restartRafProxy.p95Ms <= 100,
    restartPresentation: report.restartNextPaint.upperBound.p95Ms !== null && report.restartNextPaint.upperBound.p95Ms <= 100,
    keyboardPresentation: report.keyboardNextPaint.upperBound.p95Ms !== null && report.keyboardNextPaint.upperBound.p95Ms <= 32,
  }
  await mkdir('performance-results', { recursive: true })
  await writeFile('performance-results/interaction.json', JSON.stringify({ ...report, gates }, null, 2) + '\n')

  // Record presentation evidence separately so trace overhead does not affect the samples above.
  const events: unknown[] = []
  client.on('Tracing.dataCollected', event => events.push(...event.value))
  await client.send('Tracing.start', { categories: 'devtools.timeline,blink.user_timing,benchmark,cc,viz,disabled-by-default-devtools.timeline.frame,disabled-by-default-devtools.screenshot', transferMode: 'ReportEvents' })
  await page.evaluate(() => { window.__typedashInteraction.tracing = true })
  const traceText = (await page.locator('[data-target]').evaluateAll(nodes => nodes.slice(0, 40).map(node => node.getAttribute('data-target')!).join(' '))).slice(0, 160)
  await page.getByRole('textbox', { name: 'Typing input' }).pressSequentially(traceText, { delay: 40 })
  const complete = new Promise<void>(resolve => client.once('Tracing.tracingComplete', () => resolve()))
  await client.send('Tracing.end')
  await complete
  await writeFile('performance-results/browser-trace.json', JSON.stringify({ traceEvents: events }))
  await page.screenshot({ path: 'performance-results/tested-typing.png', fullPage: true })
  // Playwright injects its own global listeners on first keyboard use. Compare
  // listeners from the application bundles, and preserve total counts as context.
  expect(beforeListeners.application.window).toBeGreaterThanOrEqual(3)
  expect(beforeListeners.application['document.getElementById("typing-input")']).toBeGreaterThanOrEqual(7)
  expect(afterListeners.application).toEqual(beforeListeners.application)
  expect(requests).toEqual([])
  expect(report.processing.samples).toBeGreaterThanOrEqual(text.length)
  expect(report.processing.p95Ms).not.toBeNull()
  expect(report.processing.p95Ms!).toBeLessThanOrEqual(4)
  expect(report.restartRafProxy.p95Ms!).toBeLessThanOrEqual(100)
  expect(report.restartNextPaint.observedEntries).toBeLessThanOrEqual(20)
  expect(report.restartNextPaint.upperBound.p95Ms!).toBeLessThanOrEqual(100)
  expect(report.keyboardNextPaint.keydowns).toBe(text.length)
  expect(report.keyboardNextPaint.observedEntries).toBeLessThanOrEqual(text.length)
  // Use browser next-paint data, including a conservative privacy-rounding
  // bound, instead of treating a pre-paint rAF callback as visible feedback.
  expect(report.keyboardNextPaint.upperBound.p95Ms!).toBeLessThanOrEqual(32)
})
