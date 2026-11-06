import { eq, sql } from 'drizzle-orm'

import { db } from '@/db/index'
import { feedback } from '@/db/schema'
import { transcribeAudioWithElevenLabs } from '@/lib/ai/elevenlabs'
import { analyseTranscript } from '@/lib/ai/text-analysis'
import { sendFeedbackReceivedEmail } from '@/lib/email/feedback-received'
import { sendLowPulseEmail } from '@/lib/email/low-pulse'
import { findSpot } from '@/server/spots'
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
  /** The spot slug from the QR link, if any. */
  spot?: string | null
}

export const MIN_TYPED_LENGTH = 3
export const MAX_TYPED_LENGTH = 2000

/**
 * Stores typed feedback, spending one pulse. The text is saved straight away;
 * analysis runs afterwards in `processFeedback`.
 */
export const submitTypedFeedback = async (input: {
  code: string
  text: string
  customerName: string | null
  spot?: string | null
}): Promise<{ feedbackId: string; business: Business }> => {
  const text = input.text.trim()
  if (text.length < MIN_TYPED_LENGTH) {
    throw new SubmissionError('Write a little more first', 400)
  }
  if (text.length > MAX_TYPED_LENGTH) {
    throw new SubmissionError(
      `Keep it under ${MAX_TYPED_LENGTH} characters`,
      413,
    )
  }

  const business = await claimPulse(input.code)
  if (!business) {
    throw new SubmissionError('This business is not accepting feedback', 402)
  }

  const feedbackId = crypto.randomUUID()
  try {
    const spot = await findSpot(business.id, input.spot)
    await db.insert(feedback).values({
      id: feedbackId,
      userId: business.id,
      spotId: spot?.id ?? null,
      customerName: input.customerName,
      source: 'text',
      transcript: text,
      status: 'processing',
    })
  } catch (error) {
    await returnPulse(business.id)
    throw error
  }
  return { feedbackId, business }
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
    const spot = await findSpot(business.id, input.spot)
    await db.insert(feedback).values({
      id: feedbackId,
      userId: business.id,
      spotId: spot?.id ?? null,
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

/** A recording to transcribe, or feedback the customer typed (already stored). */
export type FeedbackSource =
  | { audio: { buffer: Buffer; type: string } }
  | { typed: true }

/**
 * Transcribes a recording, or takes the typed text, and analyses it. A
 * transcript is kept even if analysis fails, so the owner can still read it.
 * Returns the saved row, or null if it no longer exists.
 */
export const analyseFeedback = async (
  feedbackId: string,
  source: FeedbackSource,
) => {
  const rows = await db
    .select()
    .from(feedback)
    .where(eq(feedback.id, feedbackId))
    .limit(1)
  const row = rows.at(0)
  if (!row) return null

  let transcript: string | null = null
  if ('typed' in source) {
    transcript = row.transcript
  } else {
    try {
      transcript =
        (await transcribeAudioWithElevenLabs(
          source.audio.buffer,
          source.audio.type,
        )) || null
    } catch (error) {
      console.error('[feedback] transcription failed', { feedbackId, error })
    }
  }

  const analysis = transcript
    ? await analyseTranscript(transcript).catch((error: unknown) => {
        console.error('[feedback] analysis failed', { feedbackId, error })
        return null
      })
    : null

  // Keep the customer's own words when they spoke English, even if the model
  // returned a cleaned-up "translation". The model decides, not speech-to-text,
  // which hears English-based creoles such as Pidgin as English.
  const translation = analysis?.language
    .trim()
    .toLowerCase()
    .startsWith('english')
    ? null
    : (analysis?.englishTranslation ?? null)
  const themes = [
    ...new Set(analysis?.themes.map((theme) => theme.trim().toLowerCase())),
  ]
    .filter(Boolean)
    .slice(0, 4)

  const [saved] = await db
    .update(feedback)
    .set({
      transcript,
      sentiment: analysis?.sentiment ?? null,
      customerName: row.customerName ?? analysis?.customerName ?? null,
      language: analysis?.language ?? null,
      translation,
      summary: analysis?.summary ?? null,
      themes,
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
  source: FeedbackSource,
): Promise<void> => {
  const saved = await analyseFeedback(feedbackId, source)
  if (!saved) return

  const ownerName = business.businessName || business.email.split('@')[0]
  await sendFeedbackReceivedEmail({
    to: business.email,
    businessName: ownerName,
    feedbackId,
    customerName: saved.customerName,
    duration: saved.duration,
    typed: saved.source === 'text',
    sentiment: saved.sentiment,
    transcript: saved.translation ?? saved.transcript,
    summary: saved.summary,
    language: saved.translation ? saved.language : null,
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
 * Re-runs analysis for feedback that isn't 'ready': a recording that failed,
 * or any submission stuck in 'processing' for over 10 minutes (for example a
 * run killed by a redeploy). Claiming the row and counting the attempt happen in one
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
  const claimed = await db.execute<{ audio_key: string | null }>(sql`
    update feedback set
      status = 'processing',
      analysis_attempts = analysis_attempts + 1,
      analysis_started_at = now()
    where id = ${feedbackId}
      -- Not analysed yet, or a recording from before statuses existed that
      -- never got a transcript.
      and (status <> 'ready' or (transcript is null and audio_key is not null))
      and (audio_key is not null or transcript is not null)
      and analysis_attempts < ${MAX_ANALYSIS_RETRIES}
      and (status <> 'processing' or analysis_started_at < now() - ${STUCK_AFTER})
    returning audio_key
  `)
  const claim = claimed.rows.at(0)
  if (!claim) return

  try {
    await analyseFeedback(
      feedbackId,
      claim.audio_key
        ? { audio: await downloadAudio(claim.audio_key) }
        : { typed: true },
    )
  } catch (error) {
    console.error('[feedback] retry failed', { feedbackId, error })
    await db
      .update(feedback)
      .set({ status: 'failed' })
      .where(eq(feedback.id, feedbackId))
  }
}
