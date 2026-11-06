import { eq, sql } from 'drizzle-orm'

import { db } from '@/db/index'
import { feedback } from '@/db/schema'
import { transcribeAudioWithElevenLabs } from '@/lib/ai/elevenlabs'
import {
  analyzeSentiment,
  extractNameFromTranscript,
} from '@/lib/ai/text-analysis'
import { sendFeedbackReceivedEmail } from '@/lib/email/feedback-received'
import { sendLowPulseEmail } from '@/lib/email/low-pulse'
import {
  AUDIO_KEY_PREFIX,
  deleteAudio,
  downloadAudio,
  uploadAudio,
} from '@/lib/storage/r2'

export const MAX_RECORDING_SECONDS = 120
// Two minutes of browser audio is well under 3 MB; this leaves headroom for
// high-bitrate recorders while capping what one request can store.
export const MAX_AUDIO_BYTES = 8 * 1024 * 1024

// Browsers record in one of these containers. Anything else is rejected.
const AUDIO_EXTENSIONS: Record<string, string> = {
  'audio/webm': 'webm',
  'audio/mp4': 'm4a',
  'audio/aac': 'aac',
  'audio/ogg': 'ogg',
  'audio/mpeg': 'mp3',
  'audio/wav': 'wav',
}

// Owners get a low-balance email when the balance first drops to one of these.
const LOW_BALANCE_THRESHOLDS = [9, 4, 0]

export class SubmissionError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message)
  }
}

export const normaliseAudioType = (type: string): string | null => {
  const base = type.split(';')[0].trim().toLowerCase()
  return base in AUDIO_EXTENSIONS ? base : null
}

type Business = {
  id: string
  email: string
  businessName: string | null
  pulsesRemaining: number
}

/**
 * Takes one pulse from the business, or returns null if it has none left. One
 * statement, so two submissions can't both spend the last pulse.
 */
export const claimPulse = async (code: string): Promise<Business | null> => {
  const result = await db.execute<{
    id: string
    email: string
    business_name: string | null
    pulses_remaining: number
  }>(sql`
    update users set pulses_remaining = pulses_remaining - 1, updated_at = now()
    where unique_code = ${code} and pulses_remaining > 0
    returning id, email, business_name, pulses_remaining
  `)
  const row = result.rows.at(0)
  return row
    ? {
        id: row.id,
        email: row.email,
        businessName: row.business_name,
        pulsesRemaining: row.pulses_remaining,
      }
    : null
}

const returnPulse = (userId: string) =>
  db.execute(sql`
    update users set pulses_remaining = pulses_remaining + 1, updated_at = now()
    where id = ${userId}
  `)

export type SubmissionInput = {
  code: string
  audio: Blob
  durationSeconds: number
  customerName: string | null
}

/**
 * Stores a recording and its feedback row, spending one pulse. Transcription
 * runs afterwards in `processFeedback`; the row stays 'processing' until then.
 */
export const submitFeedback = async (
  input: SubmissionInput,
): Promise<{ feedbackId: string; business: Business }> => {
  const audioType = normaliseAudioType(input.audio.type)
  if (!audioType) throw new SubmissionError('Unsupported audio format', 415)
  if (input.audio.size === 0) throw new SubmissionError('Empty recording', 400)
  if (input.audio.size > MAX_AUDIO_BYTES) {
    throw new SubmissionError('Recording is too large', 413)
  }

  const business = await claimPulse(input.code)
  if (!business) {
    throw new SubmissionError('This business is not accepting feedback', 402)
  }

  const feedbackId = crypto.randomUUID()
  const audioKey = `${AUDIO_KEY_PREFIX}feedback/${business.id}/${feedbackId}.${AUDIO_EXTENSIONS[audioType]}`

  try {
    await uploadAudio(
      audioKey,
      Buffer.from(await input.audio.arrayBuffer()),
      audioType,
    )
    await db.insert(feedback).values({
      id: feedbackId,
      userId: business.id,
      customerName: input.customerName,
      audioKey,
      duration: Math.min(
        MAX_RECORDING_SECONDS,
        Math.max(0, Math.round(input.durationSeconds)),
      ),
      status: 'processing',
    })
  } catch (error) {
    await returnPulse(business.id)
    await deleteAudio(audioKey).catch(() => undefined)
    throw error
  }

  return { feedbackId, business }
}

/**
 * Transcribes and analyses a stored recording. Each step that fails leaves
 * what already succeeded saved: a transcript is kept even if sentiment or name
 * extraction fails. Returns the saved row, or null if it no longer exists.
 */
export const analyseFeedback = async (
  feedbackId: string,
  audio: { buffer: Buffer; type: string },
) => {
  const rows = await db
    .select()
    .from(feedback)
    .where(eq(feedback.id, feedbackId))
    .limit(1)
  const row = rows.at(0)
  if (!row) return null

  let transcript: string | null = null
  try {
    transcript =
      (await transcribeAudioWithElevenLabs(audio.buffer, audio.type)).trim() ||
      null
  } catch (error) {
    console.error('[feedback] transcription failed', { feedbackId, error })
  }

  const sentiment = transcript ? await analyzeSentiment(transcript) : null
  let customerName = row.customerName
  if (transcript && !customerName) {
    customerName = await extractNameFromTranscript(transcript).catch(() => null)
  }

  const [saved] = await db
    .update(feedback)
    .set({
      transcript,
      sentiment,
      customerName,
      status: transcript ? 'ready' : 'failed',
    })
    .where(eq(feedback.id, feedbackId))
    .returning()
  return saved
}

/** Analyses a new submission, then emails the owner. */
export const processFeedback = async (
  feedbackId: string,
  business: Business,
  audio: { buffer: Buffer; type: string },
): Promise<void> => {
  const saved = await analyseFeedback(feedbackId, audio)
  if (!saved) return

  const ownerName = business.businessName || business.email.split('@')[0]
  await sendFeedbackReceivedEmail({
    to: business.email,
    businessName: ownerName,
    feedbackId,
    customerName: saved.customerName,
    duration: saved.duration,
    sentiment: saved.sentiment,
    transcript: saved.transcript,
  }).catch((error) =>
    console.error('[feedback] notification email failed', {
      feedbackId,
      error,
    }),
  )

  if (LOW_BALANCE_THRESHOLDS.includes(business.pulsesRemaining)) {
    await sendLowPulseEmail({
      to: business.email,
      userName: ownerName,
      pulsesRemaining: business.pulsesRemaining,
    }).catch((error) =>
      console.error('[feedback] low balance email failed', { error }),
    )
  }
}

export const MAX_ANALYSIS_RETRIES = 3
const STUCK_AFTER = sql`interval '10 minutes'`

/**
 * Re-runs analysis for a recording with no transcript: one that failed, one
 * stuck in 'processing' for over 10 minutes, or one that predates background
 * processing. Claiming the row and counting the attempt happen in one
 * statement, so page reloads can't start two runs, and retries stop after
 * MAX_ANALYSIS_RETRIES.
 */
export const retryAnalysis = async (feedbackId: string): Promise<void> => {
  // A last run that died leaves the row 'processing' with no retries left.
  await db.execute(sql`
    update feedback set status = 'failed'
    where id = ${feedbackId} and status = 'processing'
      and analysis_attempts >= ${MAX_ANALYSIS_RETRIES}
      and analysis_started_at < now() - ${STUCK_AFTER}
  `)
  const claimed = await db.execute<{ audio_key: string }>(sql`
    update feedback set
      status = 'processing',
      analysis_attempts = analysis_attempts + 1,
      analysis_started_at = now()
    where id = ${feedbackId} and transcript is null
      and audio_key is not null
      and analysis_attempts < ${MAX_ANALYSIS_RETRIES}
      and (status <> 'processing' or analysis_started_at < now() - ${STUCK_AFTER})
    returning audio_key
  `)
  const audioKey = claimed.rows[0]?.audio_key
  if (!audioKey) return

  try {
    await analyseFeedback(feedbackId, await downloadAudio(audioKey))
  } catch (error) {
    console.error('[feedback] retry failed', { feedbackId, error })
    await db
      .update(feedback)
      .set({ status: 'failed' })
      .where(eq(feedback.id, feedbackId))
  }
}
