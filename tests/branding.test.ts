import { eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createBusiness, resetDatabase } from './support/db'
import { db } from '@/db/index'
import { users } from '@/db/schema'
import { ACCENTS } from '@/lib/branding-options'
import {
  BrandingError,
  brandingFor,
  removeLogo,
  setLogo,
  updateBranding,
} from '@/server/branding'

const storage = vi.hoisted(() => ({
  uploadAudio: vi.fn(),
  deleteAudio: vi.fn(),
  getAudioUrl: vi.fn((key: string) =>
    Promise.resolve(`https://r2.test/${key}`),
  ),
}))
vi.mock('@/lib/storage/r2', () => ({ ...storage, AUDIO_KEY_PREFIX: 'test/' }))

const valid = {
  feedbackQuestion: '  How was   your meal tonight? ',
  accentColor: 'green',
  googleReviewUrl: 'https://g.page/r/abc123/review',
  thankYouMessage: 'Show this for 10% off',
}

const png = () =>
  new Blob([
    new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]),
  ])

beforeEach(async () => {
  await resetDatabase()
  vi.clearAllMocks()
  storage.uploadAudio.mockResolvedValue(undefined)
  storage.deleteAudio.mockResolvedValue(undefined)
})

describe('updateBranding', () => {
  it('saves tidy values and shows them on the customer page', async () => {
    const owner = await createBusiness()
    await updateBranding(owner.id, valid)

    expect(await brandingFor(owner.uniqueCode!)).toEqual({
      userId: owner.id,
      businessName: owner.businessName,
      question: 'How was your meal tonight?',
      accent: ACCENTS.green,
      logoUrl: null,
      googleReviewUrl: 'https://g.page/r/abc123/review',
      thankYouMessage: 'Show this for 10% off',
    })
  })

  it('stores blanks as nothing, and falls back to the default page', async () => {
    const owner = await createBusiness()
    await updateBranding(owner.id, {
      feedbackQuestion: ' ',
      accentColor: 'black',
      googleReviewUrl: '',
      thankYouMessage: '',
    })
    expect(await brandingFor(owner.uniqueCode!)).toMatchObject({
      question: null,
      googleReviewUrl: null,
      thankYouMessage: null,
      accent: ACCENTS.black,
    })
  })

  it.each([
    ['an accent that is not on the list', { accentColor: 'toString' }],
    [
      'a review link outside Google',
      { googleReviewUrl: 'https://evil.test/review' },
    ],
    [
      'a review link that is not https',
      { googleReviewUrl: 'http://g.page/r/abc' },
    ],
    ['a review link that is not a URL', { googleReviewUrl: 'g.page/r/abc' }],
    [
      "Google's redirect to another site",
      { googleReviewUrl: 'https://www.google.com/url?q=https://evil.test' },
    ],
    ['a goo.gl short link', { googleReviewUrl: 'https://goo.gl/abc' }],
    [
      'a thank-you message that is too long',
      { thankYouMessage: 'x'.repeat(201) },
    ],
    ['a question that is too long', { feedbackQuestion: 'x'.repeat(121) }],
  ])('refuses %s', async (_, change) => {
    const owner = await createBusiness()
    await expect(
      updateBranding(owner.id, { ...valid, ...change }),
    ).rejects.toBeInstanceOf(BrandingError)
  })

  it.each([
    'https://search.google.com/local/writereview?placeid=abc',
    'https://maps.app.goo.gl/abc123',
    'https://www.google.com/maps/place/Test+Cafe+130',
  ])('accepts the Google review link %s', async (googleReviewUrl) => {
    const owner = await createBusiness()
    await updateBranding(owner.id, { ...valid, googleReviewUrl })
    expect((await brandingFor(owner.uniqueCode!))?.googleReviewUrl).toBe(
      googleReviewUrl,
    )
  })

  it('returns null for an unknown business', async () => {
    expect(await brandingFor('nobody-here')).toBeNull()
  })
})

describe('logos', () => {
  it('stores an image under a new key and deletes the one it replaces', async () => {
    const owner = await createBusiness()
    await setLogo(owner.id, png())
    const [first] = await db.select().from(users).where(eq(users.id, owner.id))
    expect(first.logoKey).toMatch(
      new RegExp(`^test/logos/${owner.id}/.+\\.png$`),
    )
    expect(storage.uploadAudio).toHaveBeenCalledWith(
      first.logoKey,
      expect.any(Buffer),
      'image/png',
    )

    await setLogo(owner.id, png())
    expect(storage.deleteAudio).toHaveBeenCalledWith(first.logoKey)
    const [second] = await db.select().from(users).where(eq(users.id, owner.id))
    const version = second.logoKey!.split('/').pop()!.split('.')[0]
    expect((await brandingFor(owner.uniqueCode!))?.logoUrl).toBe(
      `/api/businesses/${owner.uniqueCode}/logo?v=${version}`,
    )

    await removeLogo(owner.id)
    expect(storage.deleteAudio).toHaveBeenLastCalledWith(second.logoKey)
    expect((await brandingFor(owner.uniqueCode!))?.logoUrl).toBeNull()
  })

  it('deletes every replaced logo when two uploads overlap', async () => {
    const owner = await createBusiness()
    await Promise.all([setLogo(owner.id, png()), setLogo(owner.id, png())])

    const [row] = await db.select().from(users).where(eq(users.id, owner.id))
    const uploaded = storage.uploadAudio.mock.calls.map(
      ([key]) => key as string,
    )
    expect(uploaded).toHaveLength(2)
    expect(storage.deleteAudio).toHaveBeenCalledTimes(1)
    expect(storage.deleteAudio).toHaveBeenCalledWith(
      uploaded.find((key) => key !== row.logoKey),
    )
  })

  it('refuses a file that is not an image, whatever its declared type', async () => {
    const owner = await createBusiness()
    const html = new Blob(['<script>alert(1)</script>'], { type: 'image/png' })
    await expect(setLogo(owner.id, html)).rejects.toMatchObject({ status: 415 })
    expect(storage.uploadAudio).not.toHaveBeenCalled()
  })

  it('refuses a logo over 1 MB', async () => {
    const owner = await createBusiness()
    const big = new Blob([new Uint8Array(1024 * 1024 + 1)])
    await expect(setLogo(owner.id, big)).rejects.toMatchObject({ status: 413 })
  })
})
