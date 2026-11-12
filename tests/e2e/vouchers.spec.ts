import { expect, test } from '@playwright/test'
import { db, signUpBusiness } from './support'
import type { Browser, Page } from '@playwright/test'

const OFFER = '10% off your next visit'
const NOTE = 'The jollof was lovely but we waited a long time for drinks.'

/** A customer whose microphone is blocked, so they type their feedback. */
const typingCustomer = async (browser: Browser) => {
  const context = await browser.newContext()
  await context.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = () =>
      Promise.reject(new DOMException('Blocked', 'NotAllowedError'))
  })
  return context.newPage()
}

const sendTypedFeedback = async (customer: Page, code: string) => {
  await customer.goto(`/f/${code}`)
  await customer.getByRole('button', { name: 'Start recording' }).click()
  await customer.getByRole('button', { name: 'Prefer to type?' }).click()
  await customer.getByLabel('Your feedback').fill(NOTE)
  await customer.getByRole('button', { name: 'SEND FEEDBACK' }).click()
  await expect(customer.getByText('THANK YOU!')).toBeVisible({
    timeout: 20_000,
  })
}

const voucherCode = async (customer: Page) => {
  const voucher = customer.getByRole('region', { name: 'Your voucher' })
  // Issued once the note is analysed, which takes a few seconds.
  await expect(voucher).toBeVisible({ timeout: 60_000 })
  await expect(voucher.getByText(OFFER)).toBeVisible()
  const match = (await voucher.innerText()).match(/\b[A-HJKMNP-Z2-9]{6}\b/)
  expect(match).not.toBeNull()
  return match![0]
}

const checkCode = async (page: Page, code: string) => {
  await page.goto('/dashboard/vouchers')
  await page.getByLabel('Voucher code').fill(code.toLowerCase())
  await page.getByRole('button', { name: 'Check' }).click()
}

test('a customer earns a voucher and staff redeem it once', async ({
  page,
  browser,
}, testInfo) => {
  const run = `${testInfo.project.name}-${Date.now().toString(36)}`
  const email = `delivered+${run}@resend.dev`
  const code = `e2e-v-${run}`

  await test.step('owner turns vouchers on, capped at two a month', async () => {
    await signUpBusiness(page, email, code)
    await page.goto('/settings')
    await page.getByLabel('Give a voucher for feedback').check()
    await page.getByLabel('Offer').fill(OFFER)
    await page.getByLabel('Days until it expires').fill('30')
    await page.getByLabel('Most per month').fill('2')
    await page.getByRole('button', { name: 'Save vouchers' }).click()
    await expect(page.getByRole('button', { name: 'Saved' })).toBeVisible()
  })

  const first = await typingCustomer(browser)
  let firstCode = ''
  await test.step('a customer sees the offer, sends feedback and gets a voucher', async () => {
    await first.goto(`/f/${code}`)
    await expect(first.getByText(OFFER)).toBeVisible()
    await sendTypedFeedback(first, code)
    firstCode = await voucherCode(first)
    await expect(
      first.getByRole('img', { name: `Voucher QR code ${firstCode}` }),
    ).toBeVisible()
  })

  await test.step('staff open the QR link and redeem it', async () => {
    // A staff phone that is signed out comes back to the voucher after login.
    const staff = await browser.newContext()
    const phone = await staff.newPage()
    await phone.goto(`/dashboard/vouchers?code=${firstCode}`)
    await phone.waitForURL(/\/login\?next=/)
    await db.query("delete from rate_limits where key like 'otp:ip:%'")
    await phone.getByLabel('Email').fill(email)
    await phone.getByRole('button', { name: 'SEND LOGIN CODE' }).click()
    await expect(phone.getByText('Check your email for a code')).toBeVisible({
      timeout: 20_000,
    })
    const { rows } = await db.query<{ code: string }>(
      'select code from otp_codes where email = $1 order by created_at desc limit 1',
      [email],
    )
    await phone.locator('input[data-input-otp]').fill(rows[0].code)
    await phone.getByRole('button', { name: 'VERIFY CODE' }).click()
    await phone.waitForURL(`**/dashboard/vouchers?code=${firstCode}`)
    await expect(phone.getByRole('status')).toHaveText('Valid')
    await staff.close()

    await page.goto(`/dashboard/vouchers?code=${firstCode}`)
    await expect(page.getByRole('status')).toHaveText('Valid')
    await expect(page.getByText(OFFER)).toBeVisible()
    await page.getByRole('button', { name: 'Redeem' }).click()
    await expect(page.getByRole('status')).toHaveText('Redeemed')
    await expect(page.getByRole('button', { name: 'Redeem' })).toHaveCount(0)
  })

  await test.step('the same voucher is refused a second time', async () => {
    await checkCode(page, firstCode)
    await expect(page.getByRole('status')).toHaveText('Already redeemed')
    await expect(page.getByRole('button', { name: 'Redeem' })).toHaveCount(0)
  })

  await test.step('the same browser gets no second voucher', async () => {
    await sendTypedFeedback(first, code)
    await expect(
      first.getByText('You already have a voucher from us'),
    ).toBeVisible({ timeout: 60_000 })
    await first.context().close()
  })

  await test.step('an expired voucher is refused', async () => {
    const second = await typingCustomer(browser)
    await sendTypedFeedback(second, code)
    const secondCode = await voucherCode(second)
    await second.context().close()
    await db.query(
      `update vouchers set expires_at = now() - interval '1 minute'
       where code = $1 and user_id = (select id from users where email = $2)`,
      [secondCode, email],
    )
    await checkCode(page, secondCode)
    await expect(page.getByRole('status')).toHaveText('Expired')
    await expect(page.getByRole('button', { name: 'Redeem' })).toHaveCount(0)
  })

  await test.step('over the monthly cap, the offer disappears and no voucher is issued', async () => {
    const third = await typingCustomer(browser)
    await third.goto(`/f/${code}`)
    await expect(
      third.getByRole('button', { name: 'Start recording' }),
    ).toBeVisible()
    await expect(third.getByText(OFFER)).toHaveCount(0)
    await sendTypedFeedback(third, code)
    await expect(
      third.getByRole('region', { name: 'Your voucher' }),
    ).toHaveCount(0)
    await third.context().close()
    const { rows } = await db.query(
      `select count(*)::int as count from vouchers
       where user_id = (select id from users where email = $1)`,
      [email],
    )
    expect(rows[0].count).toBe(2)
  })

  await test.step('the dashboard shows this month’s vouchers', async () => {
    await page.goto('/dashboard')
    const card = page
      .getByRole('heading', { name: 'Vouchers this month' })
      .locator('..')
    await expect(card.getByText('Issued')).toBeVisible()
    await expect(card.locator('dd').first()).toHaveText('2')
    await expect(card.locator('dd').nth(1)).toHaveText('1')
  })
})
