import { readFileSync } from 'node:fs'
import { expect, test } from '@playwright/test'

import { db, signUpBusiness } from './support'
import type { Page } from '@playwright/test'

const voice = readFileSync('tests/e2e/fixtures/feedback.wav')

/** Recordings live in R2; any signed audio link plays the test recording. */
const serveRecordings = (
  page: Page,
  { refuse = () => false }: { refuse?: (path: string) => boolean } = {},
) =>
  page.route(
    (url) => url.searchParams.has('X-Amz-Signature'),
    (route) =>
      refuse(new URL(route.request().url()).pathname)
        ? route.fulfill({ status: 403, body: 'expired' })
        : route.fulfill({ body: voice, contentType: 'audio/wav' }),
  )

const signedUp = async (page: Page, label: string) => {
  const run = `${label}-${Date.now().toString(36)}`
  const email = `delivered+${run}@resend.dev`
  await signUpBusiness(page, email, `e2e-${run}`)
  await db.query(
    `insert into feedback (user_id, status, sentiment, themes, transcript, summary, customer_name, audio_key, created_at)
     select u.id, 'ready', r.sentiment, r.themes, r.summary, r.summary, r.name, r.key, now() - r.age::interval
     from users u, json_to_recordset($2::json)
       as r(sentiment text, themes text[], summary text, name text, key text, age text)
     where u.email = $1`,
    [
      email,
      JSON.stringify([
        {
          sentiment: 'positive',
          themes: ['wait time'],
          summary: 'Quick today, thanks',
          name: 'Ama',
          key: 'test/ama.wav',
          age: '1 hour',
        },
        {
          sentiment: 'negative',
          themes: ['wait time'],
          summary: 'Waited 40 minutes for food',
          name: 'Tunde',
          key: 'test/tunde.wav',
          age: '2 hours',
        },
        {
          sentiment: 'negative',
          themes: ['price'],
          summary: 'Too pricey',
          name: 'Sam',
          key: 'test/sam.wav',
          age: '3 hours',
        },
      ]),
    ],
  )
}

test('the owner plays every note about a theme, one after another', async ({
  page,
}, testInfo) => {
  await signedUp(page, `playall-${testInfo.project.name}`)
  await serveRecordings(page)
  await page.goto('/dashboard?tab=insights')
  const status = page.getByRole('status').filter({ hasText: ' of ' })

  const nextLink = page.waitForRequest(/\/api\/feedback\/[^/]+\/audio-url$/)
  await page
    .getByRole('button', { name: 'Play all 2 wait time recordings' })
    .click()
  // Unhappy first.
  await expect(status).toContainText('1 of 2')
  await expect(status).toContainText('Tunde: Waited 40 minutes for food')
  // The next link is fetched while the first still plays, so there's no gap.
  await nextLink
  await expect(status).toContainText('1 of 2')

  await page.getByRole('button', { name: 'Pause recording' }).click()
  await expect(
    page.getByRole('button', { name: 'Resume recording' }),
  ).toBeVisible()
  // The playing theme's own button pauses and resumes too.
  await page.getByRole('button', { name: 'Resume wait time' }).click()
  // Pausing straight away doesn't skip the recording.
  await expect(status).toContainText('1 of 2')
  await expect(
    page.getByRole('button', { name: 'Pause recording' }),
  ).toBeVisible()

  // The next one is fetched as it comes.
  await page.getByRole('button', { name: 'Next recording' }).click()
  await expect(status).toContainText('2 of 2')
  await expect(status).toContainText('Ama: Quick today, thanks')
  await expect(
    page.getByRole('button', { name: 'Pause recording' }),
  ).toBeVisible()

  // The last one plays out, then the bar goes away.
  await expect(status).toHaveCount(0, { timeout: 15_000 })

  // Another theme takes over mid-recording.
  await page
    .getByRole('button', { name: 'Play all 2 wait time recordings' })
    .click()
  await expect(status).toContainText('Tunde')
  await page.getByRole('button', { name: 'Play the price recording' }).click()
  await expect(status).toContainText('price, 1 of 1: Sam: Too pricey')

  // Stopping from the keyboard keeps focus on the theme.
  await page.getByRole('button', { name: 'Stop' }).focus()
  await page.keyboard.press('Enter')
  await expect(status).toHaveCount(0)
  await expect(
    page.getByRole('button', { name: 'Play the price recording' }),
  ).toBeFocused()
})

test('an expired link is refreshed and a dead recording is skipped', async ({
  page,
}, testInfo) => {
  await signedUp(page, `playfix-${testInfo.project.name}`)
  // Tunde's first link has expired; Ama's recording is gone for good.
  let tundeRefused = false
  await serveRecordings(page, {
    refuse: (path) => {
      if (path.endsWith('/ama.wav')) return true
      if (path.endsWith('/tunde.wav') && !tundeRefused) {
        tundeRefused = true
        return true
      }
      return false
    },
  })
  await page.goto('/dashboard?tab=insights')
  const status = page.getByRole('status').filter({ hasText: ' of ' })

  await page
    .getByRole('button', { name: 'Play all 2 wait time recordings' })
    .click()
  // A fresh link plays Tunde after all.
  await expect(status).toContainText('1 of 2')
  await expect.poll(() => tundeRefused).toBe(true)
  await expect(
    page.getByRole('button', { name: 'Pause recording' }),
  ).toBeVisible()
  await expect(page.getByText("couldn't be played")).toHaveCount(0)

  // Ama can't be played even with a fresh link: skipped, and said so.
  await page.getByRole('button', { name: 'Next recording' }).click()
  await expect(
    page.getByText("One recording couldn't be played.").first(),
  ).toBeVisible()
  await expect(status).toHaveCount(0)
})
