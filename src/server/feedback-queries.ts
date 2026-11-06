import { desc, eq } from 'drizzle-orm'

import type { Feedback } from '@/components/feedback-list'
import { db } from '@/db/index'
import { feedback } from '@/db/schema'
import { getAudioUrl } from '@/lib/storage/r2'

/**
 * An owner's feedback, newest first, with a fresh one-hour audio link for each.
 * Signing a link is a local computation, so this makes no network calls.
 */
export const listFeedback = async (
  userId: string,
): Promise<Array<Feedback>> => {
  const rows = await db
    .select()
    .from(feedback)
    .where(eq(feedback.userId, userId))
    .orderBy(desc(feedback.createdAt))

  return Promise.all(
    rows.map(async (f) => ({
      id: f.id,
      customerName: f.customerName,
      duration: f.duration ?? 0,
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
