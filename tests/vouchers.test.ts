import { eq, sql } from 'drizzle-orm'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { encrypt } from '../lib/session'
import { GET, POST, PUT } from '../app/api/[[...slugs]]/route'
import { createBusiness, resetDatabase } from './support/db'
import { feedback, vouchers } from '@/db/schema'
import { db } from '@/db/index'
import { analyseTranscript } from '@/lib/ai/text-analysis'
import { transcribeAudioWithElevenLabs } from '@/lib/ai/elevenlabs'
import {
  generateVoucherCode,
  normaliseVoucherCode,
  voucherExpiry,
} from '@/server/vouchers'
import { deleteAccount, deleteFeedback } from '@/server/account-data'

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
  getAudioUrl: vi.fn(),
}))
vi.mock('@/lib/ai/elevenlabs', () => ({
  transcribeAudioWithElevenLabs: vi.fn(),
}))
vi.mock('@/lib/ai/text-analysis', () => ({ analyseTranscript: vi.fn() }))
vi.mock('@/lib/email/feedback-received', () => ({
  sendFeedbackReceivedEmail: vi.fn().mockResolvedValue(undefined),
}))
vi.mock('@/lib/email/low-pulse', () => ({
  sendLowPulseEmail: vi.fn().mockResolvedValue(undefined),
}))
vi.mock('@/server/turnstile', () => ({
  passesTurnstile: vi.fn().mockResolvedValue(true),
}))

const base = 'https://pulse.test/api'
const TYPED = 'The jollof was great but the wait was long.'

const analysis = (sentiment: 'positive' | 'negative') => ({
  sentiment,
  customerName: null,
  language: 'English',
  englishTranslation: null,
  summary: 'A note.',
  themes: [] as Array<string>,
})

const sessionCookie = async (user: { id: string; email: string }) =>
  `session=${await encrypt({ userId: user.id, email: user.email, expiresAt: new Date(Date.now() + 3600_000) })}`

const request = (
  method: string,
  path: string,
  { body, cookie, ip }: { body?: unknown; cookie?: string; ip?: string } = {},
) =>
  new Request(`${base}${path}`, {
    method,
    headers: {
      'content-type': 'application/json',
      'x-forwarded-for': ip ?? '10.0.0.1',
      ...(cookie ? { cookie } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })

const turnOnVouchers = async (
  owner: { id: string; email: string },
  overrides: Record<string, unknown> = {},
) => {
  const response = await PUT(
    request('PUT', '/settings/vouchers', {
      cookie: await sessionCookie(owner),
      body: {
        enabled: true,
        offer: '10% off your next visit',
        expiryDays: 30,
        monthlyCap: 50,
        ...overrides,
      },
    }),
  )
  expect(response.status).toBe(200)
}

/** Sends typed feedback and finishes its analysis, as `after` would. */
const sendTyped = async (code: string, text = TYPED, ip?: string) => {
  const response = await POST(
    request('POST', '/feedback/submit-text', { body: { code, text }, ip }),
  )
  expect(response.status).toBe(200)
  const { feedbackId } = (await response.json()) as { feedbackId: string }
  await background.tasks.pop()?.()
  return feedbackId
}

type Claim = {
  status: string
  reason?: string
  voucher?: { code: string; offer: string; expiresAt: string }
}

const claim = async (
  feedbackId: string,
  options: { cookie?: string; ip?: string } = {},
) => {
  const response = await GET(
    request('GET', `/feedback/${feedbackId}/voucher`, options),
  )
  return {
    body: (await response.json()) as Claim,
    cookie: response.headers.get('set-cookie')?.split(';')[0],
  }
}

beforeEach(async () => {
  await resetDatabase()
  background.tasks.length = 0
  vi.mocked(analyseTranscript).mockResolvedValue(analysis('positive'))
  vi.mocked(transcribeAudioWithElevenLabs).mockResolvedValue(
    'The staff were friendly and quick tonight.',
  )
})

describe('voucher codes', () => {
  it('are six characters with no lookalike letters or digits', () => {
    for (let i = 0; i < 200; i += 1) {
      expect(generateVoucherCode()).toMatch(/^[A-HJKMNP-Z2-9]{6}$/)
    }
  })

  it('accept typed codes in any case, with spaces or a dash', () => {
    expect(normaliseVoucherCode(' k7p-q4x ')).toBe('K7PQ4X')
    expect(normaliseVoucherCode('K7PQ4')).toBeNull()
    expect(normaliseVoucherCode('K0PQ4X')).toBeNull()
  })
})

describe('voucher expiry', () => {
  it('lasts to the end of the last day, so a voucher is good all day on the date shown', () => {
    expect(
      voucherExpiry(new Date('2026-11-12T18:40:00Z'), 30).toISOString(),
    ).toBe('2026-12-12T23:59:59.999Z')
  })

  it('counts days in UTC, across a month end and the start of a day', () => {
    expect(
      voucherExpiry(new Date('2026-12-31T00:05:00Z'), 1).toISOString(),
    ).toBe('2027-01-01T23:59:59.999Z')
  })
})

describe('owner settings', () => {
  it('need an offer before vouchers can be turned on', async () => {
    const owner = await createBusiness()
    const response = await PUT(
      request('PUT', '/settings/vouchers', {
        cookie: await sessionCookie(owner),
        body: { enabled: true, offer: ' ', expiryDays: 30, monthlyCap: 50 },
      }),
    )
    expect(response.status).toBe(400)
  })

  it('require a session', async () => {
    const response = await PUT(
      request('PUT', '/settings/vouchers', {
        body: { enabled: true, offer: 'x', expiryDays: 30, monthlyCap: 50 },
      }),
    )
    expect(response.status).toBe(401)
  })

  it('show the offer on the feedback page only while vouchers are on', async () => {
    const owner = await createBusiness()
    const status = async () =>
      (await (
        await GET(request('GET', `/businesses/${owner.uniqueCode}/status`))
      ).json()) as { offer: string | null }
    expect((await status()).offer).toBeNull()
    await turnOnVouchers(owner)
    expect((await status()).offer).toBe('10% off your next visit')
  })
})

describe('issuing vouchers', () => {
  it('waits for the note to be analysed, then issues one voucher per note', async () => {
    const owner = await createBusiness()
    await turnOnVouchers(owner, { expiryDays: 14 })
    const response = await POST(
      request('POST', '/feedback/submit-text', {
        body: { code: owner.uniqueCode, text: TYPED },
      }),
    )
    const { feedbackId } = (await response.json()) as { feedbackId: string }

    expect((await claim(feedbackId)).body).toEqual({ status: 'pending' })
    await background.tasks.pop()?.()

    const before = new Date()
    const first = await claim(feedbackId)
    expect(first.body.status).toBe('issued')
    expect(first.body.voucher?.offer).toBe('10% off your next visit')
    // Either side of midnight UTC if the test runs across it.
    expect([
      voucherExpiry(before, 14).toISOString(),
      voucherExpiry(new Date(), 14).toISOString(),
    ]).toContain(first.body.voucher!.expiresAt)
    expect(first.cookie).toMatch(/^pulse_voucher_/)

    // Asking again, even with the cookie now set, returns the same voucher.
    const again = await claim(feedbackId, { cookie: first.cookie })
    expect(again.body.voucher?.code).toBe(first.body.voucher?.code)
    expect(await db.select().from(vouchers)).toHaveLength(1)
  })

  it('gives unhappy customers the same voucher as happy ones', async () => {
    const owner = await createBusiness()
    await turnOnVouchers(owner)
    vi.mocked(analyseTranscript).mockResolvedValue(analysis('negative'))
    const negative = await claim(await sendTyped(owner.uniqueCode!))
    vi.mocked(analyseTranscript).mockResolvedValue(analysis('positive'))
    const positive = await claim(
      await sendTyped(owner.uniqueCode!, TYPED, '10.0.0.2'),
    )
    expect(negative.body.status).toBe('issued')
    expect(positive.body.status).toBe('issued')
    expect(negative.body.voucher?.offer).toBe(positive.body.voucher?.offer)
  })

  it('keeps the offer a voucher was issued with when the owner edits it', async () => {
    const owner = await createBusiness()
    await turnOnVouchers(owner)
    const { body } = await claim(await sendTyped(owner.uniqueCode!))
    await turnOnVouchers(owner, { offer: 'A free drink' })
    const response = await GET(
      request('GET', `/vouchers/${body.voucher!.code}`, {
        cookie: await sessionCookie(owner),
      }),
    )
    const { voucher } = (await response.json()) as { voucher: Claim['voucher'] }
    expect(voucher?.offer).toBe('10% off your next visit')
  })

  it('skips short typed notes and recordings without real speech', async () => {
    const owner = await createBusiness()
    await turnOnVouchers(owner)
    const short = await claim(await sendTyped(owner.uniqueCode!, 'Good food'))
    expect(short.body).toEqual({ status: 'none', reason: 'too-short' })

    vi.mocked(transcribeAudioWithElevenLabs).mockResolvedValue('Nice.')
    const form = new FormData()
    form.append('code', owner.uniqueCode!)
    form.append(
      'audio',
      new Blob([new Uint8Array(2048)], { type: 'audio/mp4' }),
    )
    form.append('duration', '8')
    const response = await POST(
      new Request(`${base}/feedback/submit`, {
        method: 'POST',
        headers: { 'x-forwarded-for': '10.0.0.9' },
        body: form,
      }),
    )
    const { feedbackId } = (await response.json()) as { feedbackId: string }
    await background.tasks.pop()?.()
    expect((await claim(feedbackId, { ip: '10.0.0.9' })).body).toEqual({
      status: 'none',
      reason: 'too-short',
    })
  })

  it('gives one voucher per browser per business', async () => {
    const owner = await createBusiness()
    await turnOnVouchers(owner)
    const first = await claim(await sendTyped(owner.uniqueCode!))
    const second = await claim(
      await sendTyped(owner.uniqueCode!, TYPED, '10.0.0.2'),
      { cookie: first.cookie, ip: '10.0.0.2' },
    )
    expect(second.body).toEqual({ status: 'none', reason: 'already' })

    // The same browser can still earn one from a different business.
    const other = await createBusiness()
    await turnOnVouchers(other)
    const elsewhere = await claim(await sendTyped(other.uniqueCode!), {
      cookie: first.cookie,
    })
    expect(elsewhere.body.status).toBe('issued')
  })

  it('limits vouchers per connection when cookies are cleared', async () => {
    const owner = await createBusiness({ pulsesRemaining: 10 })
    await turnOnVouchers(owner)
    const statuses = []
    for (let i = 0; i < 4; i += 1) {
      statuses.push((await claim(await sendTyped(owner.uniqueCode!))).body)
    }
    expect(statuses.slice(0, 3).map((s) => s.status)).toEqual([
      'issued',
      'issued',
      'issued',
    ])
    expect(statuses[3]).toEqual({ status: 'none', reason: 'already' })
  })

  it('stops at the monthly cap and hides the offer', async () => {
    const owner = await createBusiness()
    await turnOnVouchers(owner, { monthlyCap: 1 })
    expect(
      (await claim(await sendTyped(owner.uniqueCode!, TYPED, '10.0.0.1'))).body
        .status,
    ).toBe('issued')
    const over = await claim(
      await sendTyped(owner.uniqueCode!, TYPED, '10.0.0.2'),
      { ip: '10.0.0.2' },
    )
    expect(over.body).toEqual({ status: 'none', reason: 'unavailable' })
    const status = (await (
      await GET(request('GET', `/businesses/${owner.uniqueCode}/status`))
    ).json()) as { offer: string | null }
    expect(status.offer).toBeNull()
  })

  it('never issues while vouchers are off, or for widget notes or old notes', async () => {
    const owner = await createBusiness()
    await turnOnVouchers(owner, { enabled: false })
    const whileOff = await sendTyped(owner.uniqueCode!)
    expect((await claim(whileOff)).body.status).toBe('none')

    await turnOnVouchers(owner)
    const [widgetNote] = await db
      .insert(feedback)
      .values({
        userId: owner.id,
        channel: 'widget',
        source: 'text',
        transcript: TYPED,
      })
      .returning()
    expect((await claim(widgetNote.id)).body).toEqual({
      status: 'none',
      reason: 'unavailable',
    })

    const old = await sendTyped(owner.uniqueCode!, TYPED, '10.0.0.3')
    await db
      .update(feedback)
      .set({ createdAt: sql`now() - interval '2 hours'` })
      .where(eq(feedback.id, old))
    expect((await claim(old, { ip: '10.0.0.3' })).body).toEqual({
      status: 'none',
      reason: 'unavailable',
    })
  })

  it('gives the last voucher under the cap to only one of two notes claimed at once', async () => {
    const owner = await createBusiness()
    await turnOnVouchers(owner, { monthlyCap: 1 })
    const a = await sendTyped(owner.uniqueCode!, TYPED, '10.0.0.1')
    const b = await sendTyped(owner.uniqueCode!, TYPED, '10.0.0.2')
    const claims = await Promise.all([
      claim(a, { ip: '10.0.0.1' }),
      claim(b, { ip: '10.0.0.2' }),
    ])
    expect(claims.map((c) => c.body.status).sort()).toEqual(['issued', 'none'])
    expect(await db.select().from(vouchers)).toHaveLength(1)
  })

  it('issues one voucher when the same note is claimed twice at once', async () => {
    const owner = await createBusiness()
    await turnOnVouchers(owner)
    const feedbackId = await sendTyped(owner.uniqueCode!)
    const [first, second] = await Promise.all([
      claim(feedbackId),
      claim(feedbackId),
    ])
    expect(first.body.voucher?.code).toBeDefined()
    expect(second.body.voucher?.code).toBe(first.body.voucher?.code)
    expect(await db.select().from(vouchers)).toHaveLength(1)
  })

  it('tells the customer when their note could not be processed', async () => {
    const owner = await createBusiness()
    await turnOnVouchers(owner)
    const feedbackId = await sendTyped(owner.uniqueCode!)
    await db
      .update(feedback)
      .set({ status: 'failed' })
      .where(eq(feedback.id, feedbackId))
    expect((await claim(feedbackId)).body).toEqual({
      status: 'none',
      reason: 'failed',
    })
  })

  it('returns 404 for a note that does not exist', async () => {
    const response = await GET(
      request('GET', `/feedback/${crypto.randomUUID()}/voucher`),
    )
    expect(response.status).toBe(404)
  })
})

describe('redeeming vouchers', () => {
  const issue = async () => {
    const owner = await createBusiness()
    await turnOnVouchers(owner)
    const { body } = await claim(await sendTyped(owner.uniqueCode!))
    return {
      owner,
      code: body.voucher!.code,
      cookie: await sessionCookie(owner),
    }
  }

  const redeem = (code: string, cookie?: string) =>
    POST(request('POST', `/vouchers/${code}/redeem`, { cookie }))

  it('redeems a valid voucher once, then refuses it', async () => {
    const { code, cookie } = await issue()
    const check = await GET(
      request('GET', `/vouchers/${code.toLowerCase()}`, { cookie }),
    )
    expect(
      ((await check.json()) as { voucher: { state: string } }).voucher.state,
    ).toBe('valid')

    const first = await redeem(code, cookie)
    expect(first.status).toBe(200)
    const second = await redeem(code, cookie)
    expect(second.status).toBe(409)
    expect(await second.json()).toMatchObject({
      error: 'Already redeemed',
      voucher: { state: 'redeemed' },
    })
  })

  it('lets only one of two simultaneous redeems succeed', async () => {
    const { code, cookie } = await issue()
    const results = await Promise.all([
      redeem(code, cookie),
      redeem(code, cookie),
    ])
    expect(results.map((r) => r.status).sort()).toEqual([200, 409])
  })

  it('refuses an expired voucher', async () => {
    const { code, cookie } = await issue()
    await db
      .update(vouchers)
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .where(eq(vouchers.code, code))
    const response = await redeem(code, cookie)
    expect(response.status).toBe(409)
    expect(await response.json()).toMatchObject({
      error: 'This voucher has expired',
      voucher: { state: 'expired' },
    })
  })

  it("can't see or redeem another business's voucher, or redeem signed out", async () => {
    const { code } = await issue()
    const stranger = await createBusiness()
    const strangerCookie = await sessionCookie(stranger)
    expect(
      (
        await GET(
          request('GET', `/vouchers/${code}`, { cookie: strangerCookie }),
        )
      ).status,
    ).toBe(404)
    expect((await redeem(code, strangerCookie)).status).toBe(404)
    expect((await redeem(code)).status).toBe(401)
  })
})

describe('deleting data', () => {
  it('keeps a voucher when its note is deleted, and removes it with the account', async () => {
    const owner = await createBusiness()
    await turnOnVouchers(owner)
    const feedbackId = await sendTyped(owner.uniqueCode!)
    expect((await claim(feedbackId)).body.status).toBe('issued')

    await deleteFeedback(owner.id, feedbackId)
    expect(await db.select().from(vouchers)).toHaveLength(1)

    await deleteAccount(owner.id)
    expect(await db.select().from(vouchers)).toHaveLength(0)
  })
})
