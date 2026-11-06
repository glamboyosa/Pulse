import { readFileSync } from 'node:fs'
import { expect } from '@playwright/test'
import pg from 'pg'
import type { BrowserContext, Page } from '@playwright/test'

// Reads login codes and adjusts balances directly, as an operator would. Point
// E2E_DATABASE_URL at the database the app under test uses; never production.
export const db = new pg.Pool({
  connectionString:
    process.env.E2E_DATABASE_URL ??
    'postgres://postgres@localhost:5440/pulse_dev',
  // Shared by every spec in the worker, so nothing closes it by hand.
  allowExitOnIdle: true,
})

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

export const customerWithVoice = async (context: BrowserContext) => {
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

export const signIn = async (page: Page, email: string) => {
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

/** Signs a new owner up and finishes onboarding with the given feedback code. */
export const signUpBusiness = async (
  page: Page,
  email: string,
  code: string,
) => {
  await signIn(page, email)
  await page.waitForURL('**/onboarding')
  await page.locator('#businessName').fill(`E2E Cafe ${code}`)
  await page.getByRole('button', { name: 'Continue' }).click()
  await page
    .getByRole('button', { name: /restaurant/i })
    .first()
    .click()
  await page.getByRole('button', { name: 'Continue' }).click()
  await page.locator('#uniqueCode').fill(code)
  await page.getByRole('button', { name: 'Complete Setup' }).click()
  await page.waitForURL('**/dashboard')
}
