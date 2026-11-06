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
  days: number
  total: number
  sentiment: { positive: number; neutral: number; negative: number }
  previousTotal: number
  previousNegative: number
  themes: Array<ThemeInsight>
}

/**
 * What an owner's customers talked about over the last `days`, against the
 * period before it. Themes are ranked by how often they come up negative, then
 * by mentions, so the list reads as "what to fix first".
 */
export const getInsights = async (
  userId: string,
  days = 30,
): Promise<Insights> => {
  const window = sql`make_interval(days => ${days})`

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
        select sentiment, created_at > now() - ${window} as current
        from feedback
        where user_id = ${userId} and status = 'ready'
          and created_at > now() - 2 * ${window}
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
      select unnest(themes) as theme, sentiment,
        created_at > now() - ${window} as current
      from feedback
      where user_id = ${userId} and status = 'ready'
        and created_at > now() - 2 * ${window}
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
