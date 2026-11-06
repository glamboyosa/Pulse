import { expect, test } from '@playwright/test'

import { db, signUpBusiness } from './support'

const recordings = [
  [
    'negative',
    ['wait time'],
    'We waited forty minutes for our food. Too slow.',
  ],
  [
    'negative',
    ['wait time', 'service'],
    'Nobody came to take our order for half an hour.',
  ],
  ['negative', ['atmosphere'], 'The room was far too hot, please fix the AC.'],
  [
    'positive',
    ['food quality'],
    'The jollof rice was the best I have had in years.',
  ],
  [
    'positive',
    ['food quality', 'staff friendliness'],
    'Lovely staff and great suya.',
  ],
  ['neutral', ['price'], 'Food was fine, a bit pricey for the portion.'],
] as const

test('the owner sees what customers feel and gets a digest of what to fix', async ({
  page,
}, testInfo) => {
  const run = `${testInfo.project.name}-${Date.now().toString(36)}`
  const email = `delivered+insights-${run}@resend.dev`
  await signUpBusiness(page, email, `e2e-insights-${run}`)

  // Analysed recordings, as the background job would have saved them.
  await db.query(
    `insert into feedback (user_id, status, sentiment, themes, transcript, summary, created_at)
     select u.id, 'ready', r.sentiment, r.themes, r.transcript, r.transcript, now() - interval '1 day'
     from users u, json_to_recordset($2::json) as r(sentiment text, themes text[], transcript text)
     where u.email = $1`,
    [
      email,
      JSON.stringify(
        recordings.map(([sentiment, themes, transcript]) => ({
          sentiment,
          themes,
          transcript,
        })),
      ),
    ],
  )

  await page.getByRole('link', { name: 'INSIGHTS' }).click()
  await page.waitForURL('**/dashboard?tab=insights')
  await expect(page.getByRole('img', { name: /Negative 50%/ })).toBeVisible()
  const themes = page.locator('li', { hasText: 'wait time' })
  await expect(themes.getByText('2 unhappy')).toBeVisible()

  await page.getByRole('button', { name: 'WRITE IT NOW' }).click()
  await expect(page.getByRole('button', { name: 'UPDATE NOW' })).toBeVisible({
    timeout: 60_000,
  })
  // The real model wrote numbered fixes, each counting the customers who raised it.
  await expect(page.getByText(/^\d+ customers?: /).first()).toBeVisible()
  await page.screenshot({
    path: testInfo.outputPath('insights.png'),
    fullPage: true,
  })
})
