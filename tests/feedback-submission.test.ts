import { eq, sql } from 'drizzle-orm'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createBusiness, pulsesOf, resetDatabase } from './support/db'
import { db } from '@/db/index'
import { feedback } from '@/db/schema'
import {
  MAX_ANALYSIS_RETRIES,
  MAX_AUDIO_BYTES,
  SubmissionError,
  analyseFeedback,
  claimPulse,
  processFeedback,
  retryAnalysis,
  submitFeedback,
} from '@/server/feedback-submission'

const storage = vi.hoisted(() => ({
  uploadAudio: vi.fn(),
  deleteAudio: vi.fn(),
  downloadAudio: vi.fn(),
}))
vi.mock('@/lib/storage/r2', () => ({ ...storage, AUDIO_KEY_PREFIX: 'test/' }))

const ai = vi.hoisted(() => ({
  transcribe: vi.fn(),
  analyse: vi.fn(),
}))
vi.mock('@/lib/ai/elevenlabs', () => ({
  transcribeAudioWithElevenLabs: ai.transcribe,
}))
vi.mock('@/lib/ai/text-analysis', () => ({
  analyseTranscript: ai.analyse,
}))

const emails = vi.hoisted(() => ({ received: vi.fn(), low: vi.fn() }))
vi.mock('@/lib/email/feedback-received', () => ({
  sendFeedbackReceivedEmail: emails.received,
}))
vi.mock('@/lib/email/low-pulse', () => ({ sendLowPulseEmail: emails.low }))

const recording = (type = 'audio/mp4', bytes = 1024) =>
  new Blob([new Uint8Array(bytes)], { type })

beforeEach(async () => {
  await resetDatabase()
  vi.clearAllMocks()
  storage.uploadAudio.mockResolvedValue(undefined)
  storage.deleteAudio.mockResolvedValue(undefined)
  ai.transcribe.mockResolvedValue('Hi, I am Sam. The coffee was great.')
  ai.analyse.mockResolvedValue({
    sentiment: 'positive',
    customerName: 'Sam',
    language: 'English',
    englishTranslation: null,
    summary: 'Sam loved the coffee.',
    themes: ['food quality'],
  })
  emails.received.mockResolvedValue(undefined)
  emails.low.mockResolvedValue(undefined)
})

describe('claimPulse', () => {
  it('refuses a business with no pulses left', async () => {
    const owner = await createBusiness({ pulsesRemaining: 0 })
    expect(await claimPulse(owner.uniqueCode!)).toBeNull()
    expect(await pulsesOf(owner.id)).toBe(0)
  })

  it('never spends more pulses than the business has, even all at once', async () => {
    const owner = await createBusiness({ pulsesRemaining: 3 })
    const claims = await Promise.all(
      Array.from({ length: 12 }, () => claimPulse(owner.uniqueCode!)),
    )
    expect(claims.filter(Boolean)).toHaveLength(3)
    expect(await pulsesOf(owner.id)).toBe(0)
  })

  it('refuses an unknown code', async () => {
    expect(await claimPulse('no-such-business')).toBeNull()
  })
})

describe('submitFeedback', () => {
  it('stores the recording under a server-made id and spends one pulse', async () => {
    const owner = await createBusiness({ pulsesRemaining: 5 })
    const { feedbackId } = await submitFeedback({
      code: owner.uniqueCode!,
      audio: recording('audio/mp4;codecs=mp4a.40.2'),
      durationSeconds: 14.6,
      customerName: 'Ada',
    })

    expect(await pulsesOf(owner.id)).toBe(4)
    const [row] = await db
      .select()
      .from(feedback)
      .where(eq(feedback.id, feedbackId))
    expect(row).toMatchObject({
      userId: owner.id,
      customerName: 'Ada',
      duration: 15,
      status: 'processing',
    })
    expect(row.audioKey).toBe(`test/feedback/${owner.id}/${feedbackId}.m4a`)
    expect(storage.uploadAudio).toHaveBeenCalledWith(
      row.audioKey,
      expect.any(Buffer),
      'audio/mp4',
    )
  })

  it('caps the stored duration at two minutes', async () => {
    const owner = await createBusiness()
    const { feedbackId } = await submitFeedback({
      code: owner.uniqueCode!,
      audio: recording(),
      durationSeconds: 9999,
      customerName: null,
    })
    const [row] = await db
      .select()
      .from(feedback)
      .where(eq(feedback.id, feedbackId))
    expect(row.duration).toBe(120)
  })

  it.each([
    ['an unsupported type', recording('video/quicktime'), 415],
    ['an empty file', recording('audio/webm', 0), 400],
    ['an oversized file', recording('audio/webm', MAX_AUDIO_BYTES + 1), 413],
  ])('rejects %s without spending a pulse', async (_, audio, status) => {
    const owner = await createBusiness({ pulsesRemaining: 5 })
    const error = await submitFeedback({
      code: owner.uniqueCode!,
      audio,
      durationSeconds: 5,
      customerName: null,
    }).catch((e: unknown) => e)
    expect(error).toBeInstanceOf(SubmissionError)
    expect((error as SubmissionError).status).toBe(status)
    expect(await pulsesOf(owner.id)).toBe(5)
  })

  it('refuses with 402 when the business is out of pulses', async () => {
    const owner = await createBusiness({ pulsesRemaining: 0 })
    const error = await submitFeedback({
      code: owner.uniqueCode!,
      audio: recording(),
      durationSeconds: 5,
      customerName: null,
    }).catch((e: unknown) => e)
    expect((error as SubmissionError).status).toBe(402)
    expect(storage.uploadAudio).not.toHaveBeenCalled()
  })

  it('gives the pulse back and stores nothing if the upload fails', async () => {
    const owner = await createBusiness({ pulsesRemaining: 5 })
    storage.uploadAudio.mockRejectedValueOnce(new Error('R2 down'))
    await expect(
      submitFeedback({
        code: owner.uniqueCode!,
        audio: recording(),
        durationSeconds: 5,
        customerName: null,
      }),
    ).rejects.toThrow('R2 down')
    expect(await pulsesOf(owner.id)).toBe(5)
    expect(await db.select().from(feedback)).toHaveLength(0)
  })
})

describe('processing', () => {
  const submitted = async (pulses = 5) => {
    const owner = await createBusiness({ pulsesRemaining: pulses })
    const { feedbackId, business } = await submitFeedback({
      code: owner.uniqueCode!,
      audio: recording(),
      durationSeconds: 8,
      customerName: null,
    })
    return { owner, feedbackId, business }
  }
  const audio = { buffer: Buffer.from('x'), type: 'audio/mp4' }

  it('saves the transcript and its analysis, then emails the owner', async () => {
    const { owner, feedbackId, business } = await submitted()
    await processFeedback(feedbackId, business, audio)

    const [row] = await db
      .select()
      .from(feedback)
      .where(eq(feedback.id, feedbackId))
    expect(row).toMatchObject({
      transcript: 'Hi, I am Sam. The coffee was great.',
      sentiment: 'positive',
      customerName: 'Sam',
      summary: 'Sam loved the coffee.',
      themes: ['food quality'],
      translation: null,
      status: 'ready',
    })
    expect(emails.received).toHaveBeenCalledWith(
      expect.objectContaining({
        to: owner.email,
        sentiment: 'positive',
        summary: 'Sam loved the coffee.',
        language: null,
      }),
    )
  })

  it('emails the English translation of feedback in another language', async () => {
    const { feedbackId, business } = await submitted()
    ai.transcribe.mockResolvedValueOnce('Le service était trop lent.')
    ai.analyse.mockResolvedValueOnce({
      sentiment: 'negative',
      customerName: null,
      language: 'French',
      englishTranslation: 'The service was too slow.',
      summary: 'Service was too slow.',
      themes: ['wait time'],
    })
    await processFeedback(feedbackId, business, audio)

    const [row] = await db
      .select()
      .from(feedback)
      .where(eq(feedback.id, feedbackId))
    expect(row).toMatchObject({
      transcript: 'Le service était trop lent.',
      language: 'French',
      translation: 'The service was too slow.',
    })
    expect(emails.received).toHaveBeenCalledWith(
      expect.objectContaining({
        sentiment: 'negative',
        transcript: 'The service was too slow.',
        language: 'French',
      }),
    )
  })

  it('keeps the transcript when analysis fails', async () => {
    const { feedbackId } = await submitted()
    ai.analyse.mockRejectedValueOnce(new Error('LLM down'))
    const saved = await analyseFeedback(feedbackId, audio)
    expect(saved).toMatchObject({
      transcript: 'Hi, I am Sam. The coffee was great.',
      sentiment: null,
      summary: null,
      translation: null,
      language: null,
      themes: [],
      status: 'ready',
    })
  })

  it('keeps a translation of Pidgin, which speech-to-text hears as English', async () => {
    const { feedbackId } = await submitted()
    ai.transcribe.mockResolvedValueOnce(
      'Abeg, una food sweet but the place hot.',
    )
    ai.analyse.mockResolvedValueOnce({
      sentiment: 'negative',
      customerName: null,
      language: 'Nigerian Pidgin',
      englishTranslation: 'Please, your food is tasty but the place is hot.',
      summary: 'Food is good but the room is too hot.',
      themes: ['atmosphere'],
    })
    const saved = await analyseFeedback(feedbackId, audio)
    expect(saved).toMatchObject({
      language: 'Nigerian Pidgin',
      translation: 'Please, your food is tasty but the place is hot.',
    })
  })

  it("keeps an English speaker's own words, and tidies the themes", async () => {
    const { feedbackId } = await submitted()
    ai.analyse.mockResolvedValueOnce({
      sentiment: 'positive',
      customerName: 'Sam',
      language: 'English (US)',
      englishTranslation: 'I am Sam; the coffee was great.',
      summary: 'Sam loved the coffee.',
      themes: [
        'Service',
        'service ',
        'price',
        'food quality',
        'atmosphere',
        'wait time',
      ],
    })
    const saved = await analyseFeedback(feedbackId, audio)
    expect(saved).toMatchObject({
      translation: null,
      themes: ['service', 'price', 'food quality', 'atmosphere'],
    })
  })

  it('marks the feedback failed when transcription fails, and still emails', async () => {
    const { feedbackId, business } = await submitted()
    ai.transcribe.mockRejectedValueOnce(new Error('ElevenLabs down'))
    await processFeedback(feedbackId, business, audio)
    const [row] = await db
      .select()
      .from(feedback)
      .where(eq(feedback.id, feedbackId))
    expect(row.status).toBe('failed')
    expect(emails.received).toHaveBeenCalled()
  })

  it('sends a low-balance email only when the balance first reaches 9, 4 or 0', async () => {
    for (const [start, shouldEmail] of [
      [10, true],
      [9, false],
      [5, true],
      [2, false],
      [1, true],
    ] as const) {
      emails.low.mockClear()
      const { feedbackId, business } = await submitted(start)
      await processFeedback(feedbackId, business, audio)
      expect(emails.low.mock.calls.length > 0).toBe(shouldEmail)
    }
  })

  it('retries a failed recording once, even if asked twice at the same time', async () => {
    const { feedbackId } = await submitted()
    await db
      .update(feedback)
      .set({ status: 'failed' })
      .where(eq(feedback.id, feedbackId))
    storage.downloadAudio.mockResolvedValue(audio)

    await Promise.all([retryAnalysis(feedbackId), retryAnalysis(feedbackId)])
    expect(ai.transcribe).toHaveBeenCalledTimes(1)
    const [row] = await db
      .select()
      .from(feedback)
      .where(eq(feedback.id, feedbackId))
    expect(row.status).toBe('ready')
  })

  it('takes over a run stuck in processing for over 10 minutes', async () => {
    const { feedbackId } = await submitted()
    storage.downloadAudio.mockResolvedValue(audio)

    await retryAnalysis(feedbackId)
    expect(ai.transcribe).not.toHaveBeenCalled()

    await db.execute(
      sql`update feedback set analysis_started_at = now() - interval '11 minutes' where id = ${feedbackId}`,
    )
    await retryAnalysis(feedbackId)
    const [row] = await db
      .select()
      .from(feedback)
      .where(eq(feedback.id, feedbackId))
    expect(row.status).toBe('ready')
  })

  it('stops retrying after three failed attempts', async () => {
    const { feedbackId } = await submitted()
    await db
      .update(feedback)
      .set({ status: 'failed' })
      .where(eq(feedback.id, feedbackId))
    storage.downloadAudio.mockResolvedValue(audio)
    ai.transcribe.mockRejectedValue(new Error('ElevenLabs down'))

    for (let i = 0; i < 5; i++) await retryAnalysis(feedbackId)
    expect(ai.transcribe).toHaveBeenCalledTimes(MAX_ANALYSIS_RETRIES)
    const [row] = await db
      .select()
      .from(feedback)
      .where(eq(feedback.id, feedbackId))
    expect(row.status).toBe('failed')
  })

  it('marks a recording failed when its last allowed run died', async () => {
    const { feedbackId } = await submitted()
    await db.execute(
      sql`update feedback set analysis_attempts = ${MAX_ANALYSIS_RETRIES},
        analysis_started_at = now() - interval '11 minutes' where id = ${feedbackId}`,
    )
    await retryAnalysis(feedbackId)
    expect(ai.transcribe).not.toHaveBeenCalled()
    const [row] = await db
      .select()
      .from(feedback)
      .where(eq(feedback.id, feedbackId))
    expect(row.status).toBe('failed')
  })

  it('does not retry a recording that already has a transcript', async () => {
    const { feedbackId } = await submitted()
    await db
      .update(feedback)
      .set({ transcript: 'done', status: 'ready' })
      .where(eq(feedback.id, feedbackId))
    await retryAnalysis(feedbackId)
    expect(storage.downloadAudio).not.toHaveBeenCalled()
  })
})
