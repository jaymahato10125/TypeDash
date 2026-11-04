import { expect, test } from '@playwright/test'
import { fullHistory } from '../fixtures/progress'

test('typing and repeated restarts need no network after readiness, including with full history', async ({ page, context }) => {
  await page.addInitScript(progress => localStorage.setItem('typedash.progress', JSON.stringify(progress)), fullHistory())
  await page.goto('/')
  await page.getByRole('button', { name: 'History', exact: true }).click()
  await expect(page.getByTestId('history-count')).toHaveText('100')
  await page.getByRole('button', { name: 'Close history' }).click()
  await page.evaluate(() => document.fonts.ready)
  await page.waitForLoadState('networkidle')
  const requests: string[] = []
  page.on('request', request => requests.push(request.url()))
  await context.setOffline(true)
  for (let index = 0; index < 20; index++) {
    await page.getByRole('textbox', { name: 'Typing input' }).pressSequentially('x')
    await expect(page.getByTestId('typing-test')).toHaveAttribute('data-status', 'running')
    await page.getByRole('button', { name: 'Restart test' }).click()
    await expect(page.getByTestId('typing-test')).toHaveAttribute('data-status', 'ready')
    await expect(page.getByRole('textbox', { name: 'Typing input' })).toBeFocused()
    expect(await page.locator('[data-target]').count()).toBeLessThanOrEqual(64)
  }
  expect(requests).toEqual([])
})

test('a failed graph download keeps scores, saving, and restart available', async ({ page }) => {
  await page.clock.install()
  await page.route('**/assets/SpeedChart-*.js', route => route.abort())
  await page.goto('/')
  await page.getByRole('button', { name: 'Words mode', exact: true }).click()
  await page.getByRole('button', { name: '10 words', exact: true }).click()
  const words = await page.locator('[data-target]').evaluateAll(nodes => nodes.map(node => node.getAttribute('data-target')!))
  const input = page.getByRole('textbox', { name: 'Typing input' })
  await input.pressSequentially(words.slice(0, -1).join(' ') + ' ')
  await page.clock.fastForward(1000)
  await input.pressSequentially(words.at(-1)!)
  await expect(page.getByText('The graph couldn’t load. Your scores are still available.')).toBeVisible()
  await expect(page.getByTestId('result-accuracy')).toHaveText('100.0%')
  await expect(page.getByTestId('save-status')).toContainText('Saved on this device')
  await page.getByRole('button', { name: 'New test', exact: true }).click()
  await expect(input).toBeFocused()
  await expect(page.getByTestId('typing-test')).toHaveAttribute('data-status', 'ready')
})
