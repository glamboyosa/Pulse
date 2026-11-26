import { eq, sql } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { createBusiness, resetDatabase } from './support/db'
import { db } from '@/db/index'
import { otpCodes, vouchers } from '@/db/schema'
import { OTP_TTL_MS } from '@/lib/otp'
import { redeemVoucher } from '@/server/vouchers'

beforeEach(resetDatabase)
afterEach(() => {
  vi.unstubAllEnvs()
})

describe('database session timezone (UTC)', () => {
  it('overrides a non-UTC startup timezone to UTC on every application Postgres session', async () => {
    vi.stubEnv('PGOPTIONS', '-c timezone=Africa/Lagos')
    vi.resetModules()
    const fresh = await import('@/db/index')
    try {
      const result = await fresh.db.execute<{ TimeZone: string }>(
        sql`show time zone`,
      )
      expect(result.rows[0].TimeZone).toBe('UTC')
    } finally {
      await fresh.db.$client.end()
      vi.resetModules()
    }
  })

  it('aligns Drizzle UTC dates with SQL now() for voucher redemption and OTP expiry', async () => {
    const owner = await createBusiness()
    // 30 minutes ahead fails under a UTC+1 session because SQL now() is +60 minutes ahead of UTC.
    const soon = new Date(Date.now() + 30 * 60_000)
    await db.insert(vouchers).values({
      userId: owner.id,
      code: 'K7PQ4X',
      offer: '10% off',
      expiresAt: soon,
    })

    const result = await redeemVoucher(owner.id, 'K7PQ4X')
    expect(result).not.toBeNull()
    expect(result?.redeemed).toBe(true)
    expect(result?.voucher.state).toBe('redeemed')

    await db.insert(otpCodes).values({
      email: 'tz-check@example.test',
      code: '123456',
      expiresAt: new Date(Date.now() + OTP_TTL_MS),
    })
    const [otp] = await db
      .select()
      .from(otpCodes)
      .where(eq(otpCodes.email, 'tz-check@example.test'))
    const ttl = otp.expiresAt.getTime() - otp.createdAt.getTime()
    expect(ttl).toBeGreaterThan(OTP_TTL_MS - 10_000)
    expect(ttl).toBeLessThan(OTP_TTL_MS + 10_000)
  })
})
