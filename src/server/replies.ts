import { createHash } from 'node:crypto'
import { and, eq, isNotNull, isNull } from 'drizzle-orm'

import { db } from '@/db/index'
import { feedback, users } from '@/db/schema'
import { sendReplyToCustomer } from '@/lib/email/reply-to-customer'

export const MAX_REPLY_LENGTH = 1000
export const MAX_CONTACT_EMAIL_LENGTH = 254

export class ReplyError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message)
  }
}

/**
 * The contact address a customer typed, tidied, or null if they left none.
 * Throws for something that isn't an email address.
 */
export const contactEmailFrom = (value: string | null | undefined) => {
  const email = value?.trim().toLowerCase() ?? ''
  if (!email) return null
  if (
    email.length > MAX_CONTACT_EMAIL_LENGTH ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  ) {
    throw new ReplyError('That email address doesn’t look right', 400)
  }
  return email
}

/**
 * Known risk, accepted for now (6 Nov 2026): Pulse can't verify that the
 * customer owns the address they typed. Someone could leave feedback with a
 * stranger's address and then "reply" to send that person a message from
 * Pulse's domain. Each attempt costs a paid pulse, replies are one per
 * feedback and 20 a day per business, and the email tells anyone who didn't
 * leave feedback to ignore it. If it is abused, confirm addresses by email
 * before the first reply (double opt-in).
 *
 * Sends the owner's one reply to a customer who left an address. The reply
 * is recorded first, so two clicks can't send twice; if the email then fails
 * it is cleared again so the owner can retry.
 */
export const replyToFeedback = async (
  ownerId: string,
  feedbackId: string,
  rawMessage: string,
) => {
  const message = rawMessage.trim()
  if (!message) throw new ReplyError('Write a reply first', 400)
  if (message.length > MAX_REPLY_LENGTH) {
    throw new ReplyError(`Keep it under ${MAX_REPLY_LENGTH} characters`, 400)
  }

  // Loaded before claiming, so nothing can fail between the claim and the send.
  const [owner] = await db
    .select({ email: users.email, businessName: users.businessName })
    .from(users)
    .where(eq(users.id, ownerId))

  const claimed = (
    await db
      .update(feedback)
      .set({ replyText: message, repliedAt: new Date() })
      .where(
        and(
          eq(feedback.id, feedbackId),
          eq(feedback.userId, ownerId),
          isNotNull(feedback.contactEmail),
          isNull(feedback.repliedAt),
        ),
      )
      .returning({
        contactEmail: feedback.contactEmail,
        createdAt: feedback.createdAt,
      })
  ).at(0)

  if (!claimed?.contactEmail) {
    const exists = (
      await db
        .select({ repliedAt: feedback.repliedAt })
        .from(feedback)
        .where(and(eq(feedback.id, feedbackId), eq(feedback.userId, ownerId)))
    ).at(0)
    if (!exists) throw new ReplyError('Feedback not found', 404)
    throw new ReplyError(
      exists.repliedAt
        ? 'You already replied to this customer'
        : 'This customer didn’t leave a way to reply',
      409,
    )
  }

  try {
    await sendReplyToCustomer({
      to: claimed.contactEmail,
      ownerEmail: owner.email,
      businessName: owner.businessName ?? 'The team',
      message,
      feedbackDate: claimed.createdAt,
      // Resend drops a repeat of the same reply. Edited text after a failed
      // send gets a new key, so the owner can retry with changes. Accepted:
      // if the first send did go through, the customer gets both versions.
      idempotencyKey: `reply/${feedbackId}/${createHash('sha256').update(message).digest('hex').slice(0, 16)}`,
    })
  } catch (error) {
    await db
      .update(feedback)
      .set({ replyText: null, repliedAt: null })
      .where(eq(feedback.id, feedbackId))
    console.error('[reply] email failed', { feedbackId, error })
    throw new ReplyError('The reply didn’t send. Try again in a minute.', 502)
  }
}
