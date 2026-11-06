import { beforeEach, describe, expect, it } from 'vitest'

import { createBusiness, resetDatabase } from './support/db'
import { db } from '@/db/index'
import { feedback } from '@/db/schema'
import { getInsights } from '@/server/insights'

const daysAgo = (days: number) => new Date(Date.now() - days * 86_400_000)

beforeEach(resetDatabase)

describe('getInsights', () => {
  it('ranks themes by negative mentions and compares with the period before', async () => {
    const owner = await createBusiness()
    const other = await createBusiness()
    const recording = (
      sentiment: string,
      themes: Array<string>,
      createdAt: Date,
      status = 'ready',
    ) => ({ userId: owner.id, sentiment, themes, createdAt, status })

    await db.insert(feedback).values([
      recording('negative', ['wait time', 'food quality'], daysAgo(1)),
      recording('negative', ['wait time'], daysAgo(3)),
      recording('positive', ['food quality'], daysAgo(5)),
      recording('positive', ['food quality', 'service'], daysAgo(10)),
      recording('neutral', ['price'], daysAgo(20)),
      // Still being analysed: not counted yet.
      recording('negative', ['wait time'], daysAgo(1), 'processing'),
      // The 30 days before.
      recording('negative', ['wait time'], daysAgo(40)),
      recording('positive', ['service'], daysAgo(45)),
      // Too old for either period.
      recording('negative', ['cleanliness'], daysAgo(90)),
      // Someone else's feedback.
      {
        userId: other.id,
        sentiment: 'negative',
        themes: ['price'],
        status: 'ready',
      },
    ])

    const insights = await getInsights(owner.id, 30)

    expect(insights).toMatchObject({
      total: 5,
      sentiment: { positive: 2, neutral: 1, negative: 2 },
      previousTotal: 2,
      previousNegative: 1,
    })
    expect(insights.themes).toEqual([
      { theme: 'wait time', mentions: 2, negative: 2, previousMentions: 1 },
      { theme: 'food quality', mentions: 3, negative: 1, previousMentions: 0 },
      { theme: 'price', mentions: 1, negative: 0, previousMentions: 0 },
      { theme: 'service', mentions: 1, negative: 0, previousMentions: 1 },
    ])
  })

  it('returns zeros for a business with no feedback', async () => {
    const owner = await createBusiness()
    expect(await getInsights(owner.id)).toEqual({
      days: 30,
      total: 0,
      sentiment: { positive: 0, neutral: 0, negative: 0 },
      previousTotal: 0,
      previousNegative: 0,
      themes: [],
    })
  })
})
