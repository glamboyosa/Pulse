import { eq, sql } from 'drizzle-orm'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { encrypt } from '../lib/session'
import { GET, POST } from '../app/api/[[...slugs]]/route'
import { createBusiness, pulsesOf, resetDatabase } from './support/db'
import { orderPayload, signedWebhook } from './support/polar'
import { feedback, otpCodes } from '@/db/schema'
import { db } from '@/db/index'

const background = vi.hoisted(() => ({ tasks: [] as Array<() => unknown> }))
vi.mock('next/server', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  after: (task: () => unknown) => background.tasks.push(task),
}))

vi.mock('@/lib/storage/r2', () => ({
  AUDIO_KEY_PREFIX: 'test/',
  uploadAudio: vi.fn().mockResolvedValue(undefined),
  deleteAudio: vi.fn().mockResolvedValue(undefined),
  downloadAudio: vi.fn(),
  getAudioUrl: vi.fn((key: string) =>
    Promise.resolve(`https://r2.test/${key}?signed`),
  ),
}))
vi.mock('@/lib/ai/elevenlabs', () => ({
  transcribeAudioWithElevenLabs: vi.fn().mockResolvedValue('Lovely service.'),
}))
vi.mock('@/lib/ai/text-analysis', () => ({
  analyzeSentiment: vi.fn().mockResolvedValue('positive'),
  extractNameFromTranscript: vi.fn().mockResolvedValue(null),
}))
const sentOtps = vi.hoisted(() => [] as Array<{ to: string; otpCode: string }>)
vi.mock('@/lib/email', () => ({
  sendOTPEmail: vi.fn((args: { to: string; otpCode: string }) => {
    sentOtps.push(args)
    return Promise.resolve()
  }),
}))
vi.mock('@/lib/email/feedback-received', () => ({
  sendFeedbackReceivedEmail: vi.fn().mockResolvedValue(undefined),
}))
vi.mock('@/lib/email/low-pulse', () => ({
  sendLowPulseEmail: vi.fn().mockResolvedValue(undefined),
}))

const polar = vi.hoisted(() => ({ create: vi.fn() }))
vi.mock('@polar-sh/sdk', () => ({
  Polar: vi
    .fn()
    .mockImplementation(() => ({ checkouts: { create: polar.create } })),
}))

const base = 'https://pulse.test/api'

const sessionCookie = async (user: { id: string; email: string }) =>
  `session=${await encrypt({ userId: user.id, email: user.email, expiresAt: new Date(Date.now() + 3600_000) })}`

const get = (path: string, cookie?: string) =>
  GET(new Request(`${base}${path}`, { headers: cookie ? { cookie } : {} }))

const postJson = (
  path: string,
  body: unknown,
  headers: Record<string, string> = {},
) =>
  POST(
    new Request(`${base}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...headers },
      body: JSON.stringify(body),
    }),
  )

const submit = (code: string, ip = '10.0.0.1', type = 'audio/mp4') => {
  const form = new FormData()
  form.append('code', code)
  form.append(
    'audio',
    new Blob([new Uint8Array(2048)], { type }),
    'feedback.m4a',
  )
  form.append('duration', '12')
  return POST(
    new Request(`${base}/feedback/submit`, {
      method: 'POST',
      headers: { 'x-forwarded-for': ip },
      body: form,
    }),
  )
}

beforeEach(async () => {
  await resetDatabase()
  background.tasks.length = 0
  sentOtps.length = 0
})

describe('owner data is private', () => {
  it('requires a session for feedback, stats, pulses and audio', async () => {
    for (const path of [
      '/feedback',
      '/feedback/stats',
      '/pulses',
      `/feedback/${crypto.randomUUID()}`,
      `/feedback/${crypto.randomUUID()}/audio-url`,
    ]) {
      expect((await get(path)).status, path).toBe(401)
    }
  })

  it("lists only the signed-in owner's feedback, whatever userId is passed", async () => {
    const alice = await createBusiness()
    const bob = await createBusiness()
    await db.insert(feedback).values([
      { userId: alice.id, transcript: 'alice feedback', audioKey: 'a.m4a' },
      { userId: bob.id, transcript: 'bob secret', audioKey: 'b.m4a' },
    ])

    const response = await get(
      `/feedback?userId=${bob.id}`,
      await sessionCookie(alice),
    )
    const body = (await response.json()) as {
      feedback: Array<{ transcript: string; audioUrl: string }>
    }
    expect(body.feedback.map((f) => f.transcript)).toEqual(['alice feedback'])
    expect(body.feedback[0].audioUrl).toBe('https://r2.test/a.m4a?signed')
  })

  it("returns 404 for another owner's feedback and audio", async () => {
    const alice = await createBusiness()
    const bob = await createBusiness()
    const [bobs] = await db
      .insert(feedback)
      .values({ userId: bob.id, audioKey: 'b.m4a' })
      .returning()
    const cookie = await sessionCookie(alice)
    expect((await get(`/feedback/${bobs.id}`, cookie)).status).toBe(404)
    expect((await get(`/feedback/${bobs.id}/audio-url`, cookie)).status).toBe(
      404,
    )
  })

  it('rejects a forged session', async () => {
    const alice = await createBusiness()
    expect(
      (
        await get(
          '/feedback',
          `session=${(await sessionCookie(alice)).slice(8, -4)}abcd`,
        )
      ).status,
    ).toBe(401)
  })
})

describe('customer submissions', () => {
  it('accepts a recording, spends a pulse and processes it after replying', async () => {
    const owner = await createBusiness({ pulsesRemaining: 3 })
    const response = await submit(owner.uniqueCode!)
    expect(response.status).toBe(200)
    const { feedbackId } = (await response.json()) as { feedbackId: string }

    expect(await pulsesOf(owner.id)).toBe(2)
    expect(background.tasks).toHaveLength(1)
    await background.tasks[0]()
    const [row] = await db
      .select()
      .from(feedback)
      .where(eq(feedback.id, feedbackId))
    expect(row).toMatchObject({
      transcript: 'Lovely service.',
      status: 'ready',
    })
  })

  it('returns 402 when the business has no pulses', async () => {
    const owner = await createBusiness({ pulsesRemaining: 0 })
    expect((await submit(owner.uniqueCode!)).status).toBe(402)
  })

  it('rejects non-audio uploads', async () => {
    const owner = await createBusiness()
    expect(
      (await submit(owner.uniqueCode!, '10.0.0.1', 'text/html')).status,
    ).toBe(415)
    expect(await pulsesOf(owner.id)).toBe(5)
  })

  it('limits one connection to 10 submissions per business in 10 minutes', async () => {
    const owner = await createBusiness({ pulsesRemaining: 50 })
    const statuses = []
    for (let i = 0; i < 12; i++)
      statuses.push((await submit(owner.uniqueCode!, '10.9.9.9')).status)
    expect(statuses.filter((s) => s === 200)).toHaveLength(10)
    expect(statuses.slice(10)).toEqual([429, 429])
    expect(await pulsesOf(owner.id)).toBe(40)
    // Another customer on a different connection still gets through.
    expect((await submit(owner.uniqueCode!, '10.1.1.1')).status).toBe(200)
  })

  it('tells the page whether a business is accepting feedback, without the balance', async () => {
    const open = await createBusiness({ pulsesRemaining: 1 })
    const closed = await createBusiness({ pulsesRemaining: 0 })
    expect(
      await (await get(`/businesses/${open.uniqueCode}/status`)).json(),
    ).toEqual({ name: open.businessName, accepting: true })
    expect(
      await (await get(`/businesses/${closed.uniqueCode}/status`)).json(),
    ).toEqual({ name: closed.businessName, accepting: false })
    expect((await get('/businesses/nope/status')).status).toBe(404)
  })

  it('no longer exposes the old open endpoints', async () => {
    for (const path of [
      '/feedback/transcribe',
      '/feedback/stream-chunk',
      '/custom-checkout',
    ]) {
      expect((await postJson(path, {})).status, path).toBe(404)
    }
    expect((await get(`/attachments/${crypto.randomUUID()}`)).status).toBe(404)
  })
})

describe('checkout', () => {
  it('requires a session', async () => {
    expect((await postJson('/checkout', { packId: 'starter' })).status).toBe(
      401,
    )
  })

  it('refuses a custom amount outside the allowed range', async () => {
    const owner = await createBusiness()
    const response = await postJson(
      '/checkout',
      { pulses: 100000 },
      { cookie: await sessionCookie(owner) },
    )
    expect(response.status).toBe(400)
  })

  it('ignores a price sent by the browser and charges the server price', async () => {
    const owner = await createBusiness()
    polar.create.mockResolvedValueOnce({ url: 'https://polar.test/c/1' })
    const response = await postJson(
      '/checkout',
      { pulses: 50, price: 0.01 },
      { cookie: await sessionCookie(owner) },
    )

    expect(await response.json()).toEqual({ url: 'https://polar.test/c/1' })
    const args = polar.create.mock.calls[0][0]
    expect(Object.values(args.prices)[0]).toEqual([
      { amountType: 'fixed', priceAmount: 3000, priceCurrency: 'usd' },
    ])
    expect(args.externalCustomerId).toBe(owner.id)
  })
})

describe('Polar webhook', () => {
  const secret = 'test-webhook-secret'
  const deliver = (type: string, data: unknown, signingSecret = secret) => {
    const { body, headers } = signedWebhook(type, data, signingSecret)
    return POST(
      new Request(`${base}/webhook/polar`, { method: 'POST', headers, body }),
    )
  }

  it('rejects a webhook with a bad signature', async () => {
    const owner = await createBusiness({ pulsesRemaining: 0 })
    const response = await deliver(
      'order.paid',
      orderPayload({ externalId: owner.id, metadata: { pulses: '1000' } }),
      'wrong-secret',
    )
    expect(response.status).toBe(403)
    expect(await pulsesOf(owner.id)).toBe(0)
  })

  it('credits a paid order once, however many times Polar delivers it', async () => {
    const owner = await createBusiness({ pulsesRemaining: 0 })
    const paid = orderPayload({
      externalId: owner.id,
      metadata: { pulses: '25' },
      totalAmount: 1600,
    })
    for (let i = 0; i < 3; i++)
      expect((await deliver('order.paid', paid)).status).toBe(200)
    expect(await pulsesOf(owner.id)).toBe(25)
  })

  it('removes refunded pulses', async () => {
    const owner = await createBusiness({ pulsesRemaining: 0 })
    const paid = orderPayload({
      externalId: owner.id,
      metadata: { pulses: '25' },
      totalAmount: 1760,
      taxAmount: 160,
    })
    await deliver('order.paid', paid)
    // Half the pre-tax price back: 12.5 pulses, rounded down to 12.
    await deliver('order.refunded', {
      ...paid,
      refunded_amount: 800,
      status: 'partially_refunded',
    })
    expect(await pulsesOf(owner.id)).toBe(13)
  })

  it('acknowledges events it does not act on', async () => {
    expect((await deliver('order.created', orderPayload())).status).toBe(200)
  })
})

describe('login codes', () => {
  it('sends a 6-digit code and stores it with a 10-minute expiry', async () => {
    const response = await postJson('/auth/send-otp', {
      email: 'New@Example.test',
    })
    expect(response.status).toBe(200)
    expect(sentOtps[0].to).toBe('new@example.test')
    expect(sentOtps[0].otpCode).toMatch(/^\d{6}$/)
    const [row] = await db.select().from(otpCodes)
    const ttl = row.expiresAt.getTime() - row.createdAt.getTime()
    expect(ttl).toBeGreaterThan(9.9 * 60_000)
    expect(ttl).toBeLessThan(10.1 * 60_000)
  })

  it('limits how many codes one email can request', async () => {
    const statuses = []
    for (let i = 0; i < 6; i++) {
      statuses.push(
        (
          await postJson(
            '/auth/send-otp',
            { email: 'spam@example.test' },
            { 'x-forwarded-for': `10.0.0.${i}` },
          )
        ).status,
      )
    }
    expect(statuses).toEqual([200, 200, 200, 200, 200, 429])
  })

  it('limits how many codes one connection can request', async () => {
    const statuses = []
    for (let i = 0; i < 11; i++) {
      statuses.push(
        (
          await postJson(
            '/auth/send-otp',
            { email: `person${i}@example.test` },
            { 'x-forwarded-for': '10.7.7.7' },
          )
        ).status,
      )
    }
    expect(statuses.filter((s) => s === 200)).toHaveLength(10)
    expect(statuses.at(-1)).toBe(429)
  })
})
