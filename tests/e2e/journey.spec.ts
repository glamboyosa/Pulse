import { readFileSync } from 'node:fs'
import { expect, test } from '@playwright/test'
import pg from 'pg'
import type { BrowserContext, Page } from '@playwright/test'

// Reads login codes and adjusts balances directly, as an operator would. Point
// E2E_DATABASE_URL at the database the app under test uses; never production.
const db = new pg.Pool({
  connectionString:
    process.env.E2E_DATABASE_URL ??
    'postgres://postgres@localhost:5440/pulse_dev',
})

test.afterAll(() => db.end())

const latestCode = async (email: string) => {
  const result = await db.query<{ code: string }>(
    'select code from otp_codes where email = $1 order by created_at desc limit 1',
    [email],
  )
  return result.rows[0].code
}

// Chrome's fake capture device hangs on macOS without a system microphone
// grant, so the page gets a live stream of a spoken recording instead. The
// app still records it with MediaRecorder and sends real audio to ElevenLabs.
const voice = readFileSync('tests/e2e/fixtures/feedback.wav')

const customerWithVoice = async (context: BrowserContext) => {
  await context.route('**/__e2e/voice.wav', (route) =>
    route.fulfill({ body: voice, contentType: 'audio/wav' }),
  )
  await context.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = async () => {
      const audio = new AudioContext()
      const buffer = await audio.decodeAudioData(
        await (await fetch('/__e2e/voice.wav')).arrayBuffer(),
      )
      const source = audio.createBufferSource()
      source.buffer = buffer
      const destination = audio.createMediaStreamDestination()
      source.connect(destination)
      source.start()
      return destination.stream
    }
  })
  return context.newPage()
}

const signIn = async (page: Page, email: string) => {
  // Every run signs in from this machine, so reset its per-connection login
  // limit; the limit itself is covered in tests/api.test.ts.
  await db.query("delete from rate_limits where key like 'otp:ip:%'")
  await page.goto('/login')
  await page.getByLabel('Email').fill(email)
  await page.getByRole('button', { name: 'SEND LOGIN CODE' }).click()
  // The code goes out through Resend before the form moves on.
  await expect(page.getByText('Check your email for a code')).toBeVisible({
    timeout: 20_000,
  })
  const code = await latestCode(email)
  await page.locator('input[data-input-otp]').fill(code)
  await page.getByRole('button', { name: 'VERIFY CODE' }).click()
}

test('a business signs up, a customer leaves voice feedback, the owner hears it', async ({
  page,
  browser,
}, testInfo) => {
  const run = `${testInfo.project.name}-${Date.now().toString(36)}`
  const email = `delivered+${run}@resend.dev`
  const code = `e2e-${run}`

  await test.step('owner signs in with an emailed code and sets up', async () => {
    await signIn(page, email)
    await page.waitForURL('**/onboarding')
    await page.locator('#businessName').fill(`E2E Cafe ${run}`)
    await page.getByRole('button', { name: 'Continue' }).click()
    await page
      .getByRole('button', { name: /restaurant/i })
      .first()
      .click()
    await page.getByRole('button', { name: 'Continue' }).click()
    await page.locator('#uniqueCode').fill(code)
    await page.getByRole('button', { name: 'Complete Setup' }).click()
    await page.waitForURL('**/dashboard')
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

  await test.step('a customer records, listens back and sends', async () => {
    const customer = await browser.newContext()
    const feedbackPage = await customerWithVoice(customer)
    await feedbackPage.goto(`/f/${code}`)
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
