import { eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { encrypt } from '../lib/session'
import SettingsPage from '../app/settings/page'
import { createBusiness, resetDatabase } from './support/db'
import { db } from '@/db/index'
import { users } from '@/db/schema'
import { brandingFor, logoPathFor } from '@/server/branding'
import { voucherSettings, voucherSettingsFromUser } from '@/server/vouchers'
import { widgetSettings, widgetSettingsFromUser } from '@/server/widget'

const cookieJar = vi.hoisted(() => ({
  get: vi.fn(),
}))

vi.mock('next/headers', () => ({
  cookies: () => Promise.resolve(cookieJar),
}))
vi.mock('next/navigation', () => ({
  redirect: (path: string) => {
    throw new Error(`redirect:${path}`)
  },
}))

beforeEach(async () => {
  await resetDatabase()
  cookieJar.get.mockReset()
})

describe('settings user consolidation', () => {
  it('derives the same branding logo, voucher settings and widget settings as the individual helpers', async () => {
    const owner = await createBusiness({
      logoKey: 'test/logos/owner/v123.png',
      voucherEnabled: true,
      voucherOffer: 'Free coffee',
      voucherExpiryDays: 14,
      voucherMonthlyCap: 25,
      widgetKey: 'pk_test123456789012345678',
      widgetOrigins: ['https://example.com'],
    })

    const [row] = await db.select().from(users).where(eq(users.id, owner.id))
    const branding = await brandingFor(owner.uniqueCode!)

    expect(logoPathFor(row.uniqueCode, row.logoKey)).toBe(branding?.logoUrl)
    expect(voucherSettingsFromUser(row)).toEqual(
      await voucherSettings(owner.id),
    )
    expect(widgetSettingsFromUser(row)).toEqual(await widgetSettings(owner.id))
  })

  it('loads the settings page with a single SELECT on users', async () => {
    const owner = await createBusiness({
      logoKey: 'test/logos/owner/v456.png',
      voucherEnabled: true,
      voucherOffer: '10% off',
      widgetKey: 'pk_test123456789012345678',
      widgetOrigins: ['https://example.com'],
    })
    const token = await encrypt({
      userId: owner.id,
      email: owner.email,
      expiresAt: new Date(Date.now() + 3600_000),
    })
    cookieJar.get.mockReturnValue({ value: token })

    const selectSpy = vi.spyOn(db, 'select')
    await SettingsPage()

    expect(selectSpy).toHaveBeenCalledTimes(1)
    selectSpy.mockRestore()
  })
})
