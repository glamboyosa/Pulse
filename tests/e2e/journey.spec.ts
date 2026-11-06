import { expect, test } from '@playwright/test'

import { customerWithVoice, db, signUpBusiness } from './support'

test('a business signs up, a customer leaves voice feedback, the owner hears it', async ({
  page,
  browser,
}, testInfo) => {
  const run = `${testInfo.project.name}-${Date.now().toString(36)}`
  const email = `delivered+${run}@resend.dev`
  const code = `e2e-${run}`

  await test.step('owner signs in with an emailed code and sets up', async () => {
    await signUpBusiness(page, email, code)
    await expect(
      page.getByRole('heading', { name: 'YOUR QR CODE' }),
    ).toBeVisible()
  })

  await test.step('new businesses start with 5 pulses', async () => {
    const { rows } = await db.query(
      'select pulses_remaining from users where email = $1',
      [email],
    )
    expect(rows[0].pulses_remaining).toBe(5)
  })

  await test.step('owner adds a spot for the patio', async () => {
    await page.getByLabel('New spot name').fill('Patio')
    await page.getByRole('button', { name: 'ADD' }).click()
    await expect(
      page.getByRole('button', { name: 'Download QR code for Patio' }),
    ).toBeVisible()
  })

  await test.step('a customer records, listens back and sends', async () => {
    const customer = await browser.newContext()
    const feedbackPage = await customerWithVoice(customer)
    await feedbackPage.goto(`/f/${code}?spot=patio`)
    await expect(feedbackPage.getByText('Patio')).toBeVisible()
    await feedbackPage.getByLabel('Your name (optional)').fill('Grace')
    await feedbackPage.getByRole('button', { name: 'START RECORDING' }).click()
    await expect(
      feedbackPage.getByText(/Recording… stops on its own/),
    ).toBeVisible()
    await feedbackPage.waitForTimeout(7000)
    await feedbackPage.getByRole('button', { name: 'STOP' }).click()
    await expect(feedbackPage.getByLabel('Your recording')).toBeVisible()
    await feedbackPage.getByRole('button', { name: 'SEND FEEDBACK' }).click()
    await expect(feedbackPage.getByText('THANK YOU!')).toBeVisible()
    await customer.close()
  })

  await test.step('the owner sees the transcript and can play the recording', async () => {
    await expect(async () => {
      await page.reload()
      await expect(page.getByText(/jollof/i).first()).toBeVisible({
        timeout: 2000,
      })
    }).toPass({ timeout: 90_000, intervals: [3000] })

    await expect(page.getByText('Grace').first()).toBeVisible()
    const { rows } = await db.query(
      `select f.status, f.sentiment, f.duration, u.pulses_remaining from feedback f
       join users u on u.id = f.user_id where u.email = $1`,
      [email],
    )
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ status: 'ready', pulses_remaining: 4 })
    expect(['positive', 'neutral', 'negative']).toContain(rows[0].sentiment)
    expect(rows[0].duration).toBeGreaterThanOrEqual(5)

    await page.getByRole('button', { name: 'Play recording' }).click()
    await expect(
      page.getByRole('button', { name: 'Pause recording' }),
    ).toBeVisible()
    await expect(page.getByText(/couldn.t play/i)).toHaveCount(0)
  })

  await test.step('the feedback is tagged with its spot and can be filtered', async () => {
    // Once in the spots list, once as the tag on the feedback card.
    await expect(
      page.getByRole('listitem').filter({ hasText: /^Patio$/ }),
    ).toHaveCount(2)
    // A recording from the main QR code, with no spot.
    await db.query(
      `insert into feedback (user_id, status, customer_name, transcript)
       select id, 'ready', 'Tunde', 'Good food.' from users where email = $1`,
      [email],
    )
    await page.reload()
    await expect(page.getByText('Tunde')).toBeVisible()

    await page.getByLabel('Spot', { exact: true }).selectOption('Patio')
    await expect(page.getByText('Grace').first()).toBeVisible()
    await expect(page.getByText('Tunde')).toHaveCount(0)
  })

  await test.step('the detail page shows the full transcript', async () => {
    await page.getByRole('button', { name: 'View transcript' }).click()
    await page.waitForURL('**/feedback/**')
    await expect(page.getByText(/Hi, my name is Grace/)).toBeVisible()
    // The one-line summary and themes from the analysis sit above it.
    const { rows } = await db.query<{ summary: string; themes: Array<string> }>(
      `select f.summary, f.themes from feedback f join users u on u.id = f.user_id
       where u.email = $1`,
      [email],
    )
    expect(rows[0].themes.length).toBeGreaterThan(0)
    await expect(page.getByText(rows[0].summary)).toBeVisible()
  })

  await test.step('a business with no pulses left stops taking recordings', async () => {
    await db.query('update users set pulses_remaining = 0 where email = $1', [
      email,
    ])
    const customer = await browser.newContext()
    const feedbackPage = await customer.newPage()
    await feedbackPage.goto(`/f/${code}`)
    await expect(
      feedbackPage.getByText('NOT TAKING FEEDBACK RIGHT NOW'),
    ).toBeVisible()
    await customer.close()
  })

  await test.step('the buy page prices a custom amount at the pack rate', async () => {
    await page.goto('/buy-pulses')
    await expect(page.getByText('$16').first()).toBeVisible()
    await page.getByText('CUSTOM AMOUNT').click()
    await expect(page.getByText('50 pulses', { exact: true })).toBeVisible()
    await expect(page.getByText('$30').first()).toBeVisible()
  })
})
