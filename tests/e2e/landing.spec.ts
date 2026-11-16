import { expect, test } from '@playwright/test'

test('picking a place on the landing shows only its notes', async ({
  page,
}) => {
  const filter = page.getByLabel('Left at', { exact: true })

  await page.goto('/')
  await expect(filter.locator('option:checked')).toHaveText('Manchester')
  await expect(page.getByText('The queue at the till')).toBeVisible()

  await page.getByRole('button', { name: 'Table 4', exact: true }).click()
  await expect(filter.locator('option:checked')).toHaveText('Table 4')
  await expect(page.getByText('The table wobbled')).toBeVisible()
  await expect(page.getByText('The queue at the till')).toBeHidden()
  await expect(page.getByRole('status')).toHaveText(
    'Showing notes left at Table 4',
  )

  await filter.selectOption({ label: 'Lekki' })
  await expect(
    page.getByRole('button', { name: 'Lekki', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByText('Great jollof')).toBeVisible()
  await expect(page.getByText('The table wobbled')).toBeHidden()
})

test('the landing page never scrolls sideways, from phone to desktop', async ({
  page,
}) => {
  for (const width of [320, 390, 768, 1024, 1280]) {
    await page.setViewportSize({ width, height: 900 })
    await page.goto('/')
    const overflow = await page.evaluate(
      () =>
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
    )
    expect(overflow, `${width}px`).toBe(0)
  }
})
