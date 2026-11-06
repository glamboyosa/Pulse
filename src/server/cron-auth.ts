import { timingSafeEqual } from 'node:crypto'

import { env } from '@/env'

/** True when the request carries Vercel Cron's `Bearer CRON_SECRET`. */
export const isCronRequest = (request: Request) => {
  if (!env.CRON_SECRET) return false
  const expected = Buffer.from(`Bearer ${env.CRON_SECRET}`)
  const given = Buffer.from(request.headers.get('authorization') ?? '')
  return given.length === expected.length && timingSafeEqual(given, expected)
}
