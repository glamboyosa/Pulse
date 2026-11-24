import { and, arrayOverlaps, desc, eq, gt, isNotNull, sql } from 'drizzle-orm'

import { db } from '@/db/index'
import { feedback } from '@/db/schema'
import { getAudioUrl } from '@/lib/storage/r2'

export type ThemeInsight = {
  theme: string
  mentions: number
  negative: number
  /** Mentions in the period before, for the trend arrow. */
  previousMentions: number
}

export type Insights = {
  /** null: all time, because the last few weeks were quiet. */
  days: number | null
  total: number
  sentiment: { positive: number; neutral: number; negative: number }
  previousTotal: number
  previousNegative: number
  themes: Array<ThemeInsight>
}

/**
 * What an owner's customers talked about over the last `days` (or all time
 * when `days` is null), against the period before it. Themes are ranked by how
 * often they come up negative, then by mentions, so the list reads as "what to
 * fix first".
 */
const insightsFor = async (
  userId: string,
  days: number | null,
): Promise<Insights> => {
  const window = sql`make_interval(days => ${days})`
  const current =
    days === null ? sql`true` : sql`created_at > now() - ${window}`
  const since =
    days === null ? sql`true` : sql`created_at > now() - 2 * ${window}`

  const [totals] = (
    await db.execute<{
      total: number
      positive: number
      neutral: number
      negative: number
      previous_total: number
      previous_negative: number
    }>(sql`
      select
        count(*) filter (where current)::int as total,
        count(*) filter (where current and sentiment = 'positive')::int as positive,
        count(*) filter (where current and sentiment = 'neutral')::int as neutral,
        count(*) filter (where current and sentiment = 'negative')::int as negative,
        count(*) filter (where not current)::int as previous_total,
        count(*) filter (where not current and sentiment = 'negative')::int as previous_negative
      from (
        select sentiment, ${current} as current
        from feedback
        -- Only analysed notes, so the shares add up to 100%.
        where user_id = ${userId} and status = 'ready'
          and sentiment is not null and ${since}
      ) recent
    `)
  ).rows

  const themes = await db.execute<{
    theme: string
    mentions: number
    negative: number
    previous_mentions: number
  }>(sql`
    select theme,
      count(*) filter (where current)::int as mentions,
      count(*) filter (where current and sentiment = 'negative')::int as negative,
      count(*) filter (where not current)::int as previous_mentions
    from (
      select unnest(themes) as theme, sentiment, ${current} as current
      from feedback
      where user_id = ${userId} and status = 'ready' and ${since}
    ) mentioned
    group by theme
    having count(*) filter (where current) > 0
    order by negative desc, mentions desc, theme
    limit 8
  `)

  return {
    days,
    total: totals.total,
    sentiment: {
      positive: totals.positive,
      neutral: totals.neutral,
      negative: totals.negative,
    },
    previousTotal: totals.previous_total,
    previousNegative: totals.previous_negative,
    themes: themes.rows.map((row) => ({
      theme: row.theme,
      mentions: row.mentions,
      negative: row.negative,
      previousMentions: row.previous_mentions,
    })),
  }
}

/**
 * The last `days`, or all time when those were quiet but older feedback
 * exists, so a business that went quiet still sees what customers said.
 */
export const getInsights = async (
  userId: string,
  days = 30,
): Promise<Insights> => {
  const recent = await insightsFor(userId, days)
  if (recent.total > 0) return recent
  const allTime = await insightsFor(userId, null)
  return allTime.total > 0 ? allTime : recent
}

/** One recording in a theme's "Play all" queue. */
export type ThemeTrack = {
  id: string
  customerName: string | null
  summary: string | null
  /** Signed for the first in each queue only; the rest are fetched as they play. */
  audioUrl: string | null
}

// Enough to hear the pattern, and keeps the page small for busy accounts.
const MAX_TRACKS_PER_THEME = 50

/**
 * Each theme's voice notes from the same period as the insights, unhappy
 * ones first, then newest. Typed notes and recordings whose audio has been
 * deleted have nothing to play. Only the first in each queue gets a link
 * now, so a click can start it at once.
 */
export const themeTracks = async (
  userId: string,
  themes: Array<string>,
  days: number | null,
): Promise<Record<string, Array<ThemeTrack>>> => {
  if (themes.length === 0) return {}
  const rows = await db
    .select({
      id: feedback.id,
      customerName: feedback.customerName,
      summary: feedback.summary,
      sentiment: feedback.sentiment,
      themes: feedback.themes,
      audioKey: feedback.audioKey,
    })
    .from(feedback)
    .where(
      and(
        eq(feedback.userId, userId),
        eq(feedback.status, 'ready'),
        isNotNull(feedback.sentiment),
        isNotNull(feedback.audioKey),
        arrayOverlaps(feedback.themes, themes),
        days === null
          ? undefined
          : gt(feedback.createdAt, new Date(Date.now() - days * 86_400_000)),
      ),
    )
    .orderBy(desc(feedback.createdAt))

  const unhappyFirst = [
    ...rows.filter((row) => row.sentiment === 'negative'),
    ...rows.filter((row) => row.sentiment !== 'negative'),
  ]
  return Object.fromEntries(
    await Promise.all(
      themes.map(async (theme) => {
        const queue = unhappyFirst
          .filter((row) => row.themes.includes(theme))
          .slice(0, MAX_TRACKS_PER_THEME)
        const tracks = await Promise.all(
          queue.flatMap(({ audioKey, ...row }, index) =>
            audioKey
              ? [
                  (index === 0
                    ? getAudioUrl(audioKey)
                    : Promise.resolve(null)
                  ).then((audioUrl) => ({
                    id: row.id,
                    customerName: row.customerName,
                    summary: row.summary,
                    audioUrl,
                  })),
                ]
              : [],
          ),
        )
        return [theme, tracks] as const
      }),
    ),
  )
}
