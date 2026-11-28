import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

test('picking a place on the landing shows only its notes', async ({
  page,
}) => {
  const filter = page.getByLabel('Left at', { exact: true })

  await page.goto('/')
  await expect(filter).toHaveText('Manchester')
  await expect(page.getByText('The queue at the till')).toBeVisible()

  await page.getByRole('button', { name: 'Table 4', exact: true }).click()
  await expect(filter).toHaveText('Table 4')
  await expect(page.getByText('The table wobbled')).toBeVisible()
  await expect(page.getByText('The queue at the till')).toBeHidden()
  await expect(page.getByRole('status')).toHaveText(
    'Showing notes left at Table 4',
  )

  await filter.click()
  await page.getByRole('option', { name: 'Lekki' }).click()
  await expect(
    page.getByRole('button', { name: 'Lekki', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByText('Great jollof')).toBeVisible()
  await expect(page.getByText('The table wobbled')).toBeHidden()
})

test('public pages never scroll sideways, from phone to desktop', async ({
  page,
}) => {
  for (const path of ['/', '/restaurants', '/compare/google-reviews']) {
    for (const width of [320, 390, 768, 1024, 1280]) {
      await page.setViewportSize({ width, height: 900 })
      await page.goto(path)
      const overflow = await page.evaluate(
        () =>
          document.documentElement.scrollWidth -
          document.documentElement.clientWidth,
      )
      expect(overflow, `${path} at ${width}px`).toBe(0)
    }
  }
})

test('the example voice note plays itself, unless the visitor asks for less motion', async ({
  browser,
}) => {
  const filled = (page: Page) =>
    page
      .locator('#hero-example span.will-change-transform')
      .evaluateAll(
        (bars) =>
          bars.filter((bar) => getComputedStyle(bar).opacity === '1').length,
      )
  for (const reducedMotion of ['no-preference', 'reduce'] as const) {
    const context = await browser.newContext({ reducedMotion })
    const page = await context.newPage()
    await page.goto('/')
    await page.locator('#hero-example').scrollIntoViewIfNeeded()
    // Picking a customer always plays their note, whenever the first play ran.
    await page.getByRole('tab', { name: /Toke/ }).click()
    if (reducedMotion === 'reduce') {
      await page.waitForTimeout(1000)
      expect(await filled(page)).toBe(11)
    } else {
      await expect.poll(() => filled(page)).toBeGreaterThan(11)
    }
    await context.close()
  }
})
