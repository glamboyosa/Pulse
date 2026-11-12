import { and, asc, eq, isNotNull, lt, or, sql } from 'drizzle-orm'

import { db } from '@/db/index'
import {
  feedback,
  otpCodes,
  pulsePurchases,
  rateLimits,
  spots,
  users,
  vouchers,
  weeklyDigests,
} from '@/db/schema'
import { deleteAudio as deleteObject } from '@/lib/storage/r2'

const DAY_MS = 24 * 60 * 60 * 1000
/** Recordings are kept a year; transcripts and analysis stay after that. */
export const AUDIO_RETENTION_DAYS = 365
/** A reply address is forgotten once used, or after this long unused. */
export const CONTACT_RETENTION_DAYS = 90

/** Removes stored files after their rows are gone. A miss is logged, not fatal. */
const deleteObjects = async (keys: Array<string>) => {
  const results = await Promise.allSettled(keys.map((key) => deleteObject(key)))
  results.forEach((result, i) => {
    if (result.status === 'rejected') {
      console.error('[account] could not delete stored file', {
        key: keys[i],
        error: result.reason,
      })
    }
  })
}

/** Deletes one of the owner's recordings and its audio. False if not theirs. */
export const deleteFeedback = async (ownerId: string, feedbackId: string) => {
  const deleted = await db
    .delete(feedback)
    .where(and(eq(feedback.id, feedbackId), eq(feedback.userId, ownerId)))
    .returning({ audioKey: feedback.audioKey })
  const row = deleted.at(0)
  if (!row) return false
  if (row.audioKey) await deleteObjects([row.audioKey])
  return true
}

/**
 * Everything Pulse holds about the owner's business, as plain data. Customer
 * reply addresses are left out: the owner never sees them in the app either.
 */
export const exportAccount = async (ownerId: string) => {
  const [account] = await db
    .select({
      email: users.email,
      businessName: users.businessName,
      businessType: users.businessType,
      feedbackCode: users.uniqueCode,
      pulsesRemaining: users.pulsesRemaining,
      feedbackQuestion: users.feedbackQuestion,
      googleReviewUrl: users.googleReviewUrl,
      thankYouMessage: users.thankYouMessage,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(eq(users.id, ownerId))

  const [allSpots, allFeedback, purchases, digests] = await Promise.all([
    db
      .select({
        name: spots.name,
        slug: spots.slug,
        archivedAt: spots.archivedAt,
      })
      .from(spots)
      .where(eq(spots.userId, ownerId))
      .orderBy(asc(spots.createdAt)),
    db
      .select({
        id: feedback.id,
        createdAt: feedback.createdAt,
        source: feedback.source,
        customerName: feedback.customerName,
        durationSeconds: feedback.duration,
        transcript: feedback.transcript,
        language: feedback.language,
        translation: feedback.translation,
        summary: feedback.summary,
        sentiment: feedback.sentiment,
        themes: feedback.themes,
        spot: spots.name,
        reply: feedback.replyText,
        repliedAt: feedback.repliedAt,
      })
      .from(feedback)
      .leftJoin(spots, eq(spots.id, feedback.spotId))
      .where(eq(feedback.userId, ownerId))
      .orderBy(asc(feedback.createdAt)),
    db
      .select({
        pulses: pulsePurchases.amount,
        priceCents: pulsePurchases.price,
        status: pulsePurchases.status,
        refundedPulses: pulsePurchases.refundedPulses,
        createdAt: pulsePurchases.createdAt,
      })
      .from(pulsePurchases)
      .where(eq(pulsePurchases.userId, ownerId))
      .orderBy(asc(pulsePurchases.createdAt)),
    db
      .select({
        weekStart: weeklyDigests.weekStart,
        content: weeklyDigests.content,
      })
      .from(weeklyDigests)
      .where(eq(weeklyDigests.userId, ownerId))
      .orderBy(asc(weeklyDigests.weekStart)),
  ])
  const allVouchers = await db
    .select({
      code: vouchers.code,
      offer: vouchers.offer,
      issuedAt: vouchers.createdAt,
      expiresAt: vouchers.expiresAt,
      redeemedAt: vouchers.redeemedAt,
    })
    .from(vouchers)
    .where(eq(vouchers.userId, ownerId))
    .orderBy(asc(vouchers.createdAt))

  return {
    exportedAt: new Date().toISOString(),
    account,
    spots: allSpots,
    feedback: allFeedback,
    purchases,
    weeklyDigests: digests,
    vouchers: allVouchers,
  }
}

/**
 * Deletes the owner's account and everything in it: recordings and their
 * audio, the logo, spots, digests, purchase records and login codes. Polar
 * keeps its own receipts for any purchases.
 */
export const deleteAccount = async (ownerId: string) => {
  const files = await db.transaction(async (tx) => {
    const owner = (
      await tx
        .select({ email: users.email, logoKey: users.logoKey })
        .from(users)
        .where(eq(users.id, ownerId))
        .for('update')
    ).at(0)
    // Already deleted, e.g. the same form submitted from two tabs.
    if (!owner) return []
    const recordings = await tx
      .delete(feedback)
      .where(eq(feedback.userId, ownerId))
      .returning({ audioKey: feedback.audioKey })
    await tx.delete(vouchers).where(eq(vouchers.userId, ownerId))
    await tx.delete(weeklyDigests).where(eq(weeklyDigests.userId, ownerId))
    await tx.delete(spots).where(eq(spots.userId, ownerId))
    await tx.delete(pulsePurchases).where(eq(pulsePurchases.userId, ownerId))
    await tx.delete(otpCodes).where(eq(otpCodes.email, owner.email))
    await tx
      .delete(rateLimits)
      .where(eq(rateLimits.key, `otp:email:${owner.email}`))
    await tx.delete(users).where(eq(users.id, ownerId))
    return [
      ...recordings.flatMap((r) => (r.audioKey ? [r.audioKey] : [])),
      ...(owner.logoKey ? [owner.logoKey] : []),
    ]
  })
  await deleteObjects(files)
}

/**
 * The daily clean-up: deletes audio older than a year (the transcript stays)
 * and forgets reply addresses once used or after 90 days. Works in batches so
 * one run stays well inside the function's time limit.
 */
export const applyRetention = async (
  now = new Date(),
  { batchSize = 500, budgetMs = 240_000 } = {},
) => {
  const startedAt = Date.now()
  const audioCutoff = new Date(now.getTime() - AUDIO_RETENTION_DAYS * DAY_MS)
  let audioDeleted = 0

  // Batches until the backlog is clear, stopping well before the function's
  // 300-second limit; the next day's run picks up anything left.
  while (Date.now() - startedAt < budgetMs) {
    // Forget the keys first: a failed file delete leaves an orphan in R2
    // (logged), never a row pointing at audio that is gone.
    const batch = (
      await db.execute<{ audio_key: string }>(sql`
        with expired as (
          select id, audio_key from feedback
          where audio_key is not null and created_at < ${audioCutoff.toISOString()}
          limit ${batchSize}
          for update skip locked
        )
        update feedback f set audio_key = null, audio_url = null
        from expired where f.id = expired.id
        returning expired.audio_key
      `)
    ).rows
    await deleteObjects(batch.map((row) => row.audio_key))
    if (batch.length === 0) break
    audioDeleted += batch.length
    if (batch.length < batchSize) break
  }

  const contactCutoff = new Date(
    now.getTime() - CONTACT_RETENTION_DAYS * DAY_MS,
  )
  // An hour after a reply, so a reply still being sent can be retried.
  const replySettled = new Date(now.getTime() - 60 * 60 * 1000)
  const forgotten = await db
    .update(feedback)
    .set({ contactEmail: null })
    .where(
      and(
        isNotNull(feedback.contactEmail),
        or(
          lt(feedback.repliedAt, replySettled),
          lt(feedback.createdAt, contactCutoff),
        ),
      ),
    )
    .returning({ id: feedback.id })

  return { audioDeleted, contactsForgotten: forgotten.length }
}
