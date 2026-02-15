import { Elysia, t } from 'elysia'
import { Checkout, Webhooks } from '@polar-sh/elysia'
import { Polar } from '@polar-sh/sdk'

import { and, avg, count, desc, eq, gte, sql } from 'drizzle-orm'

import type {
  ResendEmailReceivedEvent,
  ResendWebhookEvent,
} from '@/types/resend'
import { db } from '@/db/index'
import { feedback, otpCodes, pulsePurchases, users } from '@/db/schema'
import { env } from '@/env'
import { analyzeSentiment, extractNameFromTranscript } from '@/lib/ai/gemini'
import { transcribeAudioWithElevenLabs } from '@/lib/ai/elevenlabs'
import { sendOTPEmail } from '@/lib/email'
import { sendLowPulseEmail } from '@/lib/email/low-pulse'
import { generateOTP } from '@/lib/otp'
import {
  downloadAndCombineChunks,
  generateFeedbackAudioKey,
  getAudioUrl,
  uploadAudioChunk,
} from '@/lib/storage/r2'
import { getUserFromSession } from '@/lib/auth-helpers'
import { getResendClient } from '@/lib/utils/resend'

const app = new Elysia({ prefix: '/api' })
  .get('/', 'Hello Elysia!')
  // Auth routes
  .post(
    '/auth/send-otp',
    async ({ body }) => {
      console.log('[API] /auth/send-otp called', { body })
      const { email } = body
      console.log('[API] Email received:', email)

      // Generate 6-digit OTP
      const code = generateOTP()
      console.log('[API] Generated OTP:', code)
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000) // 10 minutes

      // Save OTP to database
      console.log('[API] Saving OTP to database...')
      try {
        await db.insert(otpCodes).values({
          email: email.toLowerCase(),
          code,
          expiresAt,
        })
        console.log('[API] OTP saved to database successfully')
      } catch (dbError) {
        console.error('[API] Error saving OTP to database:', dbError)
        return {
          success: false,
          error: 'Failed to save OTP. Please try again.',
        }
      }

      // Send OTP email
      console.log('[API] Sending OTP email...')
      try {
        await sendOTPEmail({
          to: email,
          otpCode: code,
        })
        console.log('[API] OTP email sent successfully')
      } catch (error) {
        console.error('[API] Failed to send OTP email:', error)
        return {
          success: false,
          error: 'Failed to send email. Please try again.',
        }
      }

      console.log('[API] /auth/send-otp completed successfully')
      return { success: true, message: 'OTP sent to your email' }
    },
    {
      body: t.Object({
        email: t.String({ format: 'email' }),
      }),
    },
  )
  // Streaming audio feedback route
  .post(
    '/feedback/stream-chunk',
    async ({ body }) => {
      const {
        businessId,
        feedbackId,
        chunkIndex,
        audioData,
        mimeType,
        isLastChunk,
        customerName,
        duration,
        transcript: providedTranscript,
        sentiment: providedSentiment,
        finalAudioData,
        finalAudioMimeType,
      } = body

      const normalizeMimeType = (
        value?: string,
        fallback: string = 'audio/ogg',
      ) => (value || fallback).split(';')[0].trim().toLowerCase()

      const extensionFromMimeType = (value: string) => {
        const extensionMap: Record<string, string> = {
          'audio/mpeg': 'mp3',
          'audio/mp3': 'mp3',
          'audio/mp4': 'mp4',
          'audio/aac': 'aac',
          'audio/ogg': 'ogg',
          'audio/webm': 'webm',
          'audio/wav': 'wav',
          'audio/flac': 'flac',
        }

        return extensionMap[value] || value.split('/')[1] || 'ogg'
      }

      const normalizeSentiment = (value?: string) =>
        value === 'positive' || value === 'neutral' || value === 'negative'
          ? value
          : null

      try {
        console.log(
          `[API] Received stream chunk ${chunkIndex}${isLastChunk ? ' (LAST)' : ''}`,
          {
            feedbackId,
            businessId,
            chunkIndex,
            audioDataLength: audioData.length,
            mimeType,
            isLastChunk,
            customerName: customerName || 'Not provided',
            duration: duration || 'Not provided',
          },
        )

        // Find user by unique code
        console.log(`[API] Looking up user by uniqueCode: ${businessId}`)
        const user = await db
          .select()
          .from(users)
          .where(eq(users.uniqueCode, businessId))
          .limit(1)

        if (user.length === 0) {
          console.error(
            `[API] Business not found for uniqueCode: ${businessId}`,
          )
          throw new Error('Business not found')
        }

        console.log(
          `[API] Found user: ${user[0].id}, pulses remaining: ${user[0].pulsesRemaining}`,
        )

        // Check if user has pulses remaining (only on first chunk)
        if (chunkIndex === 0 && user[0].pulsesRemaining <= 0) {
          console.error(`[API] No pulses remaining for user ${user[0].id}`)
          throw new Error('No pulses remaining. Please purchase more pulses.')
        }

        const uploadStartTime = Date.now()
        const shouldUploadChunk = !isLastChunk || !finalAudioData

        if (shouldUploadChunk) {
          // Convert base64 to buffer
          console.log(
            `[API] Converting base64 audio to buffer for chunk ${chunkIndex}...`,
          )
          const audioBuffer = Buffer.from(audioData, 'base64')
          console.log(`[API] Buffer created, size: ${audioBuffer.length} bytes`)

          // Upload chunk to R2
          const chunkKey = generateFeedbackAudioKey(
            user[0].id,
            feedbackId,
            chunkIndex,
          )
          console.log(`[API] Uploading chunk ${chunkIndex} to S3 (R2)...`, {
            chunkKey,
          })
          await uploadAudioChunk(chunkKey, audioBuffer, mimeType)
          const uploadDuration = Date.now() - uploadStartTime
          console.log(
            `[API] Chunk ${chunkIndex} uploaded to S3 successfully in ${uploadDuration}ms`,
            {
              chunkKey,
              size: audioBuffer.length,
            },
          )
        } else {
          console.log(
            `[API] Skipping chunk upload for final chunk ${chunkIndex} (final audio provided)`,
          )
        }

        // Skip transcription during streaming - we'll use provided transcript or transcribe the full audio on the last chunk
        let fullTranscript: string | null = providedTranscript || null
        let sentiment: 'positive' | 'neutral' | 'negative' | null =
          normalizeSentiment(providedSentiment)

        if (!isLastChunk) {
          console.log(
            `[API] Skipping transcription for chunk ${chunkIndex} (not last chunk)`,
          )
          return {
            success: true,
            chunkIndex,
            transcript: null,
            isLastChunk: false,
          }
        }

        // If this is the last chunk, download all chunks, combine, and transcribe
        console.log(
          `[API] Processing final chunk - downloading, combining, and transcribing full audio...`,
        )

        // Calculate total chunks (chunkIndex is 0-based, so total = chunkIndex + 1)
        const totalChunks = chunkIndex + 1
        console.log(`[API] Total chunks to combine: ${totalChunks}`)

        const normalizedChunkMimeType = normalizeMimeType(mimeType, 'audio/ogg')
        const normalizedFinalMimeType = normalizeMimeType(
          finalAudioMimeType || mimeType,
          'audio/ogg',
        )
        const finalAudioBase64 = finalAudioData
          ? finalAudioData.includes(',')
            ? finalAudioData.split(',')[1] || ''
            : finalAudioData
          : null
        const finalAudioBuffer = finalAudioBase64
          ? Buffer.from(finalAudioBase64, 'base64')
          : null

        // STEP 1: Download and combine chunks (with error handling)
        let combinedAudioBuffer: Buffer | null = null
        let audioKey: string | null = null
        let audioUrl: string | null = null

        try {
          if (!finalAudioBuffer) {
            // Download and combine all chunks from R2
            console.log(
              `[API] ===== STEP 1: Downloading and combining chunks =====`,
            )
            console.log(`[API] User ID: ${user[0].id}`)
            console.log(`[API] Feedback ID: ${feedbackId}`)
            console.log(`[API] Total chunks: ${totalChunks}`)
            const combineStartTime = Date.now()
            combinedAudioBuffer = await downloadAndCombineChunks(
              user[0].id,
              feedbackId,
              totalChunks,
            )
            const combineDuration = Date.now() - combineStartTime
            console.log(
              `[API] ✓ Combined ${totalChunks} chunks in ${combineDuration}ms`,
              {
                totalSize: combinedAudioBuffer.length,
                totalSizeMB: (combinedAudioBuffer.length / 1024 / 1024).toFixed(
                  2,
                ),
              },
            )
          } else {
            console.log(`[API] Using final audio from client`, {
              size: finalAudioBuffer.length,
              sizeMB: (finalAudioBuffer.length / 1024 / 1024).toFixed(2),
              format: normalizedFinalMimeType,
            })
          }

          const audioBufferToUpload = finalAudioBuffer || combinedAudioBuffer
          if (!audioBufferToUpload) {
            throw new Error('No combined or final audio available to upload')
          }

          const uploadMimeType = finalAudioBuffer
            ? normalizedFinalMimeType
            : normalizedChunkMimeType
          const extension = extensionFromMimeType(uploadMimeType)

          // Upload the combined audio file to R2 (no conversion)
          console.log(
            `[API] ===== STEP 2: Uploading combined audio to R2 =====`,
          )
          const finalAudioKey = generateFeedbackAudioKey(
            user[0].id,
            feedbackId,
            undefined,
            extension,
          )
          audioKey = finalAudioKey
          console.log(
            `[API] Audio key: ${audioKey} (format: ${uploadMimeType})`,
          )
          const finalUploadStartTime = Date.now()
          await uploadAudioChunk(audioKey, audioBufferToUpload, uploadMimeType)
          const finalUploadDuration = Date.now() - finalUploadStartTime
          console.log(
            `[API] ✓ Audio uploaded to R2 in ${finalUploadDuration}ms`,
            {
              key: audioKey,
              format: uploadMimeType,
              size: audioBufferToUpload.length,
              sizeMB: (audioBufferToUpload.length / 1024 / 1024).toFixed(2),
            },
          )

          // Get the full audio URL (for both transcription and playback)
          console.log(`[API] ===== STEP 3: Generating presigned URL =====`)
          const urlStartTime = Date.now()
          audioUrl = await getAudioUrl(audioKey)
          const urlDuration = Date.now() - urlStartTime
          console.log(`[API] ✓ Audio URL generated in ${urlDuration}ms`, {
            url: (audioUrl || '').substring(0, 100) + '...',
          })
        } catch (audioError: unknown) {
          console.error(
            `[API] Error processing audio (will save feedback without audio):`,
            audioError,
          )
          // Continue - we'll save feedback without audio URL if needed
        }

        // STEP 2: Save feedback record FIRST (even if transcription fails)
        console.log(`[API] Creating feedback record in database...`)
        const dbInsertStartTime = Date.now()
        await db.insert(feedback).values({
          id: feedbackId,
          userId: user[0].id,
          customerName: customerName || null,
          audioUrl: audioUrl || null,
          audioKey: audioKey || null, // Store audio key (used for both transcription and playback)
          transcript: null, // Will be updated after transcription
          sentiment: null, // Will be updated after analysis
          duration: duration || 0,
        })
        const dbInsertDuration = Date.now() - dbInsertStartTime
        console.log(`[API] Feedback record created in ${dbInsertDuration}ms`, {
          userId: user[0].id,
          feedbackId,
          hasAudio: !!audioUrl,
        })

        // STEP 3: Use provided transcript/sentiment OR transcribe (with error handling - won't fail feedback save)
        try {
          if (providedTranscript) {
            console.log(
              `[API] Using provided transcript (length: ${providedTranscript.length})`,
            )
          }
          if (sentiment) {
            console.log(`[API] Using provided sentiment: ${sentiment}`)
          }

          const transcriptionAudioBuffer =
            finalAudioBuffer || combinedAudioBuffer
          const transcriptionMimeType = finalAudioBuffer
            ? normalizedFinalMimeType
            : normalizedChunkMimeType

          if (!fullTranscript && transcriptionAudioBuffer) {
            console.log(
              `[API] ===== STEP 4: Transcribing audio with ElevenLabs =====`,
            )
            console.log(
              `[API] Audio buffer size: ${transcriptionAudioBuffer.length} bytes`,
            )
            console.log(`[API] Audio key: ${audioKey}`)
            console.log(`[API] Transcription format: ${transcriptionMimeType}`)
            const transcriptionStartTime = Date.now()
            fullTranscript = await transcribeAudioWithElevenLabs(
              transcriptionAudioBuffer,
              transcriptionMimeType,
            )
            const transcriptionDuration = Date.now() - transcriptionStartTime
            console.log(
              `[API] ✓ Full audio transcribed in ${transcriptionDuration}ms`,
              {
                transcriptLength: fullTranscript ? fullTranscript.length : 0,
                transcriptPreview: fullTranscript
                  ? fullTranscript.substring(0, 300)
                  : 'No transcript',
                fullTranscript: fullTranscript || 'EMPTY TRANSCRIPT',
              },
            )
          }

          if (fullTranscript && !sentiment) {
            console.log(`[API] Analyzing sentiment from transcript...`)
            const sentimentStartTime = Date.now()
            sentiment = await analyzeSentiment(fullTranscript)
            const sentimentDuration = Date.now() - sentimentStartTime
            console.log(
              `[API] Sentiment analyzed in ${sentimentDuration}ms:`,
              sentiment,
            )
          }

          let finalCustomerName = customerName || null
          if (!finalCustomerName && fullTranscript) {
            console.log(`[API] Extracting name from transcript...`)
            try {
              const extractedName =
                await extractNameFromTranscript(fullTranscript)
              finalCustomerName = extractedName
              console.log(
                `[API] Extracted name: ${extractedName || 'None found'}`,
              )
            } catch (nameError) {
              console.error(`[API] Name extraction failed:`, nameError)
            }
          } else if (finalCustomerName) {
            console.log(
              `[API] Using provided customer name: ${finalCustomerName}`,
            )
          }

          const updatePayload: {
            transcript?: string
            sentiment?: 'positive' | 'neutral' | 'negative'
            customerName?: string | null
          } = {}

          if (fullTranscript && fullTranscript.trim().length > 0) {
            updatePayload.transcript = fullTranscript
          }
          if (sentiment) {
            updatePayload.sentiment = sentiment
          }
          if (finalCustomerName) {
            updatePayload.customerName = finalCustomerName
          }

          if (Object.keys(updatePayload).length > 0) {
            console.log(`[API] Updating feedback record with transcription...`)
            await db
              .update(feedback)
              .set(updatePayload)
              .where(eq(feedback.id, feedbackId))
            console.log(`[API] Feedback record updated with transcription`)
          } else {
            console.warn(
              `[API] Skipping feedback update - no transcript or sentiment available`,
            )
          }
        } catch (transcriptionError: unknown) {
          console.error(
            `[API] Transcription/analysis failed (feedback still saved):`,
            transcriptionError,
          )
        }

        // Deduct one pulse (only if user has pulses remaining)
        console.log(`[API] Deducting pulse from user ${user[0].id}...`)
        const pulseUpdateStartTime = Date.now()
        // Ensure we don't go below 0 and don't deduct if already at 0
        const currentPulses = Math.max(0, user[0].pulsesRemaining)
        const newPulseBalance = currentPulses > 0 ? currentPulses - 1 : 0
        await db
          .update(users)
          .set({
            pulsesRemaining: newPulseBalance,
            updatedAt: new Date(),
          })
          .where(eq(users.id, user[0].id))
        const pulseUpdateDuration = Date.now() - pulseUpdateStartTime
        console.log(
          `[API] Pulse deducted in ${pulseUpdateDuration}ms. New balance: ${newPulseBalance} (was ${currentPulses})`,
        )

        // Check if low pulse notification should be sent
        if (newPulseBalance < 10) {
          const isCritical = newPulseBalance < 5
          console.log(
            `[API] Low pulse detected: ${newPulseBalance} remaining (${isCritical ? 'CRITICAL' : 'WARNING'})`,
          )

          if (isCritical) {
            // Send immediately for critical (< 5 pulses)
            try {
              await sendLowPulseEmail({
                to: user[0].email,
                userName: user[0].businessName || user[0].email.split('@')[0],
                pulsesRemaining: newPulseBalance,
              })
              console.log(
                `[API] Critical low pulse email sent to ${user[0].email}`,
              )
            } catch (emailError: unknown) {
              console.error(
                `[API] Failed to send critical low pulse email:`,
                emailError,
              )
              // Don't fail the request if email fails
            }
          } else {
            // Fire and forget for warning (5-9 pulses)
            sendLowPulseEmail({
              to: user[0].email,
              userName: user[0].businessName || user[0].email.split('@')[0],
              pulsesRemaining: newPulseBalance,
            }).catch((emailError: unknown) => {
              console.error(
                `[API] Failed to send low pulse warning email:`,
                emailError,
              )
            })
          }
        }

        console.log(`[API] Feedback submission complete!`, {
          feedbackId,
          userId: user[0].id,
          totalProcessingTime: Date.now() - uploadStartTime,
        })

        return {
          success: true,
          chunkIndex,
          transcript: fullTranscript,
          isLastChunk: true,
        }
      } catch (error) {
        console.error(
          `[API] Error processing stream chunk ${chunkIndex}:`,
          error,
        )
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error occurred'
        console.error(`[API] Error details:`, {
          errorMessage,
          stack: error instanceof Error ? error.stack : undefined,
          businessId,
          feedbackId,
          chunkIndex,
        })
        throw new Error(`Failed to process chunk: ${errorMessage}`)
      }
    },
    {
      body: t.Object({
        businessId: t.String(),
        feedbackId: t.String(),
        chunkIndex: t.Number(),
        audioData: t.String(), // Base64 encoded
        mimeType: t.String(),
        isLastChunk: t.Boolean(),
        customerName: t.Optional(t.String()),
        duration: t.Optional(t.Number()),
        transcript: t.Optional(t.String()), // Pre-transcribed transcript from client
        sentiment: t.Optional(t.String()), // Pre-analyzed sentiment from client
        finalAudioData: t.Optional(t.String()), // Base64 of full recording for reliable storage
        finalAudioMimeType: t.Optional(t.String()),
      }),
    },
  )
  // Feedback routes
  .get(
    '/feedback/check-pulses',
    async ({ query }) => {
      const { businessId } = query as { businessId?: string }

      if (!businessId) {
        return {
          error: 'Business ID is required',
          hasPulses: false,
        }
      }

      // Find user by unique code
      const user = await db
        .select()
        .from(users)
        .where(eq(users.uniqueCode, businessId))
        .limit(1)

      if (user.length === 0) {
        return {
          error: 'Business not found',
          hasPulses: false,
        }
      }

      return {
        hasPulses: user[0].pulsesRemaining > 0,
        pulsesRemaining: user[0].pulsesRemaining,
      }
    },
    {
      query: t.Object({
        businessId: t.String(),
      }),
    },
  )
  .get(
    '/feedback',
    async ({ query }) => {
      const { userId } = query as { userId?: string }

      if (!userId) {
        return {
          error: 'User ID is required',
          feedback: [],
        }
      }

      // Get feedback for the user, ordered by most recent
      const feedbackList = await db
        .select()
        .from(feedback)
        .where(eq(feedback.userId, userId))
        .orderBy(desc(feedback.createdAt))

      // Format feedback for response and regenerate URLs if needed
      const formattedFeedback = await Promise.all(
        feedbackList.map(async (f) => {
          // If we have audioKey but no audioUrl (or want to regenerate), create a new presigned URL
          let audioUrl = f.audioUrl || null
          if (f.audioKey && !audioUrl) {
            try {
              audioUrl = await getAudioUrl(f.audioKey)
              // Optionally update the database with the new URL
              // (We could do this, but it's fine to just return it in the response)
            } catch (error) {
              console.error(
                `[API] Failed to generate audio URL for key ${f.audioKey}:`,
                error,
              )
            }
          }

          return {
            id: f.id,
            customerName: f.customerName || null, // Keep as null, will show "Anonymous" in UI
            date: f.createdAt.toISOString(),
            duration: f.duration || 0, // Return as number in seconds
            transcript: f.transcript || '',
            audioUrl,
            audioKey: f.audioKey || null, // Include audioKey for client-side URL regeneration if needed
            sentiment: f.sentiment as
              | 'positive'
              | 'neutral'
              | 'negative'
              | null,
            createdAt: f.createdAt.toISOString(),
          }
        }),
      )

      return { feedback: formattedFeedback }
    },
    {
      query: t.Object({
        userId: t.String(),
      }),
    },
  )
  .get(
    '/feedback/stats',
    async ({ query }) => {
      const { userId } = query as { userId?: string }

      if (!userId) {
        return {
          error: 'User ID is required',
          totalFeedback: 0,
          avgDuration: 0,
          thisWeekCount: 0,
        }
      }

      // Query feedback table using userId
      // Get total feedback count
      const totalResult = await db
        .select({ count: count() })
        .from(feedback)
        .where(eq(feedback.userId, userId))

      const totalFeedback = totalResult[0]?.count || 0

      // Get average duration (in seconds)
      const avgResult = await db
        .select({ avgDuration: avg(feedback.duration) })
        .from(feedback)
        .where(eq(feedback.userId, userId))

      const avgDurationSeconds = avgResult[0]?.avgDuration
        ? Number.parseFloat(avgResult[0].avgDuration)
        : 0

      // Get feedback count from this week (last 7 days)
      const oneWeekAgo = new Date()
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7)

      const thisWeekResult = await db
        .select({ count: count() })
        .from(feedback)
        .where(
          and(eq(feedback.userId, userId), gte(feedback.createdAt, oneWeekAgo)),
        )

      const thisWeekCount = thisWeekResult[0]?.count || 0

      return {
        totalFeedback,
        avgDuration: avgDurationSeconds,
        thisWeekCount,
      }
    },
    {
      query: t.Object({
        userId: t.String(),
      }),
    },
  )
  .get('/feedback/:id', async ({ params, request }) => {
    const user = await getUserFromSession(request)

    if (!user) {
      return {
        error: 'Unauthorized',
      }
    }

    const { id: feedbackId } = params

    // Get feedback record
    const feedbackRecord = await db
      .select()
      .from(feedback)
      .where(eq(feedback.id, feedbackId))
      .limit(1)

    if (feedbackRecord.length === 0) {
      return {
        error: 'Feedback not found',
      }
    }

    const f = feedbackRecord[0]

    // Verify the feedback belongs to the user
    if (f.userId !== user.id) {
      return {
        error: 'Unauthorized',
      }
    }

    return {
      id: f.id,
      transcript: f.transcript,
      sentiment: f.sentiment,
      customerName: f.customerName,
      audioUrl: f.audioUrl,
      audioKey: f.audioKey,
      duration: f.duration,
      createdAt: f.createdAt,
    }
  })
  // Transcribe audio endpoint (called from client before submission)
  .post(
    '/feedback/transcribe',
    async ({ body }) => {
      const { audioData, mimeType } = body // audioData is base64 string

      console.log('[API] /feedback/transcribe called', {
        audioDataLength: audioData.length,
        mimeType,
      })

      try {
        // Convert base64 to Buffer
        const audioBuffer = Buffer.from(audioData, 'base64')
        console.log('[API] Audio buffer created', {
          size: audioBuffer.length,
          sizeMB: (audioBuffer.length / 1024 / 1024).toFixed(2),
        })

        // Normalize MIME type
        // ElevenLabs supports all major audio and video formats
        const normalizedMimeType = (mimeType || 'audio/mpeg')
          .split(';')[0]
          .trim()
          .toLowerCase() // Default to MP3 (most universal)

        // Transcribe audio
        console.log('[API] Starting transcription...')
        const transcript = await transcribeAudioWithElevenLabs(
          audioBuffer,
          normalizedMimeType,
        )

        if (!transcript || transcript.trim().length === 0) {
          throw new Error('Transcription returned empty result')
        }

        console.log('[API] Transcription complete', {
          transcriptLength: transcript.length,
          preview: transcript.substring(0, 100),
        })

        // Analyze sentiment
        console.log('[API] Analyzing sentiment...')
        const sentiment = await analyzeSentiment(transcript)
        console.log('[API] Sentiment analysis complete', { sentiment })

        // Extract name from transcript
        console.log('[API] Extracting name from transcript...')
        let customerName: string | null = null
        try {
          customerName = await extractNameFromTranscript(transcript)
          console.log('[API] Name extraction complete', {
            name: customerName || 'None found',
          })
        } catch (nameError) {
          console.error('[API] Name extraction failed:', nameError)
          // Continue without extracted name
        }

        return {
          success: true,
          transcript,
          sentiment,
          customerName,
        }
      } catch (error) {
        console.error('[API] Transcription error:', error)
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error occurred'
        return {
          success: false,
          error: errorMessage,
        }
      }
    },
    {
      body: t.Object({
        audioData: t.String(), // Base64 encoded audio
        mimeType: t.String(),
      }),
    },
  )
  .get('/feedback/:id/audio-url', async ({ params, request }) => {
    const user = await getUserFromSession(request)

    if (!user) {
      return {
        error: 'Unauthorized',
        audioUrl: null,
      }
    }

    const { id: feedbackId } = params

    // Get feedback record
    const feedbackRecord = await db
      .select()
      .from(feedback)
      .where(eq(feedback.id, feedbackId))
      .limit(1)

    if (feedbackRecord.length === 0) {
      return {
        error: 'Feedback not found',
        audioUrl: null,
      }
    }

    const f = feedbackRecord[0]

    // Verify the feedback belongs to the user
    if (f.userId !== user.id) {
      return {
        error: 'Unauthorized',
        audioUrl: null,
      }
    }

    // Generate new presigned URL from audioKey
    if (!f.audioKey) {
      return {
        error: 'No audio key available',
        audioUrl: null,
      }
    }

    try {
      const audioUrl = await getAudioUrl(f.audioKey)
      return { audioUrl }
    } catch (error) {
      console.error(
        `[API] Failed to generate audio URL for key ${f.audioKey}:`,
        error,
      )
      return {
        error: 'Failed to generate audio URL',
        audioUrl: null,
      }
    }
  })
  .post('/feedback', async ({ request }) => {
    const user = await getUserFromSession(request)

    if (!user) {
      return {
        success: false,
        error: 'Unauthorized',
      }
    }

    // Check if user has pulses remaining
    if (user.pulsesRemaining <= 0) {
      return {
        success: false,
        error: 'No pulses remaining. Please purchase more pulses.',
      }
    }

    // Note: This endpoint is mainly for completeness
    // The actual feedback submission uses /feedback/stream-chunk
    // But we can implement a simple version here if needed
    return {
      success: false,
      error: 'Please use /feedback/stream-chunk for audio feedback submission',
    }
  })
  // Pulse routes
  .get('/pulses', async ({ request }) => {
    const user = await getUserFromSession(request)

    if (!user) {
      return {
        error: 'Unauthorized',
        pulsesRemaining: 0,
      }
    }

    return {
      pulsesRemaining: user.pulsesRemaining,
    }
  })
  // Custom checkout handler - creates product on-the-fly
  .post(
    '/custom-checkout',
    async ({ body }) => {
      const {
        customerName,
        customerEmail,
        customerExternalId,
        pulseAmount,
        price,
      } = body

      // Use sandbox token in development, production token in production
      const isDevelopment = process.env.NODE_ENV === 'development'
      const polarToken = isDevelopment
        ? env.POLAR_SANDBOX_API_TOKEN || env.POLAR_API_KEY
        : env.POLAR_API_KEY

      if (!polarToken || !env.POLAR_ORGANIZATION_ID) {
        throw new Error('Polar API key or organization ID not configured')
      }

      const polar = new Polar({
        accessToken: polarToken,
      })

      // Convert price from USD to cents
      const priceInCents = Math.round(price * 100)

      // Create product with fixed pricing
      const product = await polar.products.create({
        name: `${customerName}'s Custom Pack - ${pulseAmount} pulses`,
        prices: [
          {
            amountType: 'fixed',
            priceAmount: priceInCents,
            priceCurrency: 'usd',
          },
        ],
        organizationId: env.POLAR_ORGANIZATION_ID,
      })

      // Create checkout with the custom product
      const checkout = await polar.checkouts.create({
        customerName,
        customerEmail,
        externalCustomerId: customerExternalId,
        products: [product.id],
        metadata: {
          pulseAmount: pulseAmount.toString(),
        },
        successUrl: env.SERVER_URL
          ? `${env.SERVER_URL}/dashboard?payment=success`
          : 'http://localhost:3000/dashboard?payment=success',
        returnUrl: env.SERVER_URL || 'http://localhost:3000',
      })

      return {
        success: true,
        checkoutUrl: checkout.url,
        productId: product.id,
      }
    },
    {
      body: t.Object({
        customerName: t.String(),
        customerEmail: t.String({ format: 'email' }),
        customerExternalId: t.String(),
        pulseAmount: t.Number({ minimum: 1 }),
        price: t.Number({ minimum: 0.01 }),
      }),
    },
  )
  // Polar checkout handler
  .get(
    '/checkout',
    Checkout({
      accessToken:
        process.env.NODE_ENV === 'development'
          ? env.POLAR_SANDBOX_API_TOKEN || env.POLAR_API_KEY || ''
          : env.POLAR_API_KEY || '',
      successUrl:
        process.env.NODE_ENV === 'development'
          ? 'https://shimmery-noncalculably-chu.ngrok-free.dev/dashboard?payment=success'
          : `${env.SERVER_URL || 'http://localhost:3000'}/dashboard?payment=success`,
      returnUrl:
        process.env.NODE_ENV === 'development'
          ? 'https://shimmery-noncalculably-chu.ngrok-free.dev'
          : env.SERVER_URL || 'http://localhost:3000',
      server: process.env.NODE_ENV === 'production' ? 'production' : 'sandbox',
    }),
  )
  // Polar webhook handler
  .post(
    '/webhook/polar',
    Webhooks({
      webhookSecret:
        process.env.NODE_ENV === 'development'
          ? env.POLAR_SANDBOX_WEBHOOK_SECRET || env.POLAR_WEBHOOK_SECRET || ''
          : env.POLAR_WEBHOOK_SECRET || '',
      onOrderPaid: async (payload) => {
        // When an order is paid, add pulses to the user's account
        const order = payload.data as any
        const customerExternalId = order.customer?.external_id

        if (!customerExternalId) {
          console.error('No customer external ID found in order')
          return
        }

        // Find user by external ID (which is their user ID)
        const user = await db
          .select()
          .from(users)
          .where(eq(users.id, customerExternalId))
          .limit(1)

        if (user.length === 0) {
          console.error(`User not found: ${customerExternalId}`)
          return
        }

        // Product ID to pulse amount mapping
        const productPulseMap: Record<string, number> = {
          'fad8b1dd-d9f5-42a1-b84d-c4a07059e475': 10, // Starter
          '80ed7c99-0512-48af-88d5-83dc29cfec50': 25, // Popular
          '1a60a8a1-a88e-4aa9-8cd1-43bf88cd15f5': 50, // Growth
          'f4f82b5c-2c39-4b8d-a8bf-53de00594e21': 100, // Scale
        }

        // Calculate total pulses from order items
        let totalPulses = 0

        // Handle order items (could be array or single product)
        if (order.items && Array.isArray(order.items)) {
          // Multiple items
          for (const item of order.items) {
            const productId = item.product?.id || item.product_id

            // Check if it's a custom product (check metadata)
            if (item.metadata?.pulseAmount) {
              totalPulses +=
                Number.parseInt(item.metadata.pulseAmount) *
                (item.quantity || 1)
            } else if (productId && productPulseMap[productId]) {
              totalPulses += productPulseMap[productId] * (item.quantity || 1)
            }
          }
        } else if (order.product?.id) {
          // Single product - check metadata first for custom products
          if (order.metadata?.pulseAmount) {
            totalPulses = Number.parseInt(order.metadata.pulseAmount)
          } else {
            totalPulses = productPulseMap[order.product.id] || 0
          }
        } else if (order.product_id) {
          // Product ID directly - check metadata first
          if (order.metadata?.pulseAmount) {
            totalPulses = Number.parseInt(order.metadata.pulseAmount)
          } else {
            totalPulses = productPulseMap[order.product_id] || 0
          }
        }

        if (totalPulses === 0) {
          console.error('No pulses found for order:', order.id)
          return
        }

        // Update user's pulse balance
        await db
          .update(users)
          .set({
            pulsesRemaining: user[0].pulsesRemaining + totalPulses,
            updatedAt: new Date(),
          })
          .where(eq(users.id, customerExternalId))

        // Create purchase record
        await db.insert(pulsePurchases).values({
          userId: customerExternalId,
          amount: totalPulses,
          price: order.amount_total || 0, // Price in cents
          stripePaymentId: order.id, // Using Polar order ID
          status: 'completed',
        })

        console.log(`Added ${totalPulses} pulses to user ${customerExternalId}`)
      },
      onOrderRefunded: async (payload) => {
        // When an order is refunded, deduct pulses from the user's account
        const order = payload.data as any
        const customerExternalId = order.customer?.external_id

        if (!customerExternalId) {
          console.error('No customer external ID found in refund order')
          return
        }

        // Find the purchase record
        const purchase = await db
          .select()
          .from(pulsePurchases)
          .where(eq(pulsePurchases.stripePaymentId, order.id))
          .limit(1)

        if (purchase.length === 0) {
          console.error(`Purchase not found for order: ${order.id}`)
          return
        }

        const pulsesToDeduct = purchase[0].amount

        // Find user
        const user = await db
          .select()
          .from(users)
          .where(eq(users.id, customerExternalId))
          .limit(1)

        if (user.length === 0) {
          console.error(`User not found: ${customerExternalId}`)
          return
        }

        // Deduct pulses (don't go below 0)
        const newBalance = Math.max(0, user[0].pulsesRemaining - pulsesToDeduct)

        await db
          .update(users)
          .set({
            pulsesRemaining: newBalance,
            updatedAt: new Date(),
          })
          .where(eq(users.id, customerExternalId))

        // Update purchase status
        await db
          .update(pulsePurchases)
          .set({ status: 'failed' })
          .where(eq(pulsePurchases.id, purchase[0].id))

        console.log(
          `Refunded ${pulsesToDeduct} pulses from user ${customerExternalId}`,
        )
      },
      // eslint-disable-next-line @typescript-eslint/require-await
      onPayload: async (payload) => {
        // Log all webhook events for debugging
        console.log('Polar webhook event:', payload.type, payload.data)
      },
    }),
  )
  // Resend webhook handler for receiving emails
  .post('/webhook/resend', async ({ request }) => {
    try {
      const payload = await request.text()
      const headers = {
        id: request.headers.get('svix-id') || '',
        timestamp: request.headers.get('svix-timestamp') || '',
        signature: request.headers.get('svix-signature') || '',
      }

      // Verify webhook
      const resend = getResendClient()
      let event: ResendWebhookEvent
      try {
        // verify() throws an error if the webhook is invalid
        // Otherwise, returns the parsed payload object
        event = resend.webhooks.verify({
          payload,
          headers,
          webhookSecret: env.RESEND_WEBHOOK_SECRET || '',
        }) as ResendWebhookEvent
      } catch (verifyError) {
        console.error('[Resend Webhook] Verification failed:', verifyError)
        return new Response(JSON.stringify({ error: 'Invalid webhook' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        })
      }

      // Handle email.received events
      // Currently ResendWebhookEvent only supports email.received
      const emailReceivedEvent = event
      const emailData = emailReceivedEvent.data
      const emailId = emailData.email_id

      console.log('[Resend Webhook] Email received:', {
        emailId,
        from: emailData.from,
        to: emailData.to,
        subject: emailData.subject,
      })

      // Fetch email content
      const emailResponse = await resend.emails.receiving.get(emailId)
      if (emailResponse.error) {
        console.error(
          '[Resend Webhook] Error fetching email:',
          emailResponse.error,
        )
        return new Response(
          JSON.stringify({ error: 'Failed to fetch email content' }),
          { status: 500, headers: { 'Content-Type': 'application/json' } },
        )
      }

      const emailContent = emailResponse.data

      // Fetch attachments if any
      let attachmentsHtml = ''
      let attachmentLinks: Array<{
        filename: string
        downloadUrl: string
        expiresAt: string
      }> = []

      if (emailData.attachments.length > 0) {
        const attachmentsResponse =
          await resend.emails.receiving.attachments.list({
            emailId,
          })

        if (!attachmentsResponse.error) {
          attachmentLinks = attachmentsResponse.data.data.map((att: any) => ({
            filename: att.filename,
            downloadUrl: att.download_url,
            expiresAt: att.expires_at,
          }))

          // Create HTML for attachments
          const baseUrl =
            process.env.NODE_ENV === 'development'
              ? 'https://shimmery-noncalculably-chu.ngrok-free.dev'
              : env.SERVER_URL || 'http://localhost:3000'

          attachmentsHtml = `
            <div style="margin-top: 20px; padding: 15px; background-color: #f5f5f5; border-radius: 5px;">
              <h3 style="margin-top: 0;">Attachments (${attachmentLinks.length})</h3>
              <ul style="list-style: none; padding: 0;">
                ${attachmentLinks
                  .map(
                    (att) => `
                  <li style="margin-bottom: 10px;">
                    <a href="${att.downloadUrl}" style="color: #0066cc; text-decoration: none;">
                      📎 ${att.filename}
                    </a>
                    <br>
                    <small style="color: #666;">
                      Expires: ${new Date(att.expiresAt).toLocaleString()}
                    </small>
                    <br>
                    <a href="${baseUrl}/api/attachments/${emailId}" style="color: #0066cc; font-size: 12px; text-decoration: none;">
                      🔄 Re-fetch attachments if expired
                    </a>
                  </li>
                `,
                  )
                  .join('')}
              </ul>
            </div>
          `
        }
      }

      // Forward email to personal email
      const forwardResponse = await resend.emails.send({
        from: 'Pulse Forwarding <support@pulseapp.click>',
        to: 'ogbemudiatimothy@gmail.com',
        subject: `[Forwarded] ${emailData.subject || '(No Subject)'}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background-color: #f9f9f9; padding: 15px; border-radius: 5px; margin-bottom: 20px;">
              <p><strong>From:</strong> ${emailData.from}</p>
              <p><strong>To:</strong> ${emailData.to.join(', ')}</p>
              <p><strong>Date:</strong> ${new Date(emailData.created_at).toLocaleString()}</p>
              ${emailData.cc.length > 0 ? `<p><strong>CC:</strong> ${emailData.cc.join(', ')}</p>` : ''}
            </div>
            
            <div style="background-color: #ffffff; padding: 20px; border: 1px solid #ddd; border-radius: 5px;">
              ${emailContent.html || emailContent.text || '<p><em>No content available</em></p>'}
            </div>
            
            ${attachmentsHtml}
            
            <div style="margin-top: 20px; padding: 10px; background-color: #e8f4f8; border-radius: 5px; font-size: 12px; color: #666;">
              <p><strong>Note:</strong> This email was automatically forwarded from your Resend receiving address.</p>
              <p>Email ID: ${emailId}</p>
            </div>
          </div>
        `,
        text: `
From: ${emailData.from}
To: ${emailData.to.join(', ')}
Date: ${new Date(emailData.created_at).toLocaleString()}

${emailContent.text || 'No text content available'}

${attachmentLinks.length > 0 ? `\nAttachments:\n${attachmentLinks.map((att) => `- ${att.filename}: ${att.downloadUrl}`).join('\n')}` : ''}
        `,
      })

      if (forwardResponse.error) {
        console.error(
          '[Resend Webhook] Error forwarding email:',
          forwardResponse.error,
        )
        return new Response(
          JSON.stringify({ error: 'Failed to forward email' }),
          { status: 500, headers: { 'Content-Type': 'application/json' } },
        )
      }

      console.log('[Resend Webhook] Email forwarded successfully')
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })

      // Return success for other event types
      return new Response(JSON.stringify({ received: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    } catch (error) {
      console.error('[Resend Webhook] Error processing webhook:', error)
      return new Response(JSON.stringify({ error: 'Invalid webhook' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }
  })
  // Route to re-fetch attachments for an email
  .get('/attachments/:emailId', async ({ params }) => {
    try {
      const { emailId } = params as { emailId: string }
      const resend = getResendClient()

      // Fetch attachments
      const attachmentsResponse =
        await resend.emails.receiving.attachments.list({
          emailId,
        })

      if (attachmentsResponse.error) {
        console.error(
          '[Attachments API] Error fetching attachments:',
          attachmentsResponse.error,
        )
        return new Response(
          JSON.stringify({ error: 'Failed to fetch attachments' }),
          { status: 500, headers: { 'Content-Type': 'application/json' } },
        )
      }

      const attachments = attachmentsResponse.data.data

      // Return HTML page with attachment links
      const baseUrl =
        process.env.NODE_ENV === 'development'
          ? 'https://shimmery-noncalculably-chu.ngrok-free.dev'
          : env.SERVER_URL || 'http://localhost:3000'

      const html = `
        <!DOCTYPE html>
        <html>
          <head>
            <title>Email Attachments</title>
            <style>
              body {
                font-family: Arial, sans-serif;
                max-width: 600px;
                margin: 50px auto;
                padding: 20px;
              }
              .attachment {
                padding: 15px;
                margin: 10px 0;
                background-color: #f5f5f5;
                border-radius: 5px;
              }
              .attachment a {
                color: #0066cc;
                text-decoration: none;
                font-weight: bold;
              }
              .attachment a:hover {
                text-decoration: underline;
              }
              .expires {
                color: #666;
                font-size: 12px;
                margin-top: 5px;
              }
            </style>
          </head>
          <body>
            <h1>Email Attachments</h1>
            <p>Email ID: ${emailId}</p>
            ${attachments.length === 0 ? '<p>No attachments found.</p>' : ''}
            ${attachments
              .map(
                (att: any) => `
              <div class="attachment">
                <a href="${att.download_url}" download>📎 ${att.filename}</a>
                <div class="expires">
                  Size: ${(att.size / 1024).toFixed(2)} KB | 
                  Expires: ${new Date(att.expires_at).toLocaleString()}
                </div>
              </div>
            `,
              )
              .join('')}
            <p style="margin-top: 30px;">
              <a href="${baseUrl}/api/attachments/${emailId}">🔄 Refresh</a>
            </p>
          </body>
        </html>
      `

      return new Response(html, {
        status: 200,
        headers: { 'Content-Type': 'text/html' },
      })
    } catch (error) {
      console.error('[Attachments API] Error:', error)
      return new Response(
        JSON.stringify({ error: 'Failed to fetch attachments' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } },
      )
    }
  })

// Export type for Eden Treaty
export type App = typeof app

// Export HTTP methods for Next.js
export const GET = app.fetch
export const POST = app.fetch
export const PUT = app.fetch
export const DELETE = app.fetch
