import { randomUUID } from 'node:crypto'

import { createServerFn } from '@tanstack/react-start'
import { eq } from 'drizzle-orm'

import { db } from '@/db/index'
import { feedback, users } from '@/db/schema'
import {
  analyzeSentiment,
  extractNameFromTranscript,
  transcribeAudioChunk,
} from '@/lib/ai/gemini'
import {
  generateFeedbackAudioKey,
  getAudioUrl,
  uploadAudioChunk,
} from '@/lib/storage/r2'

interface SubmitFeedbackInput {
  businessId: string // uniqueCode
  customerName?: string
  audioData: string // Base64 encoded audio data
  audioMimeType: string // MIME type of the audio (e.g., 'audio/webm')
  duration: number
}

/**
 * Submit feedback - Server Function
 * This is tied to the feedback form submission, so server function makes sense
 */
export const submitFeedback = createServerFn({
  method: 'POST',
})
  .inputValidator((data: SubmitFeedbackInput) => data)
  .handler(async ({ data }) => {
    // Find user by unique code
    const user = await db
      .select()
      .from(users)
      .where(eq(users.uniqueCode, data.businessId))
      .limit(1)

    if (user.length === 0) {
      throw new Error('Business not found')
    }

    // Check if user has pulses remaining
    if (user[0].pulsesRemaining <= 0) {
      throw new Error('No pulses remaining. Please purchase more pulses.')
    }

    // Generate feedback ID for unique key
    const feedbackId = randomUUID()

    // Convert base64 to buffer
    const audioBuffer = Buffer.from(data.audioData, 'base64')

    // Upload audio to R2 with user-id based key
    const audioKey = generateFeedbackAudioKey(user[0].id, feedbackId)
    await uploadAudioChunk(audioKey, audioBuffer, data.audioMimeType)

    // Get presigned URL for the audio
    const audioUrl = await getAudioUrl(audioKey)

    // Transcribe audio using Files API (writes to /tmp)
    const transcript = await transcribeAudioChunk(
      audioBuffer,
      data.audioMimeType,
    )

    // Analyze sentiment from transcript
    const sentiment = await analyzeSentiment(transcript)

    // Extract name from transcript if not provided
    let customerName = data.customerName || null
    if (!customerName && transcript) {
      const extractedName = await extractNameFromTranscript(transcript)
      customerName = extractedName
    }

    // Create feedback record
    await db.insert(feedback).values({
      userId: user[0].id,
      customerName,
      audioUrl,
      audioKey, // Store R2 key for regenerating URLs
      transcript,
      sentiment,
      duration: data.duration,
    })

    // Deduct one pulse (only if user has pulses remaining)
    const currentPulses = Math.max(0, user[0].pulsesRemaining)
    const newPulseBalance = currentPulses > 0 ? currentPulses - 1 : 0
    await db
      .update(users)
      .set({
        pulsesRemaining: newPulseBalance,
        updatedAt: new Date(),
      })
      .where(eq(users.id, user[0].id))

    return { success: true }
  })
