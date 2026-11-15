import { expect, test } from '@playwright/test'

import { db, signUpBusiness } from './support'

test("a note in another language shows the customer's words with the English under them", async ({
  page,
}, testInfo) => {
  const run = `${testInfo.project.name}-${Date.now().toString(36)}`
  const email = `delivered+dashboard-${run}@resend.dev`
  await signUpBusiness(page, email, `e2e-dashboard-${run}`)

  // Analysed notes, as the background job would have saved them.
  await db.query(
    `insert into feedback (user_id, status, sentiment, themes, transcript, translation, language, summary, created_at)
     select u.id, 'ready', r.sentiment, r.themes, r.transcript, r.translation, r.language, r.summary, now() - interval '1 hour'
     from users u, json_to_recordset($2::json)
       as r(sentiment text, themes text[], transcript text, translation text, language text, summary text)
     where u.email = $1`,
    [
      email,
      JSON.stringify([
        {
          sentiment: 'negative',
          themes: ['wait time'],
          transcript: 'I don wait thirty minutes, food never come.',
          translation:
            "I've waited thirty minutes and the food still hasn't come.",
          language: 'Nigerian Pidgin',
          summary: 'Food took too long',
        },
        {
          sentiment: 'negative',
          themes: ['food quality'],
          transcript: 'Food cold o.',
          translation: 'The food was cold.',
          language: 'Nigerian Pidgin',
          summary: 'The food was cold',
        },
        {
          sentiment: 'positive',
          themes: ['staff'],
          transcript: 'The staff were lovely and the suya was great.',
          translation: null,
          language: null,
          summary: 'Lovely staff',
        },
      ]),
    ],
  )
  await page.goto('/dashboard')

  const pidgin = page.locator('[data-slot="card"]', {
    hasText: 'Food took too long',
  })
  await expect(
    pidgin.getByText('I don wait thirty minutes, food never come.'),
  ).toBeVisible()
  await expect(
    pidgin.getByText(
      "In English: I've waited thirty minutes and the food still hasn't come.",
    ),
  ).toBeVisible()
  await expect(pidgin.getByText('• Nigerian Pidgin')).toBeVisible()
  // The English sits under the customer's own words.
  const original = await pidgin
    .getByText('I don wait thirty minutes, food never come.')
    .boundingBox()
  const english = await pidgin.getByText(/^In English: /).boundingBox()
  expect(english!.y).toBeGreaterThan(original!.y)

  // When the summary already says it in English, it isn't repeated.
  const cold = page.locator('[data-slot="card"]', {
    hasText: 'The food was cold',
  })
  await expect(cold.getByText('Food cold o.')).toBeVisible()
  await expect(cold.getByText(/In English/)).toHaveCount(0)

  const spokenInEnglish = page.locator('[data-slot="card"]', {
    hasText: 'Lovely staff',
  })
  await expect(
    spokenInEnglish.getByText('The staff were lovely and the suya was great.'),
  ).toBeVisible()
  await expect(spokenInEnglish.getByText(/In English/)).toHaveCount(0)
})
