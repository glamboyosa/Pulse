import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createBusiness, resetDatabase } from './support/db'
import { db } from '@/db/index'
import { feedback } from '@/db/schema'
import { getInsights, themeTracks } from '@/server/insights'

vi.mock('@/lib/storage/r2', () => ({
  getAudioUrl: (key: string) => Promise.resolve(`https://audio.test/${key}`),
}))

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
      days: 30,
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

  it('falls back to all time when the last 30 days were quiet', async () => {
    const owner = await createBusiness()
    await db.insert(feedback).values([
      {
        userId: owner.id,
        sentiment: 'negative',
        themes: ['wait time'],
        status: 'ready',
        createdAt: daysAgo(45),
      },
      {
        userId: owner.id,
        sentiment: 'positive',
        themes: ['staff'],
        status: 'ready',
        createdAt: daysAgo(200),
      },
    ])

    expect(await getInsights(owner.id)).toEqual({
      days: null,
      total: 2,
      sentiment: { positive: 1, neutral: 0, negative: 1 },
      previousTotal: 0,
      previousNegative: 0,
      themes: [
        { theme: 'wait time', mentions: 1, negative: 1, previousMentions: 0 },
        { theme: 'staff', mentions: 1, negative: 0, previousMentions: 0 },
      ],
    })
  })

  it('leaves out notes that were never analysed, so the shares add up', async () => {
    const owner = await createBusiness()
    await db.insert(feedback).values([
      { userId: owner.id, sentiment: 'negative', status: 'ready' },
      // An old recording that never got a transcript or a sentiment.
      { userId: owner.id, sentiment: null, status: 'ready' },
    ])
    expect(await getInsights(owner.id)).toMatchObject({
      days: 30,
      total: 1,
      sentiment: { positive: 0, neutral: 0, negative: 1 },
    })
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

describe('themeTracks', () => {
  it("queues a theme's recordings, unhappy first then newest, from the same period", async () => {
    const owner = await createBusiness()
    const other = await createBusiness()
    const note = (
      audioKey: string | null,
      sentiment: string | null,
      themes: Array<string>,
      createdAt: Date,
      extra: Partial<typeof feedback.$inferInsert> = {},
    ) => ({
      userId: owner.id,
      status: 'ready',
      audioKey,
      sentiment,
      themes,
      createdAt,
      summary: audioKey,
      ...extra,
    })
    await db.insert(feedback).values([
      note('happy-new', 'positive', ['wait time'], daysAgo(1)),
      note('unhappy-old', 'negative', ['wait time', 'price'], daysAgo(10)),
      note('unhappy-new', 'negative', ['wait time'], daysAgo(2)),
      // Typed, or audio since deleted: nothing to play.
      note(null, 'negative', ['wait time'], daysAgo(1)),
      // Older than the period, never analysed, or someone else's.
      note('too-old', 'negative', ['wait time'], daysAgo(40)),
      note('unanalysed', null, ['wait time'], daysAgo(1)),
      note('processing', 'negative', ['wait time'], daysAgo(1), {
        status: 'processing',
      }),
      note('others', 'negative', ['wait time'], daysAgo(1), {
        userId: other.id,
      }),
    ])

    const tracks = await themeTracks(
      owner.id,
      ['wait time', 'price', 'staff'],
      30,
    )
    expect(tracks['wait time'].map((track) => track.summary)).toEqual([
      'unhappy-new',
      'unhappy-old',
      'happy-new',
    ])
    // Only the first is signed with the page; the rest are fetched as they play.
    expect(tracks['wait time'].map((track) => track.audioUrl)).toEqual([
      'https://audio.test/unhappy-new',
      null,
      null,
    ])
    expect(tracks.price.map((track) => track.summary)).toEqual(['unhappy-old'])
    expect(tracks.staff).toEqual([])

    const allTime = await themeTracks(owner.id, ['wait time'], null)
    expect(allTime['wait time'].map((track) => track.summary)).toContain(
      'too-old',
    )
  })

  it('keeps each queue to 50 recordings', async () => {
    const owner = await createBusiness()
    await db.insert(feedback).values(
      Array.from({ length: 52 }, (_, i) => ({
        userId: owner.id,
        status: 'ready',
        sentiment: 'negative',
        themes: ['wait time'],
        audioKey: `test/${i}.wav`,
        createdAt: daysAgo(1),
      })),
    )
    const tracks = await themeTracks(owner.id, ['wait time'], 30)
    expect(tracks['wait time']).toHaveLength(50)
  })
})
