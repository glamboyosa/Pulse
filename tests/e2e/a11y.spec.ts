import { createRequire } from 'node:module'
import { expect, test } from '@playwright/test'
import { customerWithVoice, db, signUpBusiness } from './support'
import type { Page } from '@playwright/test'

const axePath = createRequire(import.meta.url).resolve('axe-core')

/** Serious and critical axe violations against WCAG 2.2 AA, as rule ids. */
const axeViolations = async (page: Page) => {
  // Mid fade-in, text colours blend with the background and fail contrast.
  await page.evaluate(() =>
    Promise.allSettled(
      document
        .getAnimations()
        .filter((a) => a.effect?.getTiming().iterations !== Infinity)
        .map((a) => a.finished),
    ),
  )
  await page.addScriptTag({ path: axePath })
  const violations = await page.evaluate(async () => {
    const result = await (
      window as unknown as {
        axe: {
          run: (
            context: Document,
            options: object,
          ) => Promise<{
            violations: Array<{
              id: string
              impact: string | null
              nodes: Array<{ target: Array<string> }>
            }>
          }>
        }
      }
    ).axe.run(document, {
      runOnly: {
        type: 'tag',
        values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'],
      },
    })
    return result.violations
  })
  return violations
    .filter((v) => v.impact === 'serious' || v.impact === 'critical')
    .map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)
}

test('public pages have no serious axe violations, and the skip link reaches the content', async ({
  page,
}) => {
  for (const path of [
    '/',
    '/login',
    '/software',
    '/restaurants',
    '/compare/google-reviews',
    '/docs/widget',
  ]) {
    await page.goto(path)
    expect(await axeViolations(page), path).toEqual([])
  }

  await page.goto('/')
  // Focused directly: in development, Next's own overlay can take the first Tab.
  const skip = page.getByRole('link', { name: 'Skip to content' })
  await skip.focus()
  await expect(skip).toBeInViewport()
  await page.keyboard.press('Enter')
  await page.keyboard.press('Tab')
  // The next stop is inside the main content, past the header links.
  expect(
    await page.evaluate(() =>
      document.querySelector('main')?.contains(document.activeElement),
    ),
  ).toBe(true)
})

test('an owner can use the dashboard and buy page by keyboard alone', async ({
  page,
  browser,
}, testInfo) => {
  const run = `${testInfo.project.name}-${Date.now().toString(36)}`
  const email = `delivered+a11y-${run}@resend.dev`
  const code = `e2e-a11y-${run}`
  await signUpBusiness(page, email, code)

  await db.query(
    `with s as (
       insert into spots (user_id, name, slug)
       select id, 'Patio', 'patio' from users where email = $1 returning id, user_id
     )
     insert into feedback (user_id, status, sentiment, transcript, summary, customer_name, spot_id, source)
     select s.user_id, 'ready', r.sentiment, r.transcript, r.summary, r.name, case when r.patio then s.id end, 'text'
     from s, json_to_recordset($2::json) as r(sentiment text, transcript text, summary text, name text, patio boolean)`,
    [
      email,
      JSON.stringify([
        {
          sentiment: 'negative',
          transcript: 'The food took forever.',
          summary: 'Slow food',
          name: 'Test Customer 1',
          patio: true,
        },
        {
          sentiment: 'positive',
          transcript: 'Lovely staff.',
          summary: 'Lovely staff',
          name: 'Test Customer 2',
          patio: false,
        },
      ]),
    ],
  )

  await test.step('the dashboard, buy and print pages pass axe', async () => {
    for (const path of ['/dashboard', '/buy-pulses', '/print']) {
      await page.goto(path)
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
      expect(await axeViolations(page), path).toEqual([])
    }
  })

  await test.step('sentiment filters say which is on and announce the count', async () => {
    await page.goto('/dashboard')
    const negative = page.getByRole('button', { name: 'Negative' })
    await negative.focus()
    await page.keyboard.press('Enter')
    await expect(negative).toHaveAttribute('aria-pressed', 'true')
    await expect(
      page.getByRole('status').filter({ hasText: /note/ }),
    ).toHaveText('1 note')
    await expect(page.getByText('Test Customer 2')).toHaveCount(0)

    // A filter that matches nothing can still be undone.
    await page.getByRole('button', { name: 'Positive' }).press('Enter')
    // Real keys: open, type to jump to the place, choose it.
    const leftAt = page.getByLabel('Left at')
    await leftAt.press('Enter')
    // Opening moves focus to the chosen option; keys go there.
    await expect(
      page.getByRole('option', { name: 'All branches & tables' }),
    ).toBeFocused()
    await page.keyboard.type('Pat')
    await expect(page.getByRole('option', { name: 'Patio' })).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(leftAt).toHaveText('Patio')
    await expect(leftAt).toBeFocused()
    await expect(
      page.getByText('No feedback matches your filters.'),
    ).toBeVisible()
    await leftAt.press('Enter')
    await expect(page.getByRole('option', { name: 'Patio' })).toBeFocused()
    await page.keyboard.press('ArrowUp')
    await expect(
      page.getByRole('option', { name: 'All branches & tables' }),
    ).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(leftAt).toHaveText('All branches & tables')
    await expect(page.getByText('Test Customer 2')).toBeVisible()

    await page
      .getByRole('link', { name: 'View transcript from Test Customer 2' })
      .press('Enter')
    await page.waitForURL('**/feedback/**')
    expect(await axeViolations(page), 'feedback detail').toEqual([])
  })

  await test.step('packs are radios that arrow keys move between', async () => {
    await page.goto('/buy-pulses')
    const checked = page.getByRole('radio', { checked: true })
    await checked.focus()
    const before = await checked.inputValue()
    await page.keyboard.press('ArrowRight')
    const after = await page.getByRole('radio', { checked: true }).inputValue()
    expect(after).not.toBe(before)
    const custom = page.getByRole('radio', { name: 'Custom amount' })
    await custom.focus()
    await page.keyboard.press('Space')
    await expect(custom).toBeChecked()
    await expect(
      page.getByRole('slider', { name: 'Custom amount in pulses' }),
    ).toBeVisible()
  })

  await test.step('a customer records by keyboard and hears each step', async () => {
    const customer = await customerWithVoice(await browser.newContext())
    await customer.goto(`/f/${code}`)
    expect(await axeViolations(customer), 'feedback page').toEqual([])
    const status = customer.locator('p[role="status"]')

    await customer.getByRole('button', { name: 'Start recording' }).focus()
    await customer.keyboard.press('Enter')
    await expect(status).toHaveText(/^Recording\./)
    // The same button, now Stop, keeps focus.
    await expect(
      customer.getByRole('button', { name: 'Stop recording' }),
    ).toBeFocused()
    await customer.waitForTimeout(2000)
    await customer.keyboard.press('Enter')
    await expect(status).toHaveText(/^Recorded 0:0\d\.$/)
    await expect(
      customer.getByText('Listen back before you send'),
    ).toBeFocused()
    await expect(customer.getByLabel('Your recording')).toBeVisible()

    // Sending is faked: this checks what the customer is told, not delivery.
    await customer.route('**/api/feedback/submit', (route) =>
      route.fulfill({ json: { feedbackId: null } }),
    )
    await customer.getByRole('button', { name: 'SEND FEEDBACK' }).press('Enter')
    await expect(
      customer.getByRole('heading', { name: 'Thank you!' }),
    ).toBeFocused()
    expect(await axeViolations(customer), 'thank-you').toEqual([])
    await customer.context().close()
  })

  await test.step('a customer who blocks the microphone can switch to typing', async () => {
    const context = await browser.newContext()
    await context.addInitScript(() => {
      navigator.mediaDevices.getUserMedia = () =>
        Promise.reject(new DOMException('Blocked', 'NotAllowedError'))
    })
    const customer = await context.newPage()
    await customer.goto(`/f/${code}`)
    const start = customer.getByRole('button', { name: 'Start recording' })
    await expect(start).toBeEnabled()
    await start.press('Enter')
    await expect(customer.locator('p[role="status"]')).toHaveText(
      'Microphone is blocked.',
    )
    await customer
      .getByRole('button', { name: 'Prefer to type?' })
      .press('Enter')
    await expect(customer.getByLabel('Your feedback')).toBeFocused()

    await customer.route('**/api/feedback/submit-text', (route) =>
      route.fulfill({ status: 400, json: { error: 'Test refusal' } }),
    )
    await customer.keyboard.type('The chairs wobble.')
    await customer.getByRole('button', { name: 'SEND FEEDBACK' }).press('Enter')
    await expect(
      customer.getByRole('alert').filter({ hasText: 'Test refusal' }),
    ).toBeVisible()
    await expect(customer.getByLabel('Your feedback')).toHaveAttribute(
      'aria-invalid',
      'true',
    )
    await expect(
      customer.getByLabel('Your feedback'),
    ).toHaveAccessibleDescription(/Test refusal/)
    await context.close()
  })
})
