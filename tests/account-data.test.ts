import { eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createBusiness, resetDatabase } from './support/db'
import { db } from '@/db/index'
import {
  feedback,
  otpCodes,
  pulsePurchases,
  rateLimits,
  spots,
  users,
  weeklyDigests,
} from '@/db/schema'
import {
  applyRetention,
  deleteAccount,
  deleteFeedback,
  exportAccount,
} from '@/server/account-data'

const storage = vi.hoisted(() => ({ deleteAudio: vi.fn() }))
vi.mock('@/lib/storage/r2', () => storage)

const daysAgo = (days: number) => new Date(Date.now() - days * 86_400_000)

beforeEach(async () => {
  await resetDatabase()
  storage.deleteAudio.mockReset()
  storage.deleteAudio.mockResolvedValue(undefined)
})

describe('deleteFeedback', () => {
  it("deletes the owner's recording and its audio, and nobody else's", async () => {
    const owner = await createBusiness()
    const other = await createBusiness()
    const [row] = await db
      .insert(feedback)
      .values({ userId: owner.id, audioKey: 'test/a.webm' })
      .returning()

    expect(await deleteFeedback(other.id, row.id)).toBe(false)
    expect(storage.deleteAudio).not.toHaveBeenCalled()

    expect(await deleteFeedback(owner.id, row.id)).toBe(true)
    expect(storage.deleteAudio).toHaveBeenCalledWith('test/a.webm')
    expect(await db.select().from(feedback)).toHaveLength(0)
  })
})

describe('exportAccount', () => {
  it("includes the business's data but never a customer's reply address", async () => {
    const owner = await createBusiness()
    const [spot] = await db
      .insert(spots)
      .values({ userId: owner.id, name: 'Patio', slug: 'patio' })
      .returning()
    await db.insert(feedback).values({
      userId: owner.id,
      spotId: spot.id,
      transcript: 'Lovely.',
      contactEmail: 'ada@example.test',
    })

    const data = await exportAccount(owner.id)
    expect(data.account).toMatchObject({ email: owner.email })
    expect(data.feedback).toEqual([
      expect.objectContaining({ transcript: 'Lovely.', spot: 'Patio' }),
    ])
    expect(JSON.stringify(data)).not.toContain('ada@example.test')
  })
})

describe('deleteAccount', () => {
  it('removes every row and stored file of the account, and leaves others alone', async () => {
    const owner = await createBusiness()
    const other = await createBusiness()
    await db
      .update(users)
      .set({ logoKey: 'test/logo.png' })
      .where(eq(users.id, owner.id))
    const [spot] = await db
      .insert(spots)
      .values({ userId: owner.id, name: 'Patio', slug: 'patio' })
      .returning()
    await db.insert(feedback).values([
      { userId: owner.id, spotId: spot.id, audioKey: 'test/1.webm' },
      { userId: owner.id, transcript: 'Typed', source: 'text' },
      { userId: other.id, audioKey: 'test/other.webm' },
    ])
    await db
      .insert(pulsePurchases)
      .values({ userId: owner.id, amount: 10, price: 700 })
    await db
      .insert(weeklyDigests)
      .values({ userId: owner.id, weekStart: '2026-11-02' })
    await db.insert(otpCodes).values({
      email: owner.email,
      code: '123456',
      expiresAt: new Date(Date.now() + 60_000),
    })
    await db.insert(rateLimits).values({
      key: `otp:email:${owner.email}`,
      count: 1,
      resetAt: new Date(Date.now() + 60_000),
    })

    await deleteAccount(owner.id)

    expect(
      await db.select().from(users).where(eq(users.id, owner.id)),
    ).toHaveLength(0)
    expect(await db.select().from(feedback)).toEqual([
      expect.objectContaining({ userId: other.id }),
    ])
    expect(await db.select().from(spots)).toHaveLength(0)
    expect(await db.select().from(pulsePurchases)).toHaveLength(0)
    expect(await db.select().from(weeklyDigests)).toHaveLength(0)
    expect(await db.select().from(otpCodes)).toHaveLength(0)
    expect(await db.select().from(rateLimits)).toHaveLength(0)
    expect(storage.deleteAudio.mock.calls.map(([key]) => key).sort()).toEqual([
      'test/1.webm',
      'test/logo.png',
    ])
  })
})

describe('deleting twice, or with storage down', () => {
  it('ignores an account that is already gone', async () => {
    const owner = await createBusiness()
    await Promise.all([deleteAccount(owner.id), deleteAccount(owner.id)])
    expect(
      await db.select().from(users).where(eq(users.id, owner.id)),
    ).toHaveLength(0)
  })

  it('still deletes the feedback when the stored file cannot be removed', async () => {
    const owner = await createBusiness()
    const [row] = await db
      .insert(feedback)
      .values({ userId: owner.id, audioKey: 'test/a.webm' })
      .returning()
    storage.deleteAudio.mockRejectedValueOnce(new Error('R2 down'))
    expect(await deleteFeedback(owner.id, row.id)).toBe(true)
    expect(await db.select().from(feedback)).toHaveLength(0)
  })
})

describe('applyRetention', () => {
  it('works through a backlog bigger than one batch', async () => {
    const owner = await createBusiness()
    await db.insert(feedback).values(
      Array.from({ length: 5 }, (_, i) => ({
        userId: owner.id,
        audioKey: `test/old-${i}.webm`,
        createdAt: daysAgo(400),
      })),
    )
    expect(await applyRetention(new Date(), { batchSize: 2 })).toMatchObject({
      audioDeleted: 5,
    })
    expect(storage.deleteAudio).toHaveBeenCalledTimes(5)
  })

  it('deletes audio after a year but keeps the transcript', async () => {
    const owner = await createBusiness()
    const [old, recent] = await db
      .insert(feedback)
      .values([
        {
          userId: owner.id,
          audioKey: 'test/old.webm',
          transcript: 'Old.',
          createdAt: daysAgo(400),
        },
        {
          userId: owner.id,
          audioKey: 'test/new.webm',
          transcript: 'New.',
          createdAt: daysAgo(10),
        },
      ])
      .returning()

    expect(await applyRetention()).toMatchObject({ audioDeleted: 1 })
    expect(storage.deleteAudio).toHaveBeenCalledWith('test/old.webm')
    const [oldRow] = await db
      .select()
      .from(feedback)
      .where(eq(feedback.id, old.id))
    expect(oldRow).toMatchObject({ audioKey: null, transcript: 'Old.' })
    const [recentRow] = await db
      .select()
      .from(feedback)
      .where(eq(feedback.id, recent.id))
    expect(recentRow.audioKey).toBe('test/new.webm')
  })

  it('forgets reply addresses once used, or after 90 days', async () => {
    const owner = await createBusiness()
    const rows = await db
      .insert(feedback)
      .values([
        {
          userId: owner.id,
          contactEmail: 'a@example.test',
          replyText: 'Thanks',
          repliedAt: new Date(Date.now() - 2 * 3_600_000),
        },
        {
          userId: owner.id,
          contactEmail: 'b@example.test',
          createdAt: daysAgo(91),
        },
        {
          userId: owner.id,
          contactEmail: 'c@example.test',
          createdAt: daysAgo(5),
        },
      ])
      .returning()

    // A reply sent minutes ago may still be retried, so its address stays.
    await db.insert(feedback).values({
      userId: owner.id,
      contactEmail: 'd@example.test',
      repliedAt: new Date(),
    })
    expect(await applyRetention()).toMatchObject({ contactsForgotten: 2 })
    const [replied] = await db
      .select()
      .from(feedback)
      .where(eq(feedback.id, rows[0].id))
    expect(replied).toMatchObject({ contactEmail: null, replyText: 'Thanks' })
    expect(replied.repliedAt).not.toBeNull()
    const kept = await db
      .select()
      .from(feedback)
      .where(eq(feedback.id, rows[2].id))
    expect(kept[0].contactEmail).toBe('c@example.test')
  })
})
