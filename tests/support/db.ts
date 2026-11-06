import { sql } from 'drizzle-orm'

import { db } from '@/db/index'
import { users } from '@/db/schema'

export const resetDatabase = () =>
  db.execute(
    sql`truncate feedback, pulse_purchases, otp_codes, rate_limits, users restart identity cascade`,
  )

export const createBusiness = async (
  overrides: Partial<typeof users.$inferInsert> = {},
) => {
  const suffix = crypto.randomUUID().slice(0, 8)
  const [user] = await db
    .insert(users)
    .values({
      email: `owner-${suffix}@example.test`,
      businessName: `Test Cafe ${suffix}`,
      uniqueCode: `test-cafe-${suffix}`,
      isVerified: true,
      pulsesRemaining: 5,
      ...overrides,
    })
    .returning()
  return user
}

export const pulsesOf = async (userId: string) => {
  const result = await db.execute<{ pulses_remaining: number }>(
    sql`select pulses_remaining from users where id = ${userId}`,
  )
  return result.rows[0].pulses_remaining
}
