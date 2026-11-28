import { readFileSync } from 'node:fs'
import { expect, test } from '@playwright/test'

import { db, signUpBusiness } from './support'
import type { Page } from '@playwright/test'

const voice = readFileSync('tests/e2e/fixtures/feedback.wav')

/** Signs up a business with one voice note and opens it. */
const openNote = async (page: Page) => {
  // Recordings live in R2; any signed link plays the test recording.
  await page.route(
    (url) => url.searchParams.has('X-Amz-Signature'),
    (route) => route.fulfill({ body: voice, contentType: 'audio/wav' }),
  )
  const run = `player-${Date.now().toString(36)}`
  const email = `delivered+${run}@resend.dev`
  await signUpBusiness(page, email, `e2e-${run}`)
  const { rows } = await db.query<{ id: string }>(
    `insert into feedback (user_id, status, sentiment, transcript, summary, customer_name, audio_key)
     select id, 'ready', 'negative', 'The patio was too hot.', 'Patio too hot', 'Nene', 'test/nene.wav'
     from users where email = $1 returning id`,
    [email],
  )
  await page.goto(`/feedback/${rows[0].id}`)
}

const filledBars = (page: Page) =>
  page
    .locator('span.will-change-transform')
    .evaluateAll(
      (bars) =>
        bars.filter((bar) => getComputedStyle(bar).opacity === '1').length,
    )

test('an owner plays a note from its waveform and can turn the wobble off', async ({
  page,
}) => {
  await openNote(page)
  const play = page.getByRole('button', { name: 'Play the recording' })
  await expect(play).toBeVisible()
  expect(await page.locator('span.will-change-transform').count()).toBe(28)
  expect(await filledBars(page)).toBe(0)
  await play.click()
  await expect(
    page.getByRole('button', { name: 'Pause the recording' }),
  ).toBeVisible()
  await expect
    .poll(() =>
      page.locator('audio').evaluate((audio: HTMLAudioElement) => ({
        paused: audio.paused,
        moved: audio.currentTime > 0,
      })),
    )
    .toEqual({ paused: false, moved: true })
  // The waveform fills in as the recording plays.
  await expect.poll(() => filledBars(page)).toBeGreaterThan(0)

  const wobble = page.getByRole('button', { name: 'Wobble' })
  await expect(wobble).toHaveAttribute('aria-pressed', 'true')
  await wobble.click()
  await expect(wobble).toHaveAttribute('aria-pressed', 'false')
  // The choice sticks on this device.
  await page.reload()
  await expect(page.getByRole('button', { name: 'Wobble' })).toHaveAttribute(
    'aria-pressed',
    'false',
  )
})

test('the wobble starts off for owners who ask for less motion', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await openNote(page)
  await expect(page.getByRole('button', { name: 'Wobble' })).toHaveAttribute(
    'aria-pressed',
    'false',
  )
})
