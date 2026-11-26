import { and, avg, count, desc, eq, gte } from 'drizzle-orm'

import type { Feedback } from '@/components/feedback-list'
import { db } from '@/db/index'
import { feedback, spots } from '@/db/schema'
import { getAudioUrl } from '@/lib/storage/r2'

const WEEK_MS = 7 * 24 * 60 * 60 * 1000

export const getFeedbackStats = async (userId: string) => {
  const userFeedback = eq(feedback.userId, userId)
  const weekAgo = new Date(Date.now() - WEEK_MS)
  const [[totals], [thisWeek]] = await Promise.all([
    db
      .select({ count: count(), avgDuration: avg(feedback.duration) })
      .from(feedback)
      .where(userFeedback),
    db
      .select({ count: count() })
      .from(feedback)
      .where(and(userFeedback, gte(feedback.createdAt, weekAgo))),
  ])

  return {
    totalFeedback: totals.count,
    avgDuration: totals.avgDuration ? Number(totals.avgDuration) : 0,
    thisWeekCount: thisWeek.count,
  }
}

/**
 * An owner's feedback, newest first, with a fresh one-hour audio link for each.
 * Signing a link is a local computation, so this makes no network calls.
 */
export const listFeedback = async (
  userId: string,
): Promise<Array<Feedback>> => {
  const rows = await db
    .select({
      f: feedback,
      spotName: spots.name,
      spotArchived: spots.archivedAt,
    })
    .from(feedback)
    .leftJoin(spots, eq(spots.id, feedback.spotId))
    .where(eq(feedback.userId, userId))
    .orderBy(desc(feedback.createdAt))

  return Promise.all(
    rows.map(async ({ f, spotName, spotArchived }) => ({
      id: f.id,
      customerName: f.customerName,
      spot:
        f.spotId && spotName
          ? { id: f.spotId, name: spotName, removed: spotArchived !== null }
          : null,
      duration: f.duration ?? 0,
      typed: f.source === 'text',
      widgetPage: f.channel === 'widget' ? (f.context?.page ?? '') : null,
      // Whether a reply is possible or sent; the address itself stays private.
      reply: f.repliedAt ? 'sent' : f.contactEmail ? 'wanted' : null,
      transcript: f.transcript ?? '',
      sentiment: f.sentiment as Feedback['sentiment'],
      summary: f.summary,
      themes: f.themes,
      language: f.translation ? f.language : null,
      translation: f.translation,
      status: f.status,
      audioUrl: f.audioKey ? await getAudioUrl(f.audioKey) : null,
      createdAt: f.createdAt.toISOString(),
    })),
  )
}
