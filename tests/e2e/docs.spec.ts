import { expect, test } from '@playwright/test'

test('a link to a stack opens the install code on that stack', async ({
  page,
}) => {
  const stacks = page.getByRole('group', { name: 'Your stack' })
  const code = page.locator('#install pre')

  await page.goto('/docs/widget#options')
  await expect(page.locator('#options')).toBeInViewport()
  await expect(stacks.getByRole('button', { name: 'HTML' })).toHaveAttribute(
    'aria-pressed',
    'true',
  )

  // Start far down the page so the link has to scroll back to the tabs.
  await page.goto('/docs/widget#troubleshooting')
  await page.evaluate(() => {
    window.location.hash = 'install-vue'
  })
  await expect(
    stacks.getByRole('button', { name: 'Vue / Nuxt' }),
  ).toHaveAttribute('aria-pressed', 'true')
  await expect(code).toContainText('defineNuxtConfig')
  // The tabs sit near the top of the screen, not above or below it.
  await expect
    .poll(async () => {
      const y = (await stacks.boundingBox())?.y ?? -1
      return y >= 0 && y < 100
    })
    .toBe(true)

  await stacks.getByRole('button', { name: 'Next.js' }).click()
  await expect(page).toHaveURL(/#install-next$/)
})
