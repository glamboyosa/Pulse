import { eq, sql } from 'drizzle-orm'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { encrypt } from '../lib/session'
import { DELETE, GET, POST, PUT } from '../app/api/[[...slugs]]/route'
import { GET as cronGET } from '../app/api/cron/weekly-digest/route'
import { GET as retentionGET } from '../app/api/cron/retention/route'
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
  analyseTranscript: vi.fn().mockResolvedValue({
    sentiment: 'positive',
    customerName: null,
    language: 'English',
    englishTranslation: null,
    summary: 'Lovely service.',
    themes: ['service'],
  }),
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

// Cloudflare's answer, faked: the token 'bot' fails, anything else passes.
vi.mock('@/server/turnstile', () => ({
  passesTurnstile: vi.fn((token?: string) => Promise.resolve(token !== 'bot')),
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

const submit = (
  code: string,
  ip = '10.0.0.1',
  type = 'audio/mp4',
  turnstileToken?: string,
) => {
  const form = new FormData()
  form.append('code', code)
  if (turnstileToken) form.append('turnstileToken', turnstileToken)
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

  it('refuses a recording that fails the bot check, without spending a pulse', async () => {
    const owner = await createBusiness({ pulsesRemaining: 3 })
    const response = await submit(
      owner.uniqueCode!,
      '10.0.0.1',
      'audio/mp4',
      'bot',
    )
    expect(response.status).toBe(400)
    expect(await pulsesOf(owner.id)).toBe(3)
    expect(background.tasks).toHaveLength(0)
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
    ).toEqual({ name: open.businessName, accepting: true, offer: null })
    expect(
      await (await get(`/businesses/${closed.uniqueCode}/status`)).json(),
    ).toEqual({ name: closed.businessName, accepting: false, offer: null })
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

describe('typed feedback API', () => {
  it('accepts typed feedback, spends a pulse and processes it after replying', async () => {
    const owner = await createBusiness({ pulsesRemaining: 2 })
    const response = await postJson(
      '/feedback/submit-text',
      { code: owner.uniqueCode, text: 'Great jollof, slow service.' },
      { 'x-forwarded-for': '10.2.2.2' },
    )
    expect(response.status).toBe(200)
    expect(await pulsesOf(owner.id)).toBe(1)
    expect(background.tasks).toHaveLength(1)
  })

  it('refuses typed feedback that fails the bot check, without spending a pulse', async () => {
    const owner = await createBusiness({ pulsesRemaining: 2 })
    const response = await postJson('/feedback/submit-text', {
      code: owner.uniqueCode,
      text: 'Great jollof, slow service.',
      turnstileToken: 'bot',
    })
    expect(response.status).toBe(400)
    expect(await pulsesOf(owner.id)).toBe(2)
  })

  it('tags typed feedback with the spot from the QR link', async () => {
    const owner = await createBusiness()
    await postJson(
      '/spots',
      { name: 'Patio' },
      { cookie: await sessionCookie(owner) },
    )
    await postJson(
      '/feedback/submit-text',
      { code: owner.uniqueCode, text: 'Lovely patio.', spot: 'patio' },
      { 'x-forwarded-for': '10.3.3.3' },
    )
    const list = (await (
      await get('/feedback', await sessionCookie(owner))
    ).json()) as {
      feedback: Array<{ spot: { name: string } | null; typed: boolean }>
    }
    expect(list.feedback[0]).toMatchObject({
      spot: { name: 'Patio' },
      typed: true,
    })
  })

  it('keeps the contact address private and refuses a bad one before spending a pulse', async () => {
    const owner = await createBusiness({ pulsesRemaining: 3 })
    const bad = await postJson(
      '/feedback/submit-text',
      { code: owner.uniqueCode, text: 'Too loud.', contactEmail: 'nope' },
      { 'x-forwarded-for': '10.4.4.4' },
    )
    expect(bad.status).toBe(400)
    expect(await pulsesOf(owner.id)).toBe(3)

    await postJson(
      '/feedback/submit-text',
      {
        code: owner.uniqueCode,
        text: 'Too loud.',
        contactEmail: 'Ada@Example.test',
      },
      { 'x-forwarded-for': '10.4.4.4' },
    )
    const [row] = await db.select().from(feedback)
    expect(row.contactEmail).toBe('ada@example.test')
    const listed = await (
      await get('/feedback', await sessionCookie(owner))
    ).text()
    expect(listed).not.toContain('ada@example.test')
    expect(JSON.parse(listed).feedback[0].reply).toBe('wanted')
  })

  it('explains why a reply is refused', async () => {
    const owner = await createBusiness()
    const [row] = await db
      .insert(feedback)
      .values({ userId: owner.id, transcript: 'Fine.' })
      .returning()
    const response = await postJson(
      `/feedback/${row.id}/reply`,
      { message: 'Hi' },
      { cookie: await sessionCookie(owner) },
    )
    expect(response.status).toBe(409)
    expect(await response.json()).toEqual({
      error: 'This customer didn’t leave a way to reply',
    })
  })

  it('needs a session to reply', async () => {
    const response = await postJson(`/feedback/${crypto.randomUUID()}/reply`, {
      message: 'Hi',
    })
    expect(response.status).toBe(401)
  })

  it('explains text that is too short', async () => {
    const owner = await createBusiness()
    const response = await postJson('/feedback/submit-text', {
      code: owner.uniqueCode,
      text: 'no',
    })
    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({
      error: 'Write a little more first',
    })
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

  it('sends no code when the Turnstile check fails', async () => {
    const response = await postJson('/auth/send-otp', {
      email: 'bot@example.test',
      turnstileToken: 'bot',
    })
    expect(response.status).toBe(400)
    expect(sentOtps).toHaveLength(0)
    expect(await db.select().from(otpCodes)).toHaveLength(0)
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

describe('weekly digest cron', () => {
  it('runs only for Vercel Cron, which sends the secret', async () => {
    const run = (authorization?: string) =>
      cronGET(
        new Request(`${base}/cron/weekly-digest`, {
          headers: authorization ? { authorization } : {},
        }),
      )
    expect((await run()).status).toBe(401)
    expect((await run('Bearer wrong-secret')).status).toBe(401)
    expect((await run('test-cron-secret')).status).toBe(401)

    const response = await run('Bearer test-cron-secret')
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ sent: 0, skipped: 0, failed: 0 })
  })

  it('refuses to write a digest without enough feedback this week, without spending the limit', async () => {
    const owner = await createBusiness()
    const cookie = await sessionCookie(owner)
    for (let i = 0; i < 4; i++) {
      expect((await postJson('/insights/digest', {}, { cookie })).status).toBe(
        422,
      )
    }
  })
})

describe('spots API', () => {
  it("needs a session and only touches the owner's own spots", async () => {
    expect((await get('/spots')).status).toBe(401)
    expect((await postJson('/spots', { name: 'Patio' })).status).toBe(401)
    expect(
      (
        await POST(
          new Request(`${base}/spots/${crypto.randomUUID()}`, {
            method: 'DELETE',
          }),
        )
      ).status,
    ).toBe(401)

    const alice = await createBusiness()
    const bob = await createBusiness()
    const created = (await (
      await postJson(
        '/spots',
        { name: 'Patio' },
        { cookie: await sessionCookie(alice) },
      )
    ).json()) as { spot: { id: string; slug: string } }
    expect(created.spot.slug).toBe('patio')

    const remove = (id: string, cookie: string) =>
      POST(
        new Request(`${base}/spots/${id}`, {
          method: 'DELETE',
          headers: { cookie },
        }),
      )
    expect(
      (await remove(created.spot.id, await sessionCookie(bob))).status,
    ).toBe(404)
    expect(
      (await remove(created.spot.id, await sessionCookie(alice))).status,
    ).toBe(200)
    expect(
      await (await get('/spots', await sessionCookie(alice))).json(),
    ).toEqual({ spots: [] })
  })

  it('rejects a blank spot name', async () => {
    const owner = await createBusiness()
    const response = await postJson(
      '/spots',
      { name: '  ' },
      { cookie: await sessionCookie(owner) },
    )
    expect(response.status).toBe(400)
  })
})

describe('website widget settings', () => {
  const call = async (
    handler: typeof POST,
    method: string,
    path: string,
    cookie?: string,
    body?: unknown,
  ) =>
    handler(
      new Request(`${base}${path}`, {
        method,
        headers: {
          'content-type': 'application/json',
          ...(cookie ? { cookie } : {}),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      }),
    )

  it('need a session', async () => {
    expect((await get('/settings/widget')).status).toBe(401)
    expect((await call(POST, 'POST', '/settings/widget/key')).status).toBe(401)
    expect(
      (
        await call(PUT, 'PUT', '/settings/widget/origins', undefined, {
          origins: ['example.com'],
        })
      ).status,
    ).toBe(401)
  })

  it('creates a key, replaces it, saves origins and turns off', async () => {
    const owner = await createBusiness()
    const cookie = await sessionCookie(owner)
    expect(await (await get('/settings/widget', cookie)).json()).toEqual({
      key: null,
      origins: [],
    })

    const { key } = (await (
      await call(POST, 'POST', '/settings/widget/key', cookie)
    ).json()) as { key: string }
    expect(key).toMatch(/^pk_[A-Za-z0-9_-]{24}$/)
    const { key: replaced } = (await (
      await call(POST, 'POST', '/settings/widget/key', cookie)
    ).json()) as { key: string }
    expect(replaced).not.toBe(key)

    const saved = await call(PUT, 'PUT', '/settings/widget/origins', cookie, {
      origins: ['conclave.click', 'https://conclave.click/app', ''],
    })
    expect(await saved.json()).toEqual({ origins: ['https://conclave.click'] })

    const commas = await call(PUT, 'PUT', '/settings/widget/origins', cookie, {
      origins: ['glamboyosa.xyz, www.glamboyosa.xyz'],
    })
    expect(await commas.json()).toEqual({
      origins: ['https://glamboyosa.xyz', 'https://www.glamboyosa.xyz'],
    })

    await call(DELETE, 'DELETE', '/settings/widget/key', cookie)
    expect(await (await get('/settings/widget', cookie)).json()).toEqual({
      key: null,
      origins: ['https://glamboyosa.xyz', 'https://www.glamboyosa.xyz'],
    })
  })

  it('refuses more than 10 websites', async () => {
    const owner = await createBusiness()
    const response = await call(
      PUT,
      'PUT',
      '/settings/widget/origins',
      await sessionCookie(owner),
      { origins: Array.from({ length: 11 }, (_, i) => `site${i}.example.com`) },
    )
    expect(response.status).toBe(400)
  })

  it('explains an address it refuses', async () => {
    const owner = await createBusiness()
    const response = await call(
      PUT,
      'PUT',
      '/settings/widget/origins',
      await sessionCookie(owner),
      { origins: ['http://example.com'] },
    )
    expect(response.status).toBe(400)
    expect(((await response.json()) as { error: string }).error).toMatch(
      /https/,
    )
  })
})

describe('feedback through the website widget', () => {
  const withWidget = async () => {
    const owner = await createBusiness({ pulsesRemaining: 3 })
    const cookie = await sessionCookie(owner)
    const { key } = (await (
      await POST(
        new Request(`${base}/settings/widget/key`, {
          method: 'POST',
          headers: { cookie },
        }),
      )
    ).json()) as { key: string }
    return { owner, key }
  }
  const context = JSON.stringify({ page: '/billing?id=1', appVersion: '2.0' })

  it('stores typed feedback as a widget note with its page context', async () => {
    const { owner, key } = await withWidget()
    const response = await postJson('/feedback/submit-text', {
      code: owner.uniqueCode,
      text: 'The export button does nothing.',
      widgetKey: key,
      context,
    })
    expect(response.status).toBe(200)
    const [row] = await db
      .select()
      .from(feedback)
      .where(eq(feedback.userId, owner.id))
    expect(row).toMatchObject({
      channel: 'widget',
      context: { page: '/billing', appVersion: '2.0' },
    })
  })

  it('stores a recording as a widget note', async () => {
    const { owner, key } = await withWidget()
    const form = new FormData()
    form.append('code', owner.uniqueCode!)
    form.append(
      'audio',
      new Blob([new Uint8Array(2048)], { type: 'audio/mp4' }),
      'f.m4a',
    )
    form.append('duration', '9')
    form.append('widgetKey', key)
    form.append('context', context)
    const response = await POST(
      new Request(`${base}/feedback/submit`, { method: 'POST', body: form }),
    )
    expect(response.status).toBe(200)
    const [row] = await db
      .select()
      .from(feedback)
      .where(eq(feedback.userId, owner.id))
    expect(row.channel).toBe('widget')
    expect(row.context).toEqual({ page: '/billing', appVersion: '2.0' })
  })

  it("refuses a key that isn't the business's live key, spending nothing", async () => {
    const { owner } = await withWidget()
    const other = await withWidget()
    const response = await postJson('/feedback/submit-text', {
      code: owner.uniqueCode,
      text: "Using someone else's key.",
      widgetKey: other.key,
    })
    expect(response.status).toBe(403)
    expect(await pulsesOf(owner.id)).toBe(3)
  })

  it('refuses a key after it is turned off', async () => {
    const { owner, key } = await withWidget()
    await DELETE(
      new Request(`${base}/settings/widget/key`, {
        method: 'DELETE',
        headers: { cookie: await sessionCookie(owner) },
      }),
    )
    const response = await postJson('/feedback/submit-text', {
      code: owner.uniqueCode,
      text: 'Still here?',
      widgetKey: key,
    })
    expect(response.status).toBe(403)
    expect(await pulsesOf(owner.id)).toBe(3)
  })

  it('keeps the note but drops context that is too large', async () => {
    const { owner, key } = await withWidget()
    const response = await postJson('/feedback/submit-text', {
      code: owner.uniqueCode,
      text: 'Long context from the host site.',
      widgetKey: key,
      context: JSON.stringify({ custom: { blob: 'x'.repeat(6000) } }),
    })
    expect(response.status).toBe(200)
    const [row] = await db
      .select()
      .from(feedback)
      .where(eq(feedback.userId, owner.id))
    expect(row).toMatchObject({ channel: 'widget', context: null })
  })

  it('ignores page context sent without a widget key', async () => {
    const owner = await createBusiness()
    const response = await postJson('/feedback/submit-text', {
      code: owner.uniqueCode,
      text: 'Lovely jollof.',
      context,
    })
    expect(response.status).toBe(200)
    const [row] = await db
      .select()
      .from(feedback)
      .where(eq(feedback.userId, owner.id))
    expect(row).toMatchObject({ channel: 'qr', context: null })
  })
})

describe('feedback page settings', () => {
  it('need a session', async () => {
    const put = await PUT(
      new Request(`${base}/settings/branding`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          feedbackQuestion: '',
          accentColor: 'black',
          googleReviewUrl: '',
          thankYouMessage: '',
        }),
      }),
    )
    expect(put.status).toBe(401)
  })

  it('explain a bad review link', async () => {
    const owner = await createBusiness()
    const response = await PUT(
      new Request(`${base}/settings/branding`, {
        method: 'PUT',
        headers: {
          'content-type': 'application/json',
          cookie: await sessionCookie(owner),
        },
        body: JSON.stringify({
          feedbackQuestion: '',
          accentColor: 'black',
          googleReviewUrl: 'https://evil.test',
          thankYouMessage: '',
        }),
      }),
    )
    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({
      error: 'Use a Google review link (g.page, google.com or maps.app.goo.gl)',
    })
  })
})

describe('logos API', () => {
  it('needs a session to change the logo', async () => {
    const form = new FormData()
    form.append(
      'logo',
      new Blob([new Uint8Array(10)], { type: 'image/png' }),
      'logo.png',
    )
    expect(
      (
        await POST(
          new Request(`${base}/settings/logo`, { method: 'POST', body: form }),
        )
      ).status,
    ).toBe(401)
    expect(
      (await DELETE(new Request(`${base}/settings/logo`, { method: 'DELETE' })))
        .status,
    ).toBe(401)
  })

  it('refuses a file that is not an image', async () => {
    const owner = await createBusiness()
    const form = new FormData()
    form.append(
      'logo',
      new Blob(['<svg onload=alert(1)>'], { type: 'image/png' }),
      'logo.png',
    )
    const response = await POST(
      new Request(`${base}/settings/logo`, {
        method: 'POST',
        headers: { cookie: await sessionCookie(owner) },
        body: form,
      }),
    )
    expect(response.status).toBe(415)
  })

  it('explains when a logo is over 1 MB', async () => {
    const owner = await createBusiness()
    const form = new FormData()
    form.append(
      'logo',
      new Blob([new Uint8Array(1024 * 1024 + 1)], { type: 'image/png' }),
      'logo.png',
    )
    const response = await POST(
      new Request(`${base}/settings/logo`, {
        method: 'POST',
        headers: { cookie: await sessionCookie(owner) },
        body: form,
      }),
    )
    expect(response.status).toBe(413)
    expect(await response.json()).toEqual({ error: 'Use a logo under 1 MB' })
  })

  it('says when a business has no logo', async () => {
    const owner = await createBusiness()
    expect((await get(`/businesses/${owner.uniqueCode}/logo`)).status).toBe(404)
  })
})

describe('your data', () => {
  it('needs a session to export or delete feedback', async () => {
    expect((await get('/account/export')).status).toBe(401)
    expect(
      (
        await DELETE(
          new Request(`${base}/feedback/${crypto.randomUUID()}`, {
            method: 'DELETE',
          }),
        )
      ).status,
    ).toBe(401)
  })

  it('downloads the export as a JSON file', async () => {
    const owner = await createBusiness()
    const response = await get('/account/export', await sessionCookie(owner))
    expect(response.status).toBe(200)
    expect(response.headers.get('content-disposition')).toMatch(
      /^attachment; filename="pulse-export-\d{4}-\d{2}-\d{2}\.json"$/,
    )
    expect(
      ((await response.json()) as { account: { email: string } }).account.email,
    ).toBe(owner.email)
  })

  it("can't delete another owner's feedback", async () => {
    const owner = await createBusiness()
    const other = await createBusiness()
    const [row] = await db
      .insert(feedback)
      .values({ userId: other.id })
      .returning()
    const response = await DELETE(
      new Request(`${base}/feedback/${row.id}`, {
        method: 'DELETE',
        headers: { cookie: await sessionCookie(owner) },
      }),
    )
    expect(response.status).toBe(404)
  })

  it('runs the retention clean-up only for Vercel Cron', async () => {
    const run = (authorization?: string) =>
      retentionGET(
        new Request(`${base}/cron/retention`, {
          headers: authorization ? { authorization } : {},
        }),
      )
    expect((await run()).status).toBe(401)
    expect((await run('Bearer test-cron-secret')).status).toBe(200)
  })
})
