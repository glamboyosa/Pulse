import { applyRetention } from '@/server/account-data'
import { isCronRequest } from '@/server/cron-auth'

export const maxDuration = 300

/** Vercel Cron calls this daily (vercel.json): see applyRetention. */
export const GET = async (request: Request) => {
  if (!isCronRequest(request)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return Response.json(await applyRetention())
}
