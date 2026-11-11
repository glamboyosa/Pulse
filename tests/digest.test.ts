import { eq, sql } from 'drizzle-orm'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createBusiness, resetDatabase } from './support/db'
import { db } from '@/db/index'
import { feedback, weeklyDigests } from '@/db/schema'
import {
  latestDigest,
  refreshDigest,
  sendWeeklyDigests,
  weekStartOf,
} from '@/server/digest'

const ai = vi.hoisted(() => ({ generate: vi.fn() }))
vi.mock('@/lib/ai/text-analysis', () => ({ generateObject: ai.generate }))
const email = vi.hoisted(() => ({ send: vi.fn() }))
vi.mock('@/lib/email/weekly-digest', () => ({
  sendWeeklyDigestEmail: email.send,
}))

const digest = {
  headline: 'Customers love the food but waits are too long.',
  fixes: [
    {
      title: 'Cut the wait for food',
      customers: 2,
      why: 'They waited over 30 minutes',
      quote: 'we waited forty minutes',
    },
  ],
  wins: ['The jollof rice'],
}

// A Monday morning, when the cron runs. It emails the week of 2 November.
const monday = new Date('2026-11-09T08:00:00Z')
const hoursBefore = (hours: number) =>
  new Date(monday.getTime() - hours * 3_600_000)

const withFeedback = async (count: number) => {
  const owner = await createBusiness()
  await db.insert(feedback).values(
    Array.from({ length: count }, (_, i) => ({
      userId: owner.id,
      status: 'ready',
      sentiment: 'negative',
      transcript: `We waited forty minutes, visit ${i}.`,
      themes: ['wait time'],
      createdAt: hoursBefore(24 + i),
    })),
  )
  return owner
}

beforeEach(async () => {
  await resetDatabase()
  vi.clearAllMocks()
  ai.generate.mockResolvedValue(digest)
  email.send.mockResolvedValue(undefined)
})

describe('weekStartOf', () => {
  it('returns the Monday of the week in UTC', () => {
    expect(weekStartOf(new Date('2026-11-09T08:00:00Z'))).toBe('2026-11-09')
    expect(weekStartOf(new Date('2026-11-15T23:59:00Z'))).toBe('2026-11-09')
    expect(weekStartOf(new Date('2026-11-08T12:00:00Z'))).toBe('2026-11-02')
  })
})

describe('sendWeeklyDigests', () => {
  it('emails owners with enough feedback once, however often it runs', async () => {
    const owner = await withFeedback(3)
    await withFeedback(1)

    expect(await sendWeeklyDigests(monday)).toEqual({
      sent: 1,
      skipped: 0,
      failed: 0,
    })
    expect(await sendWeeklyDigests(monday)).toEqual({
      sent: 0,
      skipped: 1,
      failed: 0,
    })

    expect(email.send).toHaveBeenCalledTimes(1)
    expect(email.send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: owner.email,
        content: digest,
        idempotencyKey: `weekly-digest/${owner.id}/2026-11-02`,
      }),
    )
    const [row] = await db
      .select()
      .from(weeklyDigests)
      .where(eq(weeklyDigests.userId, owner.id))
    expect(row).toMatchObject({ weekStart: '2026-11-02', content: digest })
    expect(row.emailedAt).not.toBeNull()
  })

  it('never sends twice when two runs overlap', async () => {
    await withFeedback(3)
    const runs = await Promise.all([
      sendWeeklyDigests(monday),
      sendWeeklyDigests(monday),
    ])
    expect(runs.reduce((sum, run) => sum + run.sent, 0)).toBe(1)
    expect(email.send).toHaveBeenCalledTimes(1)
  })

  it('retries a failed send with the digest it already wrote', async () => {
    await withFeedback(3)
    email.send.mockRejectedValueOnce(new Error('Resend timed out'))
    await sendWeeklyDigests(monday)
    ai.generate.mockResolvedValueOnce({ ...digest, headline: 'Different.' })
    await sendWeeklyDigests(monday)

    expect(ai.generate).toHaveBeenCalledTimes(1)
    expect(email.send.mock.calls[1][0]).toMatchObject({ content: digest })
  })

  it('lets the next run retry an owner whose email failed', async () => {
    await withFeedback(3)
    email.send.mockRejectedValueOnce(new Error('Resend down'))
    expect(await sendWeeklyDigests(monday)).toEqual({
      sent: 0,
      skipped: 0,
      failed: 1,
    })
    expect(await sendWeeklyDigests(monday)).toEqual({
      sent: 1,
      skipped: 0,
      failed: 0,
    })
  })

  it('still emails a week the owner already refreshed on the Insights tab', async () => {
    const owner = await withFeedback(3)
    // Sunday night, with the week's feedback in.
    expect(await refreshDigest(owner.id, hoursBefore(10))).toEqual(digest)
    expect(email.send).not.toHaveBeenCalled()

    expect(await sendWeeklyDigests(monday)).toEqual({
      sent: 1,
      skipped: 0,
      failed: 0,
    })
  })

  it('covers Monday to Monday, whenever it runs', async () => {
    const owner = await createBusiness()
    const at = (iso: string, transcript: string) => ({
      userId: owner.id,
      status: 'ready',
      sentiment: 'negative',
      transcript,
      createdAt: new Date(iso),
    })
    await db
      .insert(feedback)
      .values([
        at('2026-11-01T23:59:00Z', 'the week before'),
        at('2026-11-02T00:30:00Z', 'first hour of the week'),
        at('2026-11-08T23:30:00Z', 'last hour of the week'),
        at('2026-11-09T07:00:00Z', 'this week already'),
      ])

    // A late re-run on Thursday still digests the week of 2 November only.
    await sendWeeklyDigests(new Date('2026-11-12T10:00:00Z'))
    const prompt = ai.generate.mock.calls[0][1] as string
    expect(prompt).toContain('first hour of the week')
    expect(prompt).toContain('last hour of the week')
    expect(prompt).not.toContain('the week before')
    expect(prompt).not.toContain('this week already')
  })

  it('takes over a claim left by a run that died, after 15 minutes', async () => {
    const owner = await withFeedback(3)
    await db.insert(weeklyDigests).values({
      userId: owner.id,
      weekStart: '2026-11-02',
      sendingAt: new Date(monday.getTime() - 5 * 60_000),
    })
    expect((await sendWeeklyDigests(monday)).skipped).toBe(1)

    await db
      .update(weeklyDigests)
      .set({ sendingAt: new Date(monday.getTime() - 20 * 60_000) })
      .where(eq(weeklyDigests.userId, owner.id))
    expect((await sendWeeklyDigests(monday)).sent).toBe(1)
  })

  it('rewrites a refreshed week in full before emailing it', async () => {
    const owner = await withFeedback(3)
    ai.generate.mockResolvedValueOnce({ ...digest, headline: 'Partial week.' })
    await refreshDigest(owner.id, hoursBefore(10))

    await sendWeeklyDigests(monday)
    expect(email.send).toHaveBeenCalledWith(
      expect.objectContaining({ content: digest }),
    )
  })

  it('resends the same digest when taking over a run that died mid-send', async () => {
    const owner = await withFeedback(3)
    const written = { ...digest, headline: 'Written by the run that died.' }
    await db.insert(weeklyDigests).values({
      userId: owner.id,
      weekStart: '2026-11-02',
      content: written,
      sendingAt: new Date(monday.getTime() - 20 * 60_000),
    })

    await sendWeeklyDigests(monday)
    expect(ai.generate).not.toHaveBeenCalled()
    expect(email.send).toHaveBeenCalledWith(
      expect.objectContaining({ content: written }),
    )
  })

  it('does not email again when recording the send fails', async () => {
    const owner = await withFeedback(3)
    email.send.mockImplementationOnce(async () => {
      // The email goes out, then the database goes away.
      await db.execute(
        sql`alter table weekly_digests rename column emailed_at to emailed_at_gone`,
      )
    })
    try {
      expect(await sendWeeklyDigests(monday)).toEqual({
        sent: 1,
        skipped: 0,
        failed: 0,
      })
    } finally {
      await db.execute(
        sql`alter table weekly_digests rename column emailed_at_gone to emailed_at`,
      )
    }
    const [row] = await db
      .select()
      .from(weeklyDigests)
      .where(eq(weeklyDigests.userId, owner.id))
    expect(row.sendingAt).not.toBeNull()
    expect(await sendWeeklyDigests(monday)).toEqual({
      sent: 0,
      skipped: 1,
      failed: 0,
    })
    expect(email.send).toHaveBeenCalledTimes(1)
  })
})

describe('refreshDigest', () => {
  it("rewrites this week's digest and shows it as the latest", async () => {
    const owner = await withFeedback(2)
    await refreshDigest(owner.id, hoursBefore(10))
    ai.generate.mockResolvedValueOnce({ ...digest, headline: 'A newer take.' })
    await refreshDigest(owner.id, hoursBefore(9))

    expect(await latestDigest(owner.id)).toEqual({
      weekStart: '2026-11-02',
      content: { ...digest, headline: 'A newer take.' },
    })
  })

  it('writes nothing with fewer than two recordings', async () => {
    const owner = await withFeedback(1)
    expect(await refreshDigest(owner.id, monday)).toBeNull()
    expect(ai.generate).not.toHaveBeenCalled()
    expect(await latestDigest(owner.id)).toBeNull()
  })
})
