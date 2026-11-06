import { expect, test } from '@playwright/test'

import { db, signUpBusiness } from './support'
import type { Page } from '@playwright/test'

/** The page count a PDF declares in its page tree. */
const pageCount = (pdf: Buffer) =>
  Number(
    /\/Type\s*\/Pages[^>]*\/Count\s+(\d+)/.exec(pdf.toString('latin1'))?.[1],
  )

/** True when every card's content fits inside it, with nothing clipped. */
const cardsFit = (page: Page) =>
  page
    .locator('[data-print-card]')
    .evaluateAll((cards) =>
      cards.every(
        (card) =>
          card.scrollHeight <= card.clientHeight + 1 &&
          card.scrollWidth <= card.clientWidth + 1,
      ),
    )

test('the owner prints table tents and stickers as an A4 PDF', async ({
  page,
}, testInfo) => {
  const run = `${testInfo.project.name}-${Date.now().toString(36)}`
  const code = `e2e-print-${run}`
  const email = `delivered+print-${run}@resend.dev`
  await signUpBusiness(page, email, code)

  await test.step('typing the next spot while one saves keeps what was typed', async () => {
    let release = () => {}
    const held = new Promise<void>((resolve) => (release = resolve))
    await page.route('**/api/spots', async (route) => {
      if (route.request().method() === 'POST') await held
      await route.continue()
    })
    await page.getByLabel('New spot name').fill('Table 4')
    await page.getByRole('button', { name: 'ADD' }).click()
    await page.getByLabel('New spot name').fill('Bar')
    release()
    await expect(
      page.getByRole('link', { name: 'Print table tents for Table 4' }),
    ).toBeVisible()
    await expect(page.getByLabel('New spot name')).toHaveValue('Bar')
    await page.unroute('**/api/spots')
    await page.getByRole('button', { name: 'ADD' }).click()
    await expect(
      page.getByRole('link', { name: 'Print table tents for Bar' }),
    ).toBeVisible()
  })

  await test.step('a spot row prints that spot', async () => {
    await page.getByRole('link', { name: 'Print table tents for Bar' }).click()
    await page.waitForURL('**/print?spot=bar')
    await expect(page.locator('[data-print-url]').first()).toHaveText(
      new RegExp(`/f/${code}\\?spot=bar$`),
    )
  })

  await test.step('an unknown spot falls back to the main code', async () => {
    await page.goto('/print?spot=nope')
    await expect(page.locator('[data-print-url]').first()).toHaveText(
      new RegExp(`/f/${code}$`),
    )
  })

  await test.step('tents: both faces carry the code, one A4 page per spot', async () => {
    await page.goto('/dashboard')
    await page
      .getByRole('link', { name: 'PRINT TABLE TENTS', exact: true })
      .click()
    await page.waitForURL('**/print')
    await expect(
      page
        .getByRole('region', { name: 'Table tent main code' })
        .locator('[data-print-url]'),
    ).toHaveCount(2)
    await page.getByLabel('QR code').selectOption('Every spot')
    await expect(
      page.getByRole('region', { name: /^Table tent / }),
    ).toHaveCount(2)
    if (testInfo.project.name === 'desktop') {
      expect(pageCount(await page.pdf({ preferCSSPageSize: true }))).toBe(2)
    }
  })

  await test.step('stickers: six of one code on a sheet', async () => {
    await page.getByLabel('Layout').selectOption('stickers')
    await page.getByLabel('QR code').selectOption('Table 4')
    const sheet = page.getByRole('region', { name: 'Sticker sheet 1' })
    await expect(sheet.locator('[data-print-url]')).toHaveCount(6)
    await expect(sheet.locator('[data-print-url]').first()).toHaveText(
      new RegExp(`/f/${code}\\?spot=table-4$`),
    )
    if (testInfo.project.name === 'desktop') {
      expect(pageCount(await page.pdf({ preferCSSPageSize: true }))).toBe(1)
    }
  })

  await test.step('the longest question and a long name still fit every card', async () => {
    await db.query(
      `update users set feedback_question = $2, business_name = $3 where email = $1`,
      [
        email,
        // Exactly the 120-character limit, with one long unbroken word.
        'How was everything tonight at Supercalifragilisticexpialidocious, from the welcome to the food, drinks and the service?x',
        'The Extraordinarily Long Named Neighbourhood Kitchen and Cocktail Bar',
      ],
    )
    await page.reload()
    for (const layout of ['tent', 'stickers']) {
      // The toolbar is hidden in print, so choose the layout first.
      await page.emulateMedia({ media: 'screen' })
      await page.getByLabel('Layout').selectOption(layout)
      await page.emulateMedia({ media: 'print' })
      expect(await cardsFit(page), layout).toBe(true)
    }
  })
})
