import { timingSafeEqual } from 'node:crypto'

import { env } from '@/env'
import { sendWeeklyDigests } from '@/server/digest'

// Writes several AI digests in one run. Kept out of the API catch-all so
// other routes keep the default limit.
export const maxDuration = 300

/** Vercel Cron calls this on Mondays (vercel.json) with the CRON_SECRET bearer. */
export const GET = async (request: Request) => {
  const expected = Buffer.from(`Bearer ${env.CRON_SECRET ?? ''}`)
  const given = Buffer.from(request.headers.get('authorization') ?? '')
  if (
    !env.CRON_SECRET ||
    given.length !== expected.length ||
    !timingSafeEqual(given, expected)
  ) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return Response.json(await sendWeeklyDigests())
}
