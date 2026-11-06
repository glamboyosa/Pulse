import { eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createBusiness, resetDatabase } from './support/db'
import { db } from '@/db/index'
import { feedback } from '@/db/schema'
import { ReplyError, contactEmailFrom, replyToFeedback } from '@/server/replies'

const email = vi.hoisted(() => ({ send: vi.fn() }))
vi.mock('@/lib/email/reply-to-customer', () => ({
  sendReplyToCustomer: email.send,
}))

const withFeedback = async (contactEmail: string | null) => {
  const owner = await createBusiness()
  const [row] = await db
    .insert(feedback)
    .values({ userId: owner.id, transcript: 'Too loud.', contactEmail })
    .returning()
  return { owner, row }
}

beforeEach(async () => {
  await resetDatabase()
  email.send.mockReset()
  email.send.mockResolvedValue(undefined)
})

describe('contactEmailFrom', () => {
  it('tidies a real address and treats blank as none', () => {
    expect(contactEmailFrom('  Ada@Example.TEST ')).toBe('ada@example.test')
    expect(contactEmailFrom('')).toBeNull()
    expect(contactEmailFrom(undefined)).toBeNull()
  })

  it.each(['not-an-email', 'a@b', 'two words@example.test'])(
    'refuses %s',
    (value) => {
      expect(() => contactEmailFrom(value)).toThrow(ReplyError)
    },
  )
})

describe('replyToFeedback', () => {
  it('emails the reply once and records it', async () => {
    const { owner, row } = await withFeedback('ada@example.test')
    await replyToFeedback(
      owner.id,
      row.id,
      '  Sorry, we have turned it down.  ',
    )

    expect(email.send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'ada@example.test',
        ownerEmail: owner.email,
        businessName: owner.businessName,
        message: 'Sorry, we have turned it down.',
        idempotencyKey: expect.stringMatching(
          new RegExp(`^reply/${row.id}/[0-9a-f]{16}$`),
        ),
      }),
    )
    const [saved] = await db
      .select()
      .from(feedback)
      .where(eq(feedback.id, row.id))
    expect(saved.replyText).toBe('Sorry, we have turned it down.')
    expect(saved.repliedAt).not.toBeNull()

    await expect(
      replyToFeedback(owner.id, row.id, 'Again'),
    ).rejects.toMatchObject({
      status: 409,
      message: 'You already replied to this customer',
    })
    expect(email.send).toHaveBeenCalledTimes(1)
  })

  it('sends one email even when two replies are submitted at once', async () => {
    const { owner, row } = await withFeedback('ada@example.test')
    const results = await Promise.allSettled([
      replyToFeedback(owner.id, row.id, 'First'),
      replyToFeedback(owner.id, row.id, 'Second'),
    ])
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1)
    expect(email.send).toHaveBeenCalledTimes(1)
  })

  it('lets the owner try again when the email fails', async () => {
    const { owner, row } = await withFeedback('ada@example.test')
    email.send.mockRejectedValueOnce(new Error('Resend down'))
    await expect(
      replyToFeedback(owner.id, row.id, 'Hello'),
    ).rejects.toMatchObject({
      status: 502,
    })
    const [cleared] = await db
      .select()
      .from(feedback)
      .where(eq(feedback.id, row.id))
    expect(cleared.repliedAt).toBeNull()

    await replyToFeedback(owner.id, row.id, 'Hello')
    expect(email.send).toHaveBeenCalledTimes(2)
  })

  it('uses a new idempotency key when the retry has edited text', async () => {
    const { owner, row } = await withFeedback('ada@example.test')
    email.send.mockRejectedValueOnce(new Error('Timed out'))
    await expect(replyToFeedback(owner.id, row.id, 'Hello')).rejects.toThrow()
    await replyToFeedback(owner.id, row.id, 'Hello again')
    const keys = email.send.mock.calls.map(
      ([args]) => (args as { idempotencyKey: string }).idempotencyKey,
    )
    expect(keys[0]).not.toBe(keys[1])
  })

  it('refuses when there is no address, no message, or it is not your feedback', async () => {
    const { owner, row } = await withFeedback(null)
    await expect(replyToFeedback(owner.id, row.id, 'Hi')).rejects.toMatchObject(
      {
        status: 409,
        message: 'This customer didn’t leave a way to reply',
      },
    )

    const other = await withFeedback('ada@example.test')
    await expect(
      replyToFeedback(owner.id, other.row.id, 'Hi'),
    ).rejects.toMatchObject({
      status: 404,
    })
    await expect(
      replyToFeedback(other.owner.id, other.row.id, '  '),
    ).rejects.toMatchObject({
      status: 400,
    })
    await expect(
      replyToFeedback(other.owner.id, other.row.id, 'x'.repeat(1001)),
    ).rejects.toMatchObject({ status: 400 })
    expect(email.send).not.toHaveBeenCalled()
  })
})
