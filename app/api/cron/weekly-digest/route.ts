import { isCronRequest } from '@/server/cron-auth'
import { sendWeeklyDigests } from '@/server/digest'

// Writes several AI digests in one run. Kept out of the API catch-all so
// other routes keep the default limit.
export const maxDuration = 300

/** Vercel Cron calls this on Mondays (vercel.json) with the CRON_SECRET bearer. */
export const GET = async (request: Request) => {
  if (!isCronRequest(request)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return Response.json(await sendWeeklyDigests())
}
