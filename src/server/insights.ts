import { sql } from 'drizzle-orm'

import { db } from '@/db/index'

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
