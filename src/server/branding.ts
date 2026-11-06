import { eq } from 'drizzle-orm'

import type { Accent } from '@/lib/branding-options'
import { db } from '@/db/index'
import { users } from '@/db/schema'
import {
  AUDIO_KEY_PREFIX,
  deleteAudio as deleteObject,
  getAudioUrl as getObjectUrl,
  uploadAudio as uploadObject,
} from '@/lib/storage/r2'
import { ACCENTS, LIMITS } from '@/lib/branding-options'

// Only Google's own review-link forms, so the page can't send customers
// elsewhere: no google.com/url redirects and no goo.gl short links.
const isGoogleReviewLink = (url: URL) =>
  url.hostname === 'g.page' ||
  url.hostname === 'maps.app.goo.gl' ||
  (url.hostname === 'search.google.com' &&
    url.pathname.startsWith('/local/writereview')) ||
  (['www.google.com', 'google.com', 'maps.google.com'].includes(url.hostname) &&
    url.pathname.startsWith('/maps'))

export class BrandingError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message)
  }
}

export type BrandingInput = {
  feedbackQuestion: string
  accentColor: string
  googleReviewUrl: string
  thankYouMessage: string
}

/** What the customer page shows. Everything here is public. */
export type Branding = {
  userId: string
  businessName: string
  question: string | null
  accent: string
  logoUrl: string | null
  googleReviewUrl: string | null
  thankYouMessage: string | null
}

const clean = (value: string, max: number, label: string) => {
  const trimmed = value.trim().replace(/\s+/g, ' ')
  if (trimmed.length > max) {
    throw new BrandingError(`${label} must be under ${max} characters`)
  }
  return trimmed || null
}

const reviewUrl = (value: string) => {
  const trimmed = value.trim()
  if (!trimmed) return null
  let url: URL
  try {
    url = new URL(trimmed)
  } catch {
    throw new BrandingError(
      'Paste the full Google review link, starting https://',
    )
  }
  if (url.protocol !== 'https:' || !isGoogleReviewLink(url)) {
    throw new BrandingError(
      'Use a Google review link (g.page, google.com or maps.app.goo.gl)',
    )
  }
  return url.toString()
}

export const updateBranding = async (userId: string, input: BrandingInput) => {
  if (!Object.hasOwn(ACCENTS, input.accentColor)) {
    throw new BrandingError('Pick one of the accent colours')
  }
  await db
    .update(users)
    .set({
      feedbackQuestion: clean(
        input.feedbackQuestion,
        LIMITS.question,
        'The question',
      ),
      accentColor: input.accentColor,
      googleReviewUrl: reviewUrl(input.googleReviewUrl),
      thankYouMessage: clean(
        input.thankYouMessage,
        LIMITS.thankYou,
        'The thank-you message',
      ),
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId))
}

// Checked by content, not the declared type, so nothing but an image is stored.
const imageType = (bytes: Uint8Array): 'png' | 'jpg' | 'webp' | null => {
  if (
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) {
    return 'png'
  }
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'jpg'
  if (
    String.fromCharCode(...bytes.subarray(0, 4)) === 'RIFF' &&
    String.fromCharCode(...bytes.subarray(8, 12)) === 'WEBP'
  ) {
    return 'webp'
  }
  return null
}

const CONTENT_TYPES = {
  png: 'image/png',
  jpg: 'image/jpeg',
  webp: 'image/webp',
}

/**
 * Points the owner's logo at `key` (or none) and returns the key it replaced.
 * The row is locked, so two uploads at once each see the other's key and
 * every replaced logo gets deleted.
 */
const swapLogoKey = (userId: string, key: string | null) =>
  db.transaction(async (tx) => {
    const [previous] = await tx
      .select({ logoKey: users.logoKey })
      .from(users)
      .where(eq(users.id, userId))
      .for('update')
    await tx.update(users).set({ logoKey: key }).where(eq(users.id, userId))
    return previous.logoKey
  })

const deleteReplaced = async (key: string | null) => {
  if (!key) return
  await deleteObject(key).catch((error: unknown) =>
    console.error('[branding] could not delete old logo', { key, error }),
  )
}

/** Stores a new logo (PNG, JPEG or WebP, up to 1 MB) and removes the old one. */
export const setLogo = async (userId: string, file: Blob) => {
  if (file.size > LIMITS.logoBytes) {
    throw new BrandingError('Use a logo under 1 MB', 413)
  }
  const bytes = new Uint8Array(await file.arrayBuffer())
  const type = imageType(bytes)
  if (!type) throw new BrandingError('Use a PNG, JPEG or WebP image', 415)

  const key = `${AUDIO_KEY_PREFIX}logos/${userId}/${crypto.randomUUID()}.${type}`
  await uploadObject(key, Buffer.from(bytes), CONTENT_TYPES[type])
  let replaced: string | null
  try {
    replaced = await swapLogoKey(userId, key)
  } catch (error) {
    await deleteReplaced(key)
    throw error
  }
  await deleteReplaced(replaced)
}

export const removeLogo = async (userId: string) => {
  await deleteReplaced(await swapLogoKey(userId, null))
}

/** A short-lived link to a business's logo, for the stable logo route. */
export const logoUrlFor = async (code: string): Promise<string | null> => {
  const row = (
    await db
      .select({ logoKey: users.logoKey })
      .from(users)
      .where(eq(users.uniqueCode, code))
      .limit(1)
  ).at(0)
  return row?.logoKey ? getObjectUrl(row.logoKey, 3600) : null
}

/**
 * The stable address pages use for a logo. The version changes with each
 * upload, so browsers cache it until the owner replaces it.
 */
const logoPath = (code: string, key: string) =>
  `/api/businesses/${encodeURIComponent(code)}/logo?v=${key.split('/').pop()?.split('.')[0] ?? ''}`

/** Branding for a business by its QR code, or null if there is no such business. */
export const brandingFor = async (code: string): Promise<Branding | null> => {
  const row = (
    await db
      .select({
        userId: users.id,
        businessName: users.businessName,
        question: users.feedbackQuestion,
        accent: users.accentColor,
        logoKey: users.logoKey,
        googleReviewUrl: users.googleReviewUrl,
        thankYouMessage: users.thankYouMessage,
      })
      .from(users)
      .where(eq(users.uniqueCode, code))
      .limit(1)
  ).at(0)
  if (!row) return null

  return {
    userId: row.userId,
    // Set at onboarding together with the code, so a business with a code has one.
    businessName: row.businessName ?? '',
    question: row.question,
    accent:
      row.accent && Object.hasOwn(ACCENTS, row.accent)
        ? ACCENTS[row.accent as Accent]
        : ACCENTS.black,
    logoUrl: row.logoKey ? logoPath(code, row.logoKey) : null,
    googleReviewUrl: row.googleReviewUrl,
    thankYouMessage: row.thankYouMessage,
  }
}
