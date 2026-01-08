import { Elysia, t } from 'elysia'
import { treaty } from '@elysiajs/eden'
import { Checkout, Webhooks } from '@polar-sh/elysia'
import { Polar } from '@polar-sh/sdk'

import { createFileRoute } from '@tanstack/react-router'
import { createIsomorphicFn } from '@tanstack/react-start'

import { desc, eq } from 'drizzle-orm'

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
import { sendOTPEmail } from '@/lib/email'
import { generateOTP } from '@/lib/otp'
import { db } from '@/db/index'
import { feedback, otpCodes, pulsePurchases, users } from '@/db/schema'
import { env } from '@/env'
import { getUserFromSession } from '@/lib/auth-helpers'

const app = new Elysia({
  prefix: '/api',
})
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
      } = body

      // Find user by unique code
      const user = await db
        .select()
        .from(users)
        .where(eq(users.uniqueCode, businessId))
        .limit(1)

      if (user.length === 0) {
        throw new Error('Business not found')
      }

      // Check if user has pulses remaining (only on first chunk)
      if (chunkIndex === 0 && user[0].pulsesRemaining <= 0) {
        throw new Error('No pulses remaining. Please purchase more pulses.')
      }

      // Convert base64 to buffer
      const audioBuffer = Buffer.from(audioData, 'base64')

      // Upload chunk to R2
      const chunkKey = generateFeedbackAudioKey(
        user[0].id,
        feedbackId,
        chunkIndex,
      )
      await uploadAudioChunk(chunkKey, audioBuffer, mimeType)

      // Transcribe chunk
      const chunkTranscript = await transcribeAudioChunk(audioData, mimeType)

      // If this is the last chunk, create feedback record with full processing
      if (isLastChunk) {
        // Get the full audio URL (use the first chunk or combine all chunks)
        const audioUrl = await getAudioUrl(
          generateFeedbackAudioKey(user[0].id, feedbackId),
        )

        // For now, use the last chunk's transcript
        // TODO: In production, you might want to store all chunk transcripts
        // and combine them, or use a different approach
        const fullTranscript = chunkTranscript

        // Analyze sentiment from full transcript
        const sentiment = await analyzeSentiment(fullTranscript)

        // Extract name from transcript if not provided
        let finalCustomerName = customerName || null
        if (!finalCustomerName && fullTranscript) {
          const extractedName = await extractNameFromTranscript(fullTranscript)
          finalCustomerName = extractedName
        }

        // Create feedback record
        await db.insert(feedback).values({
          userId: user[0].id,
          customerName: finalCustomerName,
          audioUrl,
          transcript: fullTranscript,
          sentiment,
          duration: duration || 0,
        })

        // Deduct one pulse
        await db
          .update(users)
          .set({
            pulsesRemaining: user[0].pulsesRemaining - 1,
            updatedAt: new Date(),
          })
          .where(eq(users.id, user[0].id))
      }

      return {
        success: true,
        chunkIndex,
        transcript: chunkTranscript,
        isLastChunk,
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
      }),
    },
  )
  // Feedback routes
  .get('/feedback', async () => {
    const user = await getUserFromSession()

    if (!user) {
      return {
        error: 'Unauthorized',
        feedback: [],
      }
    }

    // Get feedback for the user, ordered by most recent
    const feedbackList = await db
      .select()
      .from(feedback)
      .where(eq(feedback.userId, user.id))
      .orderBy(desc(feedback.createdAt))

    // Format feedback for response
    const formattedFeedback = feedbackList.map((f) => ({
      id: f.id,
      customerName: f.customerName || 'Anonymous',
      date: f.createdAt.toISOString(),
      duration: f.duration
        ? `${Math.floor(f.duration / 60)}:${String(f.duration % 60).padStart(2, '0')}`
        : '0:00',
      transcript: f.transcript || '',
      audioUrl: f.audioUrl || null,
      sentiment: f.sentiment as 'positive' | 'neutral' | 'negative' | null,
      createdAt: f.createdAt.toISOString(),
    }))

    return { feedback: formattedFeedback }
  })
  .post('/feedback', async () => {
    const user = await getUserFromSession()

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
  .get('/pulses', async () => {
    const user = await getUserFromSession()

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

      if (!env.POLAR_API_KEY || !env.POLAR_ORGANIZATION_ID) {
        throw new Error('Polar API key or organization ID not configured')
      }

      const polar = new Polar({
        accessToken: env.POLAR_API_KEY,
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
      accessToken: env.POLAR_API_KEY || '',
      successUrl: env.SERVER_URL
        ? `${env.SERVER_URL}/dashboard?payment=success`
        : 'http://localhost:3000/dashboard?payment=success',
      returnUrl: env.SERVER_URL || 'http://localhost:3000',
      server: process.env.NODE_ENV === 'production' ? 'production' : 'sandbox',
    }),
  )
  // Polar webhook handler
  .post(
    '/webhook/polar',
    Webhooks({
      webhookSecret: env.POLAR_WEBHOOK_SECRET || '',
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
      onPayload: async (payload) => {
        // Log all webhook events for debugging
        console.log('Polar webhook event:', payload.type, payload.data)
      },
    }),
  )

const handle = ({ request }: { request: Request }) => app.fetch(request)

export const Route = createFileRoute('/api/$')({
  server: {
    handlers: {
      GET: handle,
      POST: handle,
      PUT: handle,
      DELETE: handle,
    },
  },
})

export const api = createIsomorphicFn()
  .server(() => treaty(app).api)
  .client(
    () =>
      treaty<typeof app>(
        typeof window !== 'undefined'
          ? window.location.origin
          : 'http://localhost:3000',
      ).api,
  )
