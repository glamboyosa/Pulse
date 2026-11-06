import { sql } from 'drizzle-orm'
import { beforeEach, expect, it } from 'vitest'

import { resetDatabase } from './support/db'
import { db } from '@/db/index'
import { RateLimitError, enforceRateLimit } from '@/server/rate-limit'

beforeEach(resetDatabase)

it('allows hits up to the limit, then refuses with a retry time', async () => {
  for (let i = 0; i < 3; i++) await enforceRateLimit('k', 3, 60_000)
  const error = await enforceRateLimit('k', 3, 60_000).catch((e: unknown) => e)
  expect(error).toBeInstanceOf(RateLimitError)
  expect((error as RateLimitError).retryAfterSeconds).toBeGreaterThan(0)
})

it('lets exactly the limit through when hits arrive at once', async () => {
  const results = await Promise.allSettled(
    Array.from({ length: 20 }, () => enforceRateLimit('burst', 5, 60_000)),
  )
  expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(5)
})

it('starts a fresh window once the old one has passed', async () => {
  for (let i = 0; i < 2; i++) await enforceRateLimit('window', 2, 60_000)
  await db.execute(
    sql`update rate_limits set reset_at = now() - interval '1 second' where key = 'window'`,
  )
  await expect(enforceRateLimit('window', 2, 60_000)).resolves.toBeUndefined()
})

it('counts each key separately', async () => {
  await enforceRateLimit('a', 1, 60_000)
  await expect(enforceRateLimit('b', 1, 60_000)).resolves.toBeUndefined()
})
