import { createHmac, randomInt } from 'node:crypto'
import { and, count, eq, gte, isNull, sql } from 'drizzle-orm'
import { SignJWT, jwtVerify } from 'jose'

import { db } from '@/db/index'
import { feedback, users, vouchers } from '@/db/schema'
import { env } from '@/env'

// Vouchers reward leaving feedback, whatever it says. Nothing here may read
// sentiment, and nothing here touches the Google review link: incentives tied
// to positive feedback or to reviews break the FTC fake-reviews rule, UK
// consumer law and Google's policy.

// No 0/O, 1/I/L: staff read these aloud and type them.
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
export const CODE_LENGTH = 6

export const VOUCHER_LIMITS = {
  offer: 80,
  maxExpiryDays: 365,
  maxMonthlyCap: 10_000,
}

/** Vouchers need a real note: this many typed characters, or spoken words and seconds. */
export const MIN_TYPED_CHARS = 20
export const MIN_VOICE_SECONDS = 5
export const MIN_SPOKEN_WORDS = 3

/** One voucher per browser per business in this window. */
export const BROWSER_WINDOW_DAYS = 30
/** Customers in one venue may share wifi, so the per-connection backstop is looser. */
export const IP_LIMIT_PER_DAY = 3
/** A voucher must be claimed soon after sending; old notes can't earn one later. */
const CLAIM_WINDOW = sql`interval '1 hour'`

const DAY_MS = 24 * 60 * 60 * 1000

export class VoucherError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message)
  }
}

export const generateVoucherCode = () =>
  Array.from(
    { length: CODE_LENGTH },
    () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)],
  ).join('')

/** A typed or scanned code in canonical form, or null if it can't be one. */
export const normaliseVoucherCode = (input: string): string | null => {
  const code = input.replace(/[\s-]/g, '').toUpperCase()
  return code.length === CODE_LENGTH &&
    [...code].every((char) => CODE_ALPHABET.includes(char))
    ? code
    : null
}

export type VoucherSettings = {
  enabled: boolean
  offer: string
  expiryDays: number
  monthlyCap: number
}

export const voucherSettings = async (
  userId: string,
): Promise<VoucherSettings> => {
  const [row] = await db
    .select({
      enabled: users.voucherEnabled,
      offer: users.voucherOffer,
      expiryDays: users.voucherExpiryDays,
      monthlyCap: users.voucherMonthlyCap,
    })
    .from(users)
    .where(eq(users.id, userId))
  return { ...row, offer: row.offer ?? '' }
}

export const updateVoucherSettings = async (
  userId: string,
  input: VoucherSettings,
) => {
  const offer = input.offer.trim().replace(/\s+/g, ' ')
  if (offer.length > VOUCHER_LIMITS.offer) {
    throw new VoucherError(
      `Keep the offer under ${VOUCHER_LIMITS.offer} characters`,
    )
  }
  if (input.enabled && !offer) {
    throw new VoucherError('Write the offer customers get')
  }
  if (input.expiryDays < 1 || input.expiryDays > VOUCHER_LIMITS.maxExpiryDays) {
    throw new VoucherError(
      `Vouchers must last between 1 and ${VOUCHER_LIMITS.maxExpiryDays} days`,
    )
  }
  if (input.monthlyCap < 1 || input.monthlyCap > VOUCHER_LIMITS.maxMonthlyCap) {
    throw new VoucherError(
      `The monthly limit must be between 1 and ${VOUCHER_LIMITS.maxMonthlyCap}`,
    )
  }
  await db
    .update(users)
    .set({
      voucherEnabled: input.enabled,
      voucherOffer: offer || null,
      voucherExpiryDays: input.expiryDays,
      voucherMonthlyCap: input.monthlyCap,
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId))
}

// Calendar months in UTC, for the cap and the dashboard figures.
const startOfMonth = sql`date_trunc('month', now() at time zone 'utc')`

const issuedThisMonth = async (
  userId: string,
  database: Pick<typeof db, 'select'> = db,
) => {
  const [row] = await database
    .select({ count: count() })
    .from(vouchers)
    .where(
      and(eq(vouchers.userId, userId), gte(vouchers.createdAt, startOfMonth)),
    )
  return row.count
}

/** The offer to show customers before they record, or null when off or used up. */
export const publicOffer = async (business: {
  id: string
  voucherEnabled: boolean
  voucherOffer: string | null
  voucherMonthlyCap: number
}): Promise<string | null> => {
  if (!business.voucherEnabled || !business.voucherOffer) return null
  return (await issuedThisMonth(business.id)) < business.voucherMonthlyCap
    ? business.voucherOffer
    : null
}

export const monthlyVoucherStats = async (userId: string) => {
  const [row] = await db
    .select({
      issued: sql<number>`count(*) filter (where ${vouchers.createdAt} >= ${startOfMonth})`,
      redeemed: sql<number>`count(*) filter (where ${vouchers.redeemedAt} >= ${startOfMonth})`,
    })
    .from(vouchers)
    .where(eq(vouchers.userId, userId))
  return { issued: Number(row.issued), redeemed: Number(row.redeemed) }
}

// The browser cookie that says "this browser already has a voucher from this
// business". Signed, so it can't be forged to look like it doesn't exist; a
// customer can delete it, which is what the IP backstop is for.
const secret = () => {
  if (!env.SESSION_SECRET) throw new Error('SESSION_SECRET is not set')
  return env.SESSION_SECRET
}
const cookieKey = () => new TextEncoder().encode(secret())
const COOKIE_AUDIENCE = 'pulse-voucher'

export const voucherCookieName = (businessId: string) =>
  `pulse_voucher_${businessId.replace(/-/g, '')}`

const browserToken = (businessId: string) =>
  new SignJWT({})
    .setProtectedHeader({ alg: 'HS256' })
    .setAudience(COOKIE_AUDIENCE)
    .setSubject(businessId)
    .setExpirationTime(`${BROWSER_WINDOW_DAYS}d`)
    .sign(cookieKey())

const hasBrowserToken = async (businessId: string, token?: string) => {
  if (!token) return false
  try {
    const { payload } = await jwtVerify(token, cookieKey(), {
      algorithms: ['HS256'],
      audience: COOKIE_AUDIENCE,
      subject: businessId,
    })
    return Boolean(payload)
  } catch {
    return false
  }
}

/** Set on the response that issues a voucher. */
export const voucherCookie = async (businessId: string) =>
  [
    `${voucherCookieName(businessId)}=${await browserToken(businessId)}`,
    'Path=/api/feedback',
    `Max-Age=${BROWSER_WINDOW_DAYS * 24 * 60 * 60}`,
    'HttpOnly',
    'SameSite=Lax',
    ...(process.env.NODE_ENV === 'production' ? ['Secure'] : []),
  ].join('; ')

export const hashIp = (ip: string) =>
  createHmac('sha256', secret())
    .update(`voucher-ip:${ip}`)
    .digest('hex')
    .slice(0, 32)

/** Whether a finished note is a real one: enough typed text, or real speech. */
export const qualifiesForVoucher = (note: {
  source: string
  transcript: string | null
  duration: number | null
}) => {
  const text = note.transcript?.trim() ?? ''
  if (note.source === 'text') return text.length >= MIN_TYPED_CHARS
  const words = text.split(/\s+/).filter((word) => /\p{L}/u.test(word))
  return (
    (note.duration ?? 0) >= MIN_VOICE_SECONDS &&
    words.length >= MIN_SPOKEN_WORDS
  )
}

/**
 * The last moment of the day `days` from now, in UTC. Customers see only the
 * date, so a voucher must last all of that day: a UK venue gets until
 * midnight, a Lagos one until 1am.
 */
export const voucherExpiry = (issuedAt: Date, days: number) =>
  new Date(
    Date.UTC(
      issuedAt.getUTCFullYear(),
      issuedAt.getUTCMonth(),
      issuedAt.getUTCDate() + days,
      23,
      59,
      59,
      999,
    ),
  )

export type IssuedVoucher = {
  code: string
  offer: string
  expiresAt: Date
}

export type VoucherClaim =
  | { status: 'pending' }
  | { status: 'issued'; voucher: IssuedVoucher; businessId: string }
  // too-short: the note didn't qualify. failed: it couldn't be transcribed.
  // already: this browser or connection has one. unavailable: vouchers are
  // off, used up, or the note is too old.
  | {
      status: 'none'
      reason: 'too-short' | 'failed' | 'already' | 'unavailable'
    }

const issued = (
  row: typeof vouchers.$inferSelect,
  businessId: string,
): VoucherClaim => ({
  status: 'issued',
  businessId,
  voucher: { code: row.code, offer: row.offer, expiresAt: row.expiresAt },
})

const isUniqueViolation = (error: unknown) =>
  (error as { code?: string } | null)?.code === '23505' ||
  (error as { cause?: { code?: string } } | null)?.cause?.code === '23505'

/**
 * Issues the voucher for one note, once its transcript is in, or says why
 * not. Asked by the customer's browser after sending, so it sees their
 * browser cookie and IP. Asking again returns the same voucher. Returns null
 * if there is no such note.
 */
export const claimVoucher = async (input: {
  feedbackId: string
  cookies: Record<string, string>
  ip: string
}): Promise<VoucherClaim | null> => {
  const note = (
    await db
      .select({
        userId: feedback.userId,
        channel: feedback.channel,
        source: feedback.source,
        status: feedback.status,
        transcript: feedback.transcript,
        duration: feedback.duration,
        recent: sql<boolean>`${feedback.createdAt} > now() - ${CLAIM_WINDOW}`,
      })
      .from(feedback)
      .where(eq(feedback.id, input.feedbackId))
      .limit(1)
  ).at(0)
  if (!note) return null

  const existing = (
    await db
      .select()
      .from(vouchers)
      .where(eq(vouchers.feedbackId, input.feedbackId))
      .limit(1)
  ).at(0)
  if (existing) return issued(existing, note.userId)

  // Website widget notes don't earn vouchers in this version.
  if (note.channel !== 'qr' || !note.recent) {
    return { status: 'none', reason: 'unavailable' }
  }
  if (note.status === 'processing') return { status: 'pending' }
  if (note.status !== 'ready') return { status: 'none', reason: 'failed' }
  if (!qualifiesForVoucher(note)) {
    return { status: 'none', reason: 'too-short' }
  }
  if (
    await hasBrowserToken(
      note.userId,
      input.cookies[voucherCookieName(note.userId)],
    )
  ) {
    return { status: 'none', reason: 'already' }
  }
  const ipHash = hashIp(input.ip)
  const [fromIp] = await db
    .select({ count: count() })
    .from(vouchers)
    .where(
      and(
        eq(vouchers.userId, note.userId),
        eq(vouchers.ipHash, ipHash),
        gte(vouchers.createdAt, new Date(Date.now() - DAY_MS)),
      ),
    )
  if (fromIp.count >= IP_LIMIT_PER_DAY) {
    return { status: 'none', reason: 'already' }
  }

  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      return await db.transaction(async (tx) => {
        // Locks the business, so two claims at once can't both take the last
        // voucher under the cap.
        const [business] = await tx
          .select({
            enabled: users.voucherEnabled,
            offer: users.voucherOffer,
            expiryDays: users.voucherExpiryDays,
            cap: users.voucherMonthlyCap,
          })
          .from(users)
          .where(eq(users.id, note.userId))
          .for('update')
        // Another request for this note may have issued it while we waited.
        const raced = (
          await tx
            .select()
            .from(vouchers)
            .where(eq(vouchers.feedbackId, input.feedbackId))
        ).at(0)
        if (raced) return issued(raced, note.userId)
        if (
          !business.enabled ||
          !business.offer ||
          (await issuedThisMonth(note.userId, tx)) >= business.cap
        ) {
          return { status: 'none', reason: 'unavailable' } as const
        }
        const [row] = await tx
          .insert(vouchers)
          .values({
            userId: note.userId,
            feedbackId: input.feedbackId,
            code: generateVoucherCode(),
            offer: business.offer,
            ipHash,
            expiresAt: voucherExpiry(new Date(), business.expiryDays),
          })
          .returning()
        return issued(row, note.userId)
      })
    } catch (error) {
      // A code clash with another of this business's vouchers: try a new code.
      if (!isUniqueViolation(error)) throw error
    }
  }
  throw new Error('Could not find a free voucher code')
}

export type VoucherState = 'valid' | 'redeemed' | 'expired'

export type VoucherDetails = {
  code: string
  offer: string
  issuedAt: Date
  expiresAt: Date
  redeemedAt: Date | null
  state: VoucherState
}

const details = (row: typeof vouchers.$inferSelect): VoucherDetails => ({
  code: row.code,
  offer: row.offer,
  issuedAt: row.createdAt,
  expiresAt: row.expiresAt,
  redeemedAt: row.redeemedAt,
  state: row.redeemedAt
    ? 'redeemed'
    : row.expiresAt <= new Date()
      ? 'expired'
      : 'valid',
})

/** One of the owner's vouchers by its code, or null. */
export const findVoucher = async (
  userId: string,
  code: string,
): Promise<VoucherDetails | null> => {
  const normalised = normaliseVoucherCode(code)
  if (!normalised) return null
  const row = (
    await db
      .select()
      .from(vouchers)
      .where(and(eq(vouchers.userId, userId), eq(vouchers.code, normalised)))
      .limit(1)
  ).at(0)
  return row ? details(row) : null
}

/**
 * Marks a valid voucher used. One statement, so two staff phones can't both
 * redeem it. Returns the voucher afterwards (check `redeemed` for whether
 * this call used it), or null if there is no such voucher.
 */
export const redeemVoucher = async (
  userId: string,
  code: string,
): Promise<{ redeemed: boolean; voucher: VoucherDetails } | null> => {
  const normalised = normaliseVoucherCode(code)
  if (!normalised) return null
  const row = (
    await db
      .update(vouchers)
      .set({ redeemedAt: new Date() })
      .where(
        and(
          eq(vouchers.userId, userId),
          eq(vouchers.code, normalised),
          isNull(vouchers.redeemedAt),
          sql`${vouchers.expiresAt} > now()`,
        ),
      )
      .returning()
  ).at(0)
  if (row) return { redeemed: true, voucher: details(row) }
  const voucher = await findVoucher(userId, normalised)
  return voucher ? { redeemed: false, voucher } : null
}
