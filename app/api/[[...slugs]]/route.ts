import { Elysia, t } from 'elysia'
import { WebhookVerificationError, validateEvent } from '@polar-sh/sdk/webhooks'
import { and, avg, count, eq, gte } from 'drizzle-orm'
import { after } from 'next/server'

import type { ResendWebhookEvent } from '@/types/resend'
import type { PaidOrder } from '@/server/billing'
import { db } from '@/db/index'
import { feedback, otpCodes, users } from '@/db/schema'
import { env } from '@/env'
import { sendOTPEmail } from '@/lib/email'
import { OTP_TTL_MS, generateOTP } from '@/lib/otp'
import { getAudioUrl } from '@/lib/storage/r2'
import { getUserFromSession } from '@/lib/auth-helpers'
import { getResendClient } from '@/lib/utils/resend'
import { escapeHtml } from '@/lib/utils/html'
import {
  CheckoutError,
  createCheckout,
  creditPaidOrder,
  polarEnvironment,
  polarWebhookSecret,
  refundOrder,
} from '@/server/billing'
import {
  SubmissionError,
  processFeedback,
  submitFeedback,
  submitTypedFeedback,
} from '@/server/feedback-submission'
import { listFeedback } from '@/server/feedback-queries'
import { deleteFeedback, exportAccount } from '@/server/account-data'
import { SpotError, archiveSpot, createSpot, listSpots } from '@/server/spots'
import { ReplyError, contactEmailFrom, replyToFeedback } from '@/server/replies'
import {
  BrandingError,
  logoUrlFor,
  removeLogo,
  setLogo,
  updateBranding,
} from '@/server/branding'
import {
  MIN_FEEDBACK_FOR_DIGEST,
  countReadyFeedback,
  currentWeek,
  refreshDigest,
} from '@/server/digest'
import { RateLimitError, clientIp, enforceRateLimit } from '@/server/rate-limit'
import { passesTurnstile } from '@/server/turnstile'
import {
  WidgetError,
  createWidgetKey,
  isWidgetKeyFor,
  parseWidgetContext,
  removeWidgetKey,
  setWidgetOrigins,
  widgetSettings,
} from '@/server/widget'

const HOUR_MS = 60 * 60 * 1000
const WIDGET_OFF = 'This feedback button is turned off.'

/**
 * Feedback through the website widget carries its key, and page context that
 * only the widget may send. false: the key isn't this business's live key.
 */
const widgetFor = async (body: {
  code: string
  widgetKey?: string
  context?: string
}) => {
  if (!body.widgetKey) return undefined
  if (!(await isWidgetKeyFor(body.code, body.widgetKey))) return false
  return { context: parseWidgetContext(body.context) }
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })

const app = new Elysia({ prefix: '/api' })
  // Elysia ignores the status of a Response returned from onError, so the
  // status goes through `set`.
  .onError(({ error, set }) => {
    if (error instanceof RateLimitError) {
      set.status = 429
      set.headers['retry-after'] = String(error.retryAfterSeconds)
      return { error: error.message }
    }
    if (error instanceof ReplyError) {
      set.status = error.status
      return { error: error.message }
    }
    if (error instanceof BrandingError) {
      set.status = error.status
      return { error: error.message }
    }
    if (error instanceof WidgetError) {
      set.status = error.status
      return { error: error.message }
    }
  })
  .post(
    '/auth/send-otp',
    async ({ body, request, set }) => {
      // Before the rate limits, so bots can't use up a real person's quota.
      if (!(await passesTurnstile(body.turnstileToken, clientIp(request)))) {
        set.status = 400
        return {
          success: false,
          error: "We couldn't check you're human. Please try again.",
        }
      }
      const email = body.email.toLowerCase()
      await enforceRateLimit(`otp:email:${email}`, 5, HOUR_MS)
      await enforceRateLimit(`otp:ip:${clientIp(request)}`, 10, HOUR_MS)

      const code = generateOTP()
      await db.insert(otpCodes).values({
        email,
        code,
        expiresAt: new Date(Date.now() + OTP_TTL_MS),
      })

      try {
        await sendOTPEmail({ to: email, otpCode: code })
      } catch (error) {
        console.error('[auth] failed to send OTP email', error)
        return {
          success: false,
          error: 'Failed to send email. Please try again.',
        }
      }
      return { success: true, message: 'OTP sent to your email' }
    },
    {
      body: t.Object({
        email: t.String({ format: 'email' }),
        turnstileToken: t.Optional(t.String({ maxLength: 2048 })),
      }),
    },
  )
  // Public: whether a business's feedback page should take a recording.
  .get('/businesses/:code/status', async ({ params }) => {
    const business = (
      await db
        .select({
          name: users.businessName,
          pulsesRemaining: users.pulsesRemaining,
        })
        .from(users)
        .where(eq(users.uniqueCode, params.code))
        .limit(1)
    ).at(0)
    if (!business) return json(404, { error: 'Business not found' })
    return { name: business.name, accepting: business.pulsesRemaining > 0 }
  })
  // Public: a customer's recording, one request per submission.
  .post(
    '/feedback/submit',
    async ({ body, request, set }) => {
      const ip = clientIp(request)
      if (!(await passesTurnstile(body.turnstileToken, ip))) {
        set.status = 400
        return { error: "We couldn't check you're human. Please try again." }
      }
      // Customers in one venue often share an IP, so the per-IP cap is loose;
      // the per-business cap stops a script from draining a business's pulses.
      await enforceRateLimit(`submit:ip:${ip}:${body.code}`, 10, 10 * 60 * 1000)
      await enforceRateLimit(`submit:business:${body.code}`, 120, HOUR_MS)
      const widget = await widgetFor(body)
      if (widget === false) return json(403, { error: WIDGET_OFF })

      try {
        const { feedbackId, business } = await submitFeedback({
          widget,
          code: body.code,
          audio: body.audio,
          durationSeconds: body.duration,
          customerName: body.customerName?.trim().slice(0, 80) || null,
          spot: body.spot,
          contactEmail: contactEmailFrom(body.contactEmail),
        })
        const audio = {
          buffer: Buffer.from(await body.audio.arrayBuffer()),
          type: body.audio.type.split(';')[0],
        }
        after(() => processFeedback(feedbackId, business, { audio }))
        return { success: true, feedbackId }
      } catch (error) {
        if (error instanceof SubmissionError) {
          return json(error.status, { error: error.message })
        }
        throw error
      }
    },
    {
      body: t.Object({
        code: t.String({ minLength: 1, maxLength: 64 }),
        audio: t.File(),
        duration: t.Numeric({ minimum: 0 }),
        customerName: t.Optional(t.String({ maxLength: 200 })),
        spot: t.Optional(t.String({ maxLength: 64 })),
        contactEmail: t.Optional(t.String({ maxLength: 300 })),
        turnstileToken: t.Optional(t.String({ maxLength: 2048 })),
        widgetKey: t.Optional(t.String({ maxLength: 64 })),
        // Generous, so oversized context is dropped by the parser rather
        // than losing the customer's note to a validation error.
        context: t.Optional(t.String({ maxLength: 16384 })),
      }),
    },
  )
  .post(
    '/feedback/submit-text',
    async ({ body, request, set }) => {
      const ip = clientIp(request)
      if (!(await passesTurnstile(body.turnstileToken, ip))) {
        set.status = 400
        return { error: "We couldn't check you're human. Please try again." }
      }
      // The same limits as recordings: one pulse per submission either way.
      await enforceRateLimit(`submit:ip:${ip}:${body.code}`, 10, 10 * 60 * 1000)
      await enforceRateLimit(`submit:business:${body.code}`, 120, HOUR_MS)
      const widget = await widgetFor(body)
      if (widget === false) return json(403, { error: WIDGET_OFF })

      try {
        const { feedbackId, business } = await submitTypedFeedback({
          widget,
          code: body.code,
          text: body.text,
          customerName: body.customerName?.trim().slice(0, 80) || null,
          spot: body.spot,
          contactEmail: contactEmailFrom(body.contactEmail),
        })
        after(() => processFeedback(feedbackId, business, { typed: true }))
        return { success: true, feedbackId }
      } catch (error) {
        if (error instanceof SubmissionError) {
          return json(error.status, { error: error.message })
        }
        throw error
      }
    },
    {
      body: t.Object({
        code: t.String({ minLength: 1, maxLength: 64 }),
        text: t.String({ maxLength: 5000 }),
        customerName: t.Optional(t.String({ maxLength: 200 })),
        spot: t.Optional(t.String({ maxLength: 64 })),
        contactEmail: t.Optional(t.String({ maxLength: 300 })),
        turnstileToken: t.Optional(t.String({ maxLength: 2048 })),
        widgetKey: t.Optional(t.String({ maxLength: 64 })),
        // Generous, so oversized context is dropped by the parser rather
        // than losing the customer's note to a validation error.
        context: t.Optional(t.String({ maxLength: 16384 })),
      }),
    },
  )
  .get('/feedback', async ({ request }) => {
    const user = await getUserFromSession(request)
    if (!user) return json(401, { error: 'Unauthorized' })

    return { feedback: await listFeedback(user.id) }
  })
  .get('/feedback/stats', async ({ request }) => {
    const user = await getUserFromSession(request)
    if (!user) return json(401, { error: 'Unauthorized' })

    const weekAgo = new Date(Date.now() - 7 * 24 * HOUR_MS)
    const [totals] = await db
      .select({ total: count(), avgDuration: avg(feedback.duration) })
      .from(feedback)
      .where(eq(feedback.userId, user.id))
    const [week] = await db
      .select({ count: count() })
      .from(feedback)
      .where(
        and(eq(feedback.userId, user.id), gte(feedback.createdAt, weekAgo)),
      )

    return {
      totalFeedback: totals.total,
      avgDuration: totals.avgDuration ? Number(totals.avgDuration) : 0,
      thisWeekCount: week.count,
    }
  })
  .get('/feedback/:id', async ({ params, request }) => {
    const user = await getUserFromSession(request)
    if (!user) return json(401, { error: 'Unauthorized' })

    const f = (
      await db
        .select()
        .from(feedback)
        .where(and(eq(feedback.id, params.id), eq(feedback.userId, user.id)))
        .limit(1)
    ).at(0)
    if (!f) return json(404, { error: 'Feedback not found' })

    return {
      id: f.id,
      transcript: f.transcript,
      sentiment: f.sentiment,
      customerName: f.customerName,
      status: f.status,
      duration: f.duration,
      createdAt: f.createdAt,
    }
  })
  .get('/feedback/:id/audio-url', async ({ params, request }) => {
    const user = await getUserFromSession(request)
    if (!user) return json(401, { error: 'Unauthorized' })

    const f = (
      await db
        .select({ audioKey: feedback.audioKey })
        .from(feedback)
        .where(and(eq(feedback.id, params.id), eq(feedback.userId, user.id)))
        .limit(1)
    ).at(0)
    if (!f?.audioKey) return json(404, { error: 'Audio not found' })

    return { audioUrl: await getAudioUrl(f.audioKey) }
  })
  .get('/pulses', async ({ request }) => {
    const user = await getUserFromSession(request)
    if (!user) return json(401, { error: 'Unauthorized' })
    return { pulsesRemaining: user.pulsesRemaining }
  })
  // Starts a Polar checkout for the signed-in owner. The browser names a pack
  // or a pulse count; the price is worked out here.
  .post(
    '/checkout',
    async ({ body, request }) => {
      const user = await getUserFromSession(request)
      if (!user) return json(401, { error: 'Unauthorized' })

      try {
        const { url } = await createCheckout(
          {
            id: user.id,
            email: user.email,
            name: user.businessName || user.email.split('@')[0],
          },
          body.packId
            ? { kind: 'pack', packId: body.packId }
            : { kind: 'custom', pulses: body.pulses ?? 0 },
        )
        return { url }
      } catch (error) {
        if (error instanceof CheckoutError) {
          return json(400, { error: error.message })
        }
        throw error
      }
    },
    {
      body: t.Object({
        packId: t.Optional(
          t.Union([
            t.Literal('starter'),
            t.Literal('popular'),
            t.Literal('growth'),
            t.Literal('scale'),
          ]),
        ),
        pulses: t.Optional(t.Integer()),
      }),
    },
  )
  // Public: a stable logo address that redirects to a short-lived R2 link.
  .get('/businesses/:code/logo', async ({ params }) => {
    const url = await logoUrlFor(params.code)
    if (!url) return json(404, { error: 'No logo' })
    return new Response(null, {
      status: 302,
      // s-maxage lets Vercel's CDN answer repeat views without running this.
      headers: {
        location: url,
        'cache-control': 'public, max-age=3000, s-maxage=3000',
      },
    })
  })
  // The website widget: one public key, usable only from the listed origins.
  .get('/settings/widget', async ({ request }) => {
    const user = await getUserFromSession(request)
    if (!user) return json(401, { error: 'Unauthorized' })
    return widgetSettings(user.id)
  })
  .post('/settings/widget/key', async ({ request }) => {
    const user = await getUserFromSession(request)
    if (!user) return json(401, { error: 'Unauthorized' })
    return { key: await createWidgetKey(user.id) }
  })
  .delete('/settings/widget/key', async ({ request }) => {
    const user = await getUserFromSession(request)
    if (!user) return json(401, { error: 'Unauthorized' })
    await removeWidgetKey(user.id)
    return { success: true }
  })
  .put(
    '/settings/widget/origins',
    async ({ body, request }) => {
      const user = await getUserFromSession(request)
      if (!user) return json(401, { error: 'Unauthorized' })
      return { origins: await setWidgetOrigins(user.id, body.origins) }
    },
    {
      body: t.Object({
        origins: t.Array(t.String({ maxLength: 300 }), { maxItems: 50 }),
      }),
    },
  )
  .put(
    '/settings/branding',
    async ({ body, request }) => {
      const user = await getUserFromSession(request)
      if (!user) return json(401, { error: 'Unauthorized' })
      await updateBranding(user.id, body)
      return { success: true }
    },
    {
      body: t.Object({
        feedbackQuestion: t.String({ maxLength: 1000 }),
        accentColor: t.String({ maxLength: 20 }),
        googleReviewUrl: t.String({ maxLength: 2000 }),
        thankYouMessage: t.String({ maxLength: 1000 }),
      }),
    },
  )
  .post(
    '/settings/logo',
    async ({ body, request }) => {
      const user = await getUserFromSession(request)
      if (!user) return json(401, { error: 'Unauthorized' })
      await setLogo(user.id, body.logo)
      return { success: true }
    },
    // setLogo enforces the 1 MB limit with a clear message; Vercel caps the
    // whole request at 4.5 MB before it gets here.
    { body: t.Object({ logo: t.File() }) },
  )
  .delete('/settings/logo', async ({ request }) => {
    const user = await getUserFromSession(request)
    if (!user) return json(401, { error: 'Unauthorized' })
    await removeLogo(user.id)
    return { success: true }
  })
  .post(
    '/feedback/:id/reply',
    async ({ body, params, request }) => {
      const user = await getUserFromSession(request)
      if (!user) return json(401, { error: 'Unauthorized' })
      // Each reply emails an address Pulse can't verify, so keep the volume low.
      await enforceRateLimit(`reply:${user.id}`, 20, 24 * HOUR_MS)
      await replyToFeedback(user.id, params.id, body.message)
      return { success: true }
    },
    {
      params: t.Object({ id: t.String({ format: 'uuid' }) }),
      body: t.Object({ message: t.String({ maxLength: 5000 }) }),
    },
  )
  .delete(
    '/feedback/:id',
    async ({ params, request }) => {
      const user = await getUserFromSession(request)
      if (!user) return json(401, { error: 'Unauthorized' })
      return (await deleteFeedback(user.id, params.id))
        ? { success: true }
        : json(404, { error: 'Feedback not found' })
    },
    { params: t.Object({ id: t.String({ format: 'uuid' }) }) },
  )
  .get('/account/export', async ({ request }) => {
    const user = await getUserFromSession(request)
    if (!user) return json(401, { error: 'Unauthorized' })
    const day = new Date().toISOString().slice(0, 10)
    return new Response(JSON.stringify(await exportAccount(user.id), null, 2), {
      headers: {
        'content-type': 'application/json; charset=utf-8',
        'content-disposition': `attachment; filename="pulse-export-${day}.json"`,
        'cache-control': 'no-store',
      },
    })
  })
  .get('/spots', async ({ request }) => {
    const user = await getUserFromSession(request)
    if (!user) return json(401, { error: 'Unauthorized' })
    return { spots: await listSpots(user.id) }
  })
  .post(
    '/spots',
    async ({ body, request }) => {
      const user = await getUserFromSession(request)
      if (!user) return json(401, { error: 'Unauthorized' })
      try {
        return { spot: await createSpot(user.id, body.name) }
      } catch (error) {
        if (error instanceof SpotError) {
          return json(error.status, { error: error.message })
        }
        throw error
      }
    },
    { body: t.Object({ name: t.String({ maxLength: 200 }) }) },
  )
  .delete(
    '/spots/:id',
    async ({ params, request }) => {
      const user = await getUserFromSession(request)
      if (!user) return json(401, { error: 'Unauthorized' })
      return (await archiveSpot(user.id, params.id))
        ? { success: true }
        : json(404, { error: 'Spot not found' })
    },
    { params: t.Object({ id: t.String({ format: 'uuid' }) }) },
  )
  .post('/insights/digest', async ({ request }) => {
    const user = await getUserFromSession(request)
    if (!user) return json(401, { error: 'Unauthorized' })
    // Checked first, so a refresh that can't work doesn't use up the limit.
    const thisWeek = await countReadyFeedback(user.id, currentWeek())
    if (thisWeek < MIN_FEEDBACK_FOR_DIGEST) {
      return json(422, { error: 'Not enough feedback this week yet' })
    }
    await enforceRateLimit(`digest:${user.id}`, 3, 24 * HOUR_MS)

    const digest = await refreshDigest(user.id)
    if (!digest) {
      return json(422, { error: 'Not enough feedback this week yet' })
    }
    return { digest }
  })
  .post('/webhook/polar', async ({ request }) => {
    const environment = polarEnvironment()
    const secret = polarWebhookSecret(environment)
    if (!secret) return json(500, { error: 'Webhook secret not configured' })

    const body = await request.text()
    let event: ReturnType<typeof validateEvent>
    try {
      event = validateEvent(
        body,
        Object.fromEntries(request.headers.entries()),
        secret,
      )
    } catch (error) {
      if (error instanceof WebhookVerificationError) {
        return json(403, { error: 'Invalid signature' })
      }
      throw error
    }

    // Errors below return 500 so Polar retries; both handlers are idempotent.
    if (event.type === 'order.paid') {
      const result = await creditPaidOrder(event.data as PaidOrder)
      if (result.status === 'unmatched') {
        console.error('[polar] could not credit order', {
          orderId: event.data.id,
          reason: result.reason,
        })
      }
    } else if (event.type === 'order.refunded') {
      await refundOrder(event.data as PaidOrder)
    }
    return { received: true }
  })
  // Forwards mail sent to the Pulse support address to the founder's inbox.
  .post('/webhook/resend', async ({ request }) => {
    const payload = await request.text()
    const resend = getResendClient()
    let event: ResendWebhookEvent
    try {
      event = resend.webhooks.verify({
        payload,
        headers: {
          id: request.headers.get('svix-id') || '',
          timestamp: request.headers.get('svix-timestamp') || '',
          signature: request.headers.get('svix-signature') || '',
        },
        webhookSecret: env.RESEND_WEBHOOK_SECRET || '',
      }) as ResendWebhookEvent
    } catch {
      return json(400, { error: 'Invalid webhook' })
    }

    const email = event.data
    const content = await resend.emails.receiving.get(email.email_id)
    if (content.error) return json(500, { error: 'Failed to fetch email' })

    const header = [
      `From: ${email.from}`,
      `To: ${email.to.join(', ')}`,
      email.cc.length > 0 ? `Cc: ${email.cc.join(', ')}` : null,
      `Date: ${new Date(email.created_at).toLocaleString()}`,
    ]
      .filter(Boolean)
      .join('\n')

    const forwarded = await resend.emails.send({
      from: 'Pulse Forwarding <support@pulseapp.click>',
      to: 'ogbemudiatimothy@gmail.com',
      replyTo: email.from,
      subject: `[Forwarded] ${email.subject || '(No subject)'}`,
      html: `<pre style="font-family: Arial, sans-serif; background: #f5f5f5; padding: 12px;">${escapeHtml(header)}</pre>${content.data.html || `<pre>${escapeHtml(content.data.text || '')}</pre>`}`,
      text: `${header}\n\n${content.data.text || ''}`,
    })
    if (forwarded.error) return json(500, { error: 'Failed to forward email' })
    return { success: true }
  })

export type App = typeof app

export const GET = app.fetch
export const POST = app.fetch
export const PUT = app.fetch
export const DELETE = app.fetch
