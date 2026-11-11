import { and, count, desc, eq, gte, lt, sql } from 'drizzle-orm'
import { z } from 'zod'

import { db } from '@/db/index'
import { feedback, weeklyDigests } from '@/db/schema'
import { generateObject } from '@/lib/ai/text-analysis'
import { sendWeeklyDigestEmail } from '@/lib/email/weekly-digest'

const digestSchema = z.object({
  headline: z
    .string()
    .describe(
      'How the week went in at most 15 words, plain and specific, e.g. "Food is loved, but slow service cost you this week"',
    ),
  fixes: z
    .array(
      z.object({
        title: z.string().describe('What to fix, as a short instruction'),
        customers: z
          .number()
          .int()
          .describe('How many of these customers raised it'),
        why: z.string().describe('What they said went wrong, in one sentence'),
        quote: z
          .string()
          .describe('A short, exact quote from one customer, in English'),
      }),
    )
    .max(3)
    .describe('Up to three things to fix, most urgent first'),
  wins: z
    .array(z.string())
    .max(3)
    .describe('Up to three things customers loved, each one short sentence'),
})

export type DigestContent = z.infer<typeof digestSchema>

const WEEK_MS = 7 * 24 * 60 * 60 * 1000
/** Fewer recordings than this make a digest that is mostly guesswork. */
export const MIN_FEEDBACK_FOR_DIGEST = 2

/** Monday 00:00 UTC of the week `date` falls in, as YYYY-MM-DD. */
export const weekStartOf = (date: Date): string => {
  const day = (date.getUTCDay() + 6) % 7
  const monday = new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate() - day,
    ),
  )
  return monday.toISOString().slice(0, 10)
}

type Window = { from: Date; to: Date }

/** Monday 00:00 UTC to the next Monday, for the week starting `weekStart`. */
const weekWindow = (weekStart: string): Window => {
  const from = new Date(`${weekStart}T00:00:00Z`)
  return { from, to: new Date(from.getTime() + WEEK_MS) }
}

const readyFeedbackIn = (userId: string, { from, to }: Window) =>
  and(
    eq(feedback.userId, userId),
    eq(feedback.status, 'ready'),
    gte(feedback.createdAt, from),
    lt(feedback.createdAt, to),
  )

/** How many analysed recordings an owner has in a window. */
export const countReadyFeedback = async (userId: string, window: Window) =>
  (
    await db
      .select({ count: count() })
      .from(feedback)
      .where(readyFeedbackIn(userId, window))
  )[0].count

/** Writes the digest of an owner's feedback in a window, or null if there is too little. */
export const writeDigest = async (
  userId: string,
  window: Window,
): Promise<DigestContent | null> => {
  const recent = await db
    .select({
      sentiment: feedback.sentiment,
      transcript: feedback.transcript,
      translation: feedback.translation,
      themes: feedback.themes,
    })
    .from(feedback)
    .where(readyFeedbackIn(userId, window))
    .orderBy(desc(feedback.createdAt))
    .limit(80)

  if (recent.length < MIN_FEEDBACK_FOR_DIGEST) return null

  const lines = recent.map(
    (f, i) =>
      `${i + 1}. [${f.sentiment ?? 'unknown'}] [${f.themes.join(', ')}] ${f.translation ?? f.transcript}`,
  )
  return generateObject(
    digestSchema,
    `You write a weekly feedback digest for a small business owner. Below are ${recent.length} voice feedback transcripts from one week, newest first, with sentiment and themes.

Be specific and honest. Write plainly, with no em dashes. Only mention fixes customers actually raised; return fewer than three if fewer were raised. Quotes must be copied from the transcripts, not invented. Count how many customers raised each fix.

${lines.join('\n')}`,
    // Reading a week of feedback takes longer than one recording.
    60_000,
  )
}

/** A claim older than this belongs to a run that died, e.g. at its time limit. */
const STALE_CLAIM_MS = 15 * 60 * 1000
/** Owners written in parallel, so a run fits Vercel's time limit. */
const CONCURRENCY = 5

type Outcome = 'sent' | 'skipped' | 'failed'

const sendDigestTo = async (
  owner: { id: string; email: string; name: string },
  weekStart: string,
  now: Date,
): Promise<Outcome> => {
  const claimed = await db
    .insert(weeklyDigests)
    .values({ userId: owner.id, weekStart, sendingAt: now })
    .onConflictDoUpdate({
      target: [weeklyDigests.userId, weeklyDigests.weekStart],
      set: {
        sendingAt: now,
        // Keep content only from a run that died mid-send. A digest the owner
        // refreshed during the week covered part of it, so it is rewritten.
        content: sql`case when ${weeklyDigests.sendingAt} is null then null else ${weeklyDigests.content} end`,
      },
      setWhere: sql`${weeklyDigests.emailedAt} is null and (${weeklyDigests.sendingAt} is null or ${weeklyDigests.sendingAt} < ${new Date(now.getTime() - STALE_CLAIM_MS).toISOString()}::timestamp)`,
    })
    .returning({ id: weeklyDigests.id, content: weeklyDigests.content })
  const claim = claimed.at(0)
  if (!claim) return 'skipped'
  const digestId = claim.id

  let emailed = false
  try {
    // A retry sends what an earlier run already wrote, so the stored digest
    // always matches the email and Resend's idempotency key sees one payload.
    let content = claim.content
    if (!content) {
      content = await writeDigest(owner.id, weekWindow(weekStart))
      if (!content) return 'skipped'
      await db
        .update(weeklyDigests)
        .set({ content })
        .where(eq(weeklyDigests.id, digestId))
    }
    await sendWeeklyDigestEmail({
      to: owner.email,
      businessName: owner.name,
      content,
      // Resend drops a repeat within 24 hours, should a retry get this far.
      idempotencyKey: `weekly-digest/${owner.id}/${weekStart}`,
    })
    emailed = true
    await db
      .update(weeklyDigests)
      .set({ emailedAt: new Date() })
      .where(eq(weeklyDigests.id, digestId))
    return 'sent'
  } catch (error) {
    console.error('[digest] failed', { userId: owner.id, error })
    // Release the claim so a re-run can retry, unless the email went out.
    // Released to the epoch, not null: Resend may have accepted the email
    // before the error, so the retry must send this same content under the
    // same idempotency key. Null would mark it a mid-week refresh to rewrite.
    if (!emailed) {
      await db
        .update(weeklyDigests)
        .set({ sendingAt: new Date(0) })
        .where(eq(weeklyDigests.id, digestId))
    }
    return emailed ? 'sent' : 'failed'
  }
}

/**
 * Emails the digest of last week (Monday to Monday, UTC) to every owner with
 * enough feedback in it. Each owner's week is claimed (sendingAt set) before
 * any work, so a retried or overlapping run never emails anyone twice. A
 * claim from a run that died is taken over after 15 minutes.
 */
export const sendWeeklyDigests = async (
  now = new Date(),
): Promise<{ sent: number; skipped: number; failed: number }> => {
  const weekStart = weekStartOf(new Date(now.getTime() - WEEK_MS))
  const { from, to } = weekWindow(weekStart)
  const owners = await db.execute<{
    id: string
    email: string
    name: string
  }>(sql`
    select u.id, u.email, coalesce(u.business_name, split_part(u.email, '@', 1)) as name
    from users u
    where (
      select count(*) from feedback f
      where f.user_id = u.id and f.status = 'ready'
        and f.created_at >= ${from.toISOString()} and f.created_at < ${to.toISOString()}
    ) >= ${MIN_FEEDBACK_FOR_DIGEST}
  `)

  const result = { sent: 0, skipped: 0, failed: 0 }
  for (let i = 0; i < owners.rows.length; i += CONCURRENCY) {
    const outcomes = await Promise.all(
      owners.rows
        .slice(i, i + CONCURRENCY)
        .map((owner) => sendDigestTo(owner, weekStart, now)),
    )
    for (const outcome of outcomes) result[outcome]++
  }
  return result
}

/** This week so far, Monday 00:00 UTC to `now`: what the Insights tab rewrites. */
export const currentWeek = (now = new Date()): Window => ({
  from: weekWindow(weekStartOf(now)).from,
  to: now,
})

/**
 * Rewrites this week's digest so far, on request from the Insights tab,
 * without emailing it. Next Monday's run emails the finished week.
 */
export const refreshDigest = async (
  userId: string,
  now = new Date(),
): Promise<DigestContent | null> => {
  const content = await writeDigest(userId, currentWeek(now))
  if (!content) return null
  await db
    .insert(weeklyDigests)
    .values({ userId, weekStart: weekStartOf(now), content })
    .onConflictDoUpdate({
      target: [weeklyDigests.userId, weeklyDigests.weekStart],
      set: { content },
    })
  return content
}

/** The newest digest with content, for the Insights tab. */
export const latestDigest = async (
  userId: string,
): Promise<{ weekStart: string; content: DigestContent } | null> => {
  const row = (
    await db
      .select({
        weekStart: weeklyDigests.weekStart,
        content: weeklyDigests.content,
      })
      .from(weeklyDigests)
      .where(
        and(
          eq(weeklyDigests.userId, userId),
          sql`${weeklyDigests.content} is not null`,
        ),
      )
      .orderBy(desc(weeklyDigests.weekStart))
      .limit(1)
  ).at(0)
  return row?.content
    ? { weekStart: row.weekStart, content: row.content }
    : null
}
