import { eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createBusiness, resetDatabase } from './support/db'
import { db } from '@/db/index'
import { feedback } from '@/db/schema'
import { submitFeedback } from '@/server/feedback-submission'
import {
  MAX_SPOTS,
  SpotError,
  archiveSpot,
  createSpot,
  findSpot,
  listSpots,
  slugify,
} from '@/server/spots'

vi.mock('@/lib/storage/r2', () => ({
  AUDIO_KEY_PREFIX: 'test/',
  uploadAudio: vi.fn().mockResolvedValue(undefined),
  deleteAudio: vi.fn().mockResolvedValue(undefined),
  downloadAudio: vi.fn(),
}))

vi.mock('@/lib/ai/elevenlabs', () => ({
  transcribeAudioWithElevenLabs: vi.fn(),
}))
vi.mock('@/lib/ai/text-analysis', () => ({ analyseTranscript: vi.fn() }))

beforeEach(resetDatabase)

describe('spots', () => {
  it('makes readable slugs from names', () => {
    expect(slugify('Lekki Branch – Table 4')).toBe('lekki-branch-table-4')
    expect(slugify('Café Rooftop!')).toBe('cafe-rooftop')
    expect(slugify('🍕🍕')).toBe('spot')
    // Cut at 40 characters without leaving a trailing hyphen.
    expect(slugify(`${'a'.repeat(39)} bc`)).toBe('a'.repeat(39))
  })

  it('never reuses a slug, even from an archived spot', async () => {
    const owner = await createBusiness()
    const first = await createSpot(owner.id, 'Table 4')
    await archiveSpot(owner.id, first.id)
    const second = await createSpot(owner.id, ' Table   4 ')

    expect(second).toMatchObject({ name: 'Table 4', slug: 'table-4-2' })
    expect(await listSpots(owner.id)).toEqual([second])
    // Another business can use the same slug.
    expect(
      (await createSpot((await createBusiness()).id, 'Table 4')).slug,
    ).toBe('table-4')
  })

  it('refuses empty names, long names and too many spots', async () => {
    const owner = await createBusiness()
    await expect(createSpot(owner.id, '   ')).rejects.toBeInstanceOf(SpotError)
    await expect(createSpot(owner.id, 'x'.repeat(61))).rejects.toBeInstanceOf(
      SpotError,
    )
    for (let i = 0; i < MAX_SPOTS; i++) await createSpot(owner.id, `Table ${i}`)
    await expect(createSpot(owner.id, 'One more')).rejects.toThrow(
      `up to ${MAX_SPOTS}`,
    )
  })

  it('refuses a second active spot with the same name', async () => {
    const owner = await createBusiness()
    await createSpot(owner.id, 'Patio')
    await expect(createSpot(owner.id, 'patio')).rejects.toThrow(
      'already have a spot called patio',
    )
  })

  it("can't archive another owner's spot", async () => {
    const owner = await createBusiness()
    const spot = await createSpot(owner.id, 'Patio')
    expect(await archiveSpot((await createBusiness()).id, spot.id)).toBe(false)
    expect(await listSpots(owner.id)).toHaveLength(1)
  })

  it('tags feedback with the spot from the QR link, and ignores unknown or archived ones', async () => {
    const owner = await createBusiness()
    const patio = await createSpot(owner.id, 'Patio')
    const old = await createSpot(owner.id, 'Old bar')
    await archiveSpot(owner.id, old.id)
    const other = await createBusiness()
    const otherSpot = await createSpot(other.id, 'Rooftop')

    const submit = async (spot: string | null) => {
      const { feedbackId } = await submitFeedback({
        code: owner.uniqueCode!,
        audio: new Blob([new Uint8Array(1024)], { type: 'audio/webm' }),
        durationSeconds: 5,
        customerName: null,
        spot,
      })
      const [row] = await db
        .select({ spotId: feedback.spotId })
        .from(feedback)
        .where(eq(feedback.id, feedbackId))
      return row.spotId
    }

    expect(await submit('patio')).toBe(patio.id)
    expect(await submit('old-bar')).toBeNull()
    expect(await submit(otherSpot.slug)).toBeNull()
    expect(await submit('nope')).toBeNull()
    expect(await submit(null)).toBeNull()
    expect(await findSpot(owner.id, 'patio')).toEqual(patio)
  })
})
