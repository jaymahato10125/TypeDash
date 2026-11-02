import { expect, test } from '@playwright/test'

test('the preview stays usable at narrow and wide viewport sizes', async ({ page }) => {
  for (const width of [360, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    await page.goto('/')
    await expect(page).toHaveTitle('TypeDash — Find your rhythm')
    await expect(page.getByRole('heading', { name: 'Find your rhythm.' })).toBeVisible()
    await expect(page.getByText('practice preview', { exact: true })).toBeVisible()
    const hasOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)
    expect(hasOverflow).toBe(false)
    const initial = await page.getByLabel('Sample typing prompt').textContent()
    await page.getByRole('button', { name: 'Refresh sample text' }).click()
    await expect(page.getByLabel('Sample typing prompt')).not.toHaveText(initial ?? '')
  }
})

test('about supports dismissal with Escape and restores keyboard focus', async ({ page }) => {
  await page.goto('/')
  const about = page.getByRole('button', { name: 'About TypeDash', exact: true })
  await about.click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(dialog).not.toBeVisible()
  await expect(about).toBeFocused()
})

test('the skip link is available from the keyboard', async ({ page }) => {
  await page.goto('/')
  await page.keyboard.press('Tab')
  await expect(page.getByRole('link', { name: 'Skip to practice' })).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('main')).toBeFocused()
})
