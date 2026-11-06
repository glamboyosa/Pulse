import { sql } from 'drizzle-orm'

import { db } from '@/db/index'

export class RateLimitError extends Error {
  constructor(public retryAfterSeconds: number) {
    super('Too many requests. Please wait and try again.')
  }
}

/**
 * Counts one hit against `key` in a fixed window and throws once the count
 * passes `limit`. One upsert statement, so concurrent requests can't both
 * read a stale count and slip through.
 */
export const enforceRateLimit = async (
  key: string,
  limit: number,
  windowMs: number,
): Promise<void> => {
  const result = await db.execute<{ count: number; retry_after: number }>(sql`
    insert into rate_limits (key, count, reset_at, created_at, updated_at)
    values (${key}, 1, now() + ${windowMs} * interval '1 millisecond', now(), now())
    on conflict (key) do update set
      count = case when rate_limits.reset_at <= now() then 1 else rate_limits.count + 1 end,
      reset_at = case when rate_limits.reset_at <= now() then excluded.reset_at else rate_limits.reset_at end,
      updated_at = now()
    returning count, ceil(extract(epoch from reset_at - now()))::int as retry_after
  `)
  const { count, retry_after } = result.rows[0]
  if (count > limit) throw new RateLimitError(Math.max(1, retry_after))
}

export const clientIp = (request: Request): string =>
  request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
  request.headers.get('x-real-ip') ||
  'unknown'
