import { expect, test } from '@playwright/test'
import { db, signUpBusiness } from './support'
import type { Locator } from '@playwright/test'


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

test('long notes show two clean lines and expand in place', async ({
  page,
}, testInfo) => {
  const run = `${testInfo.project.name}-${Date.now().toString(36)}`
  const email = `delivered+long-${run}@resend.dev`
  await signUpBusiness(page, email, `e2e-long-${run}`)
  const long = `${'The food was lovely but the wait was long and nobody explained why. '.repeat(6)}The end.`
  const pidgin = `${'I don wait thirty minutes, food never come, abeg do something. '.repeat(5)}Na so.`
  const english = `${'I waited thirty minutes and the food never came, please do something. '.repeat(5)}That is all.`
  await db.query(
    `insert into feedback (user_id, status, sentiment, themes, transcript, translation, language, summary, created_at)
     select u.id, 'ready', r.sentiment, '{}', r.transcript, r.translation, r.language, r.summary, now() - interval '1 hour'
     from users u, json_to_recordset($2::json)
       as r(sentiment text, transcript text, translation text, language text, summary text)
     where u.email = $1`,
    [
      email,
      JSON.stringify([
        {
          sentiment: 'neutral',
          transcript: long,
          translation: null,
          language: null,
          summary: 'Long wait, no word why',
        },
        {
          sentiment: 'negative',
          transcript: pidgin,
          translation: english,
          language: 'Nigerian Pidgin',
          summary: 'Waited 30 minutes',
        },
        {
          sentiment: 'positive',
          transcript: 'Great coffee.',
          translation: null,
          language: null,
          summary: 'Loved the coffee',
        },
      ]),
    ],
  )
  await page.goto('/dashboard')
  const height = async (locator: Locator) =>
    (await locator.boundingBox())!.height

  const card = page.locator('[data-slot="card"]', {
    hasText: 'Long wait, no word why',
  })
  const text = card.getByText(/^The food was lovely/)
  // Nothing of a third line shows below the text, inside the box's padding.
  const box = (await text.locator('..').boundingBox())!
  const shown = (await text.boundingBox())!
  expect(shown.y + shown.height).toBeLessThanOrEqual(box.y + box.height - 12)
  const collapsed = await height(text)
  await card.getByRole('button', { name: 'Show more' }).click()
  await expect(card.getByRole('button', { name: 'Show less' })).toBeVisible()
  await expect(page).toHaveURL(/\/dashboard$/)
  await expect.poll(() => height(text)).toBeGreaterThan(collapsed * 2)
  await card.getByRole('button', { name: 'Show less' }).click()
  await expect.poll(() => height(text)).toBeCloseTo(collapsed, 0)

  // The customer's words and the English open together.
  const translated = page.locator('[data-slot="card"]', {
    hasText: 'Waited 30 minutes',
  })
  const original = translated.getByText(/^I don wait/)
  const inEnglish = translated.getByText(/^In English: I waited/)
  const before = [await height(original), await height(inEnglish)]
  await translated.getByRole('button', { name: 'Show more' }).click()
  await expect.poll(() => height(original)).toBeGreaterThan(before[0] * 1.5)
  await expect.poll(() => height(inEnglish)).toBeGreaterThan(before[1] * 1.5)

  const short = page.locator('[data-slot="card"]', {
    hasText: 'Loved the coffee',
  })
  await expect(short.getByText('Great coffee.')).toBeVisible()
  await expect(
    short.getByRole('button', { name: /Show (more|less)/ }),
  ).toHaveCount(0)
})
