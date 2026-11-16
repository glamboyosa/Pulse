import { eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { deleteAccountAction, loginAction } from '../app/actions/auth'
import { encrypt } from '../lib/session'
import { createBusiness, resetDatabase } from './support/db'
import { deleteAccount } from '@/server/account-data'
import { db } from '@/db/index'
import { otpCodes, users } from '@/db/schema'

const afterCallbacks = vi.hoisted(() => {
  process.env.SIGNUP_ALERT_EMAIL = 'founder@example.test'
  return [] as Array<() => Promise<void>>
})
vi.mock('next/server', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  after: (callback: () => Promise<void>) => afterCallbacks.push(callback),
}))
const sendSignupAlert = vi.hoisted(() => vi.fn())
vi.mock('@/lib/email/signup-alert', () => ({ sendSignupAlert }))

const cookieJar = vi.hoisted(() => ({
  set: vi.fn(),
  get: vi.fn(),
  delete: vi.fn(),
}))
vi.mock('@/lib/storage/r2', () => ({
  deleteAudio: vi.fn().mockResolvedValue(undefined),
}))
// The connection a request comes from, as Vercel passes it on.
const request = vi.hoisted(() => ({
  headers: { 'x-forwarded-for': '203.0.113.7' } as Record<string, string>,
}))
vi.mock('next/headers', () => ({
  cookies: () => Promise.resolve(cookieJar),
  headers: () => Promise.resolve(new Headers(request.headers)),
}))
vi.mock('next/navigation', () => ({
  redirect: (path: string) => {
    throw new Error(`redirect:${path}`)
  },
}))

const email = 'owner@example.test'

const issueCode = (
  code: string,
  overrides: Partial<typeof otpCodes.$inferInsert> = {},
) =>
  db.insert(otpCodes).values({
    email: overrides.email ?? email,
    code,
    expiresAt: new Date(Date.now() + 10 * 60_000),
    ...overrides,
  })

const login = (otpCode: string, as = email) => {
  const form = new FormData()
  form.append('email', as)
  form.append('otpCode', otpCode)
  return loginAction(undefined, form).catch((error: Error) => error.message)
}

beforeEach(async () => {
  await resetDatabase()
  cookieJar.set.mockClear()
  cookieJar.get.mockReset()
  cookieJar.delete.mockClear()
  afterCallbacks.length = 0
  request.headers = { 'x-forwarded-for': '203.0.113.7' }
  sendSignupAlert.mockReset().mockResolvedValue(undefined)
})

const arrivedFrom = (value: string) =>
  cookieJar.get.mockImplementation((name: string) =>
    name === 'pulse_ref' ? { value } : undefined,
  )
const signedUp = async () =>
  (await db.select().from(users).where(eq(users.email, email)))[0]

describe('free pulses', () => {
  const signUp = async (
    address: string,
    headers: Record<string, string> = { 'x-forwarded-for': '198.51.100.1' },
  ) => {
    request.headers = headers
    await issueCode('123456', { email: address })
    expect(await login('123456', address)).toBe('redirect:/onboarding')
    return (await db.select().from(users).where(eq(users.email, address)))[0]
  }
  const from = (ip: string) => ({ 'x-forwarded-for': ip })

  it('gives none to another spelling of an inbox that already has an account', async () => {
    expect(
      (await signUp('ada.lovelace@gmail.com', from('198.51.100.1')))
        .pulsesRemaining,
    ).toBe(5)
    expect(
      (await signUp('adalovelace+cafe2@gmail.com', from('198.51.100.2')))
        .pulsesRemaining,
    ).toBe(0)
    expect(
      (await signUp('ada+two@example.test', from('198.51.100.3')))
        .pulsesRemaining,
    ).toBe(5)
    expect(
      (await signUp('ada+three@example.test', from('198.51.100.4')))
        .pulsesRemaining,
    ).toBe(0)
  })

  it('gives none after the account is deleted and the inbox signs up again', async () => {
    const first = await signUp('sam@example.test', from('198.51.100.5'))
    expect(first.pulsesRemaining).toBe(5)
    await deleteAccount(first.id)
    const again = await signUp('sam@example.test', from('198.51.100.6'))
    expect(again.pulsesRemaining).toBe(0)
    // Kept on the account, so the dashboard can say why.
    expect(again.freePulsesWithheld).toBe('inbox')
  })

  it('gives them to three new accounts per connection in 30 days, then none', async () => {
    for (const address of [
      'a@example.test',
      'b@example.test',
      'c@example.test',
    ]) {
      expect(
        (await signUp(address, from('198.51.100.9'))).pulsesRemaining,
      ).toBe(5)
    }
    const fourth = await signUp('d@example.test', from('198.51.100.9'))
    expect(fourth.pulsesRemaining).toBe(0)
    expect(fourth.freePulsesWithheld).toBe('connection')
    expect(
      (await signUp('e@example.test', from('198.51.100.10'))).pulsesRemaining,
    ).toBe(5)
  })

  it("doesn't let a repeat inbox use up a connection's turns", async () => {
    await signUp('one@example.test', from('198.51.100.30'))
    for (const repeat of [
      'one+a@example.test',
      'one+b@example.test',
      'one+c@example.test',
    ]) {
      expect(
        (await signUp(repeat, from('198.51.100.31'))).pulsesRemaining,
      ).toBe(0)
    }
    for (const address of [
      'x@example.test',
      'y@example.test',
      'z@example.test',
    ]) {
      expect(
        (await signUp(address, from('198.51.100.31'))).pulsesRemaining,
      ).toBe(5)
    }
  })

  it("counts a phone's whole IPv6 block as one connection", async () => {
    const block = [
      '2001:db8:a:b::1',
      '2001:db8:a:b:ffff::2',
      '2001:0db8:000a:000b:1:2:3:4',
      '2001:db8:a:b::9',
    ]
    const pulses = []
    for (const [i, ip] of block.entries()) {
      pulses.push(
        (await signUp(`v6-${i}@example.test`, from(ip))).pulsesRemaining,
      )
    }
    expect(pulses).toEqual([5, 5, 5, 0])
  })

  it('reads x-real-ip, and still gives them when no address is known', async () => {
    for (const address of [
      'p@example.test',
      'q@example.test',
      'r@example.test',
    ]) {
      await signUp(address, { 'x-real-ip': '198.51.100.40' })
    }
    expect(
      (await signUp('s@example.test', { 'x-real-ip': '198.51.100.40' }))
        .pulsesRemaining,
    ).toBe(0)
    expect((await signUp('t@example.test', {})).pulsesRemaining).toBe(5)
  })

  it('tells the founder why a signup got none', async () => {
    await signUp('grace@gmail.com', from('198.51.100.20'))
    await signUp('g.race@gmail.com', from('198.51.100.21'))
    await Promise.all(afterCallbacks.map((callback) => callback()))
    expect(sendSignupAlert).toHaveBeenLastCalledWith(
      expect.objectContaining({
        email: 'g.race@gmail.com',
        noFreePulses: 'inbox',
      }),
    )
  })
})

describe('loginAction', () => {
  it('signs a new owner in with 5 free pulses and sends them to onboarding', async () => {
    await issueCode('123456')
    expect(await login('123456')).toBe('redirect:/onboarding')

    const [owner] = await db.select().from(users).where(eq(users.email, email))
    expect(owner.pulsesRemaining).toBe(5)
    expect(cookieJar.set).toHaveBeenCalledWith(
      'session',
      expect.any(String),
      expect.anything(),
    )
  })

  it('records the tagged link a new owner came from and tells the founder', async () => {
    arrivedFrom('meta/ng-founders')
    await issueCode('123456')
    await login('123456')
    expect((await signedUp()).signupSource).toBe('meta/ng-founders')

    expect(sendSignupAlert).not.toHaveBeenCalled()
    await Promise.all(afterCallbacks.map((callback) => callback()))
    expect(sendSignupAlert).toHaveBeenCalledWith({
      to: 'founder@example.test',
      email,
      source: 'meta/ng-founders',
      noFreePulses: null,
    })
  })

  it('ignores a source cookie that has been tampered with', async () => {
    arrivedFrom('meta/ng/<script>')
    await issueCode('123456')
    await login('123456')
    expect((await signedUp()).signupSource).toBeNull()
  })

  it('a failed alert does not break the login', async () => {
    sendSignupAlert.mockRejectedValue(new Error('Resend is down'))
    const quiet = vi.spyOn(console, 'error').mockImplementation(() => {})
    await issueCode('123456')
    expect(await login('123456')).toBe('redirect:/onboarding')
    await Promise.all(afterCallbacks.map((callback) => callback()))
    expect(quiet).toHaveBeenCalled()
    quiet.mockRestore()
  })

  it('only alerts for new owners, not returning ones', async () => {
    await createBusiness({ email })
    await issueCode('123456')
    await login('123456')
    expect(afterCallbacks).toHaveLength(0)
  })

  it('accepts a code only once', async () => {
    await issueCode('123456')
    await login('123456')
    expect(await login('123456')).toEqual({
      error: 'Invalid or expired code. Please request a new one.',
    })
  })

  it('refuses an expired code', async () => {
    await issueCode('123456', { expiresAt: new Date(Date.now() - 1000) })
    expect(await login('123456')).toEqual({
      error: 'Invalid or expired code. Please request a new one.',
    })
  })

  it('burns the code after 5 wrong guesses, even the right code after that', async () => {
    await issueCode('123456')
    for (let i = 0; i < 5; i++) {
      expect(await login('000000')).toEqual({
        error: 'That code is not right. Check the email and try again.',
      })
    }
    expect(await login('123456')).toEqual({
      error: 'Invalid or expired code. Please request a new one.',
    })
  })

  it('allows only 5 guesses even when they all arrive at once', async () => {
    await issueCode('123456')
    const results = await Promise.all(
      Array.from({ length: 30 }, () => login('000000')),
    )
    const compared = results.filter(
      (r) =>
        typeof r === 'object' && r.error.startsWith('That code is not right'),
    )
    expect(compared).toHaveLength(5)
    const [row] = await db.select().from(otpCodes)
    expect(row.attempts).toBe(5)
  })
})

describe('deleteAccountAction', () => {
  const signedInAs = async (user: { id: string; email: string }) => {
    const token = await encrypt({
      userId: user.id,
      email: user.email,
      expiresAt: new Date(Date.now() + 3600_000),
    })
    cookieJar.get.mockReturnValue({ value: token })
  }
  const confirm = (word: string) => {
    const form = new FormData()
    form.append('confirm', word)
    return deleteAccountAction(undefined, form).catch((e: Error) => e.message)
  }

  it('refuses unless the owner types their feedback code', async () => {
    const owner = await createBusiness()
    await signedInAs(owner)
    expect(await confirm('delete')).toEqual({
      error: 'Type your feedback code exactly to confirm.',
    })
    expect(
      await db.select().from(users).where(eq(users.id, owner.id)),
    ).toHaveLength(1)
  })

  it('deletes the account and signs the owner out', async () => {
    const owner = await createBusiness()
    await signedInAs(owner)
    expect(await confirm(` ${owner.uniqueCode} `)).toBe('redirect:/')
    expect(
      await db.select().from(users).where(eq(users.id, owner.id)),
    ).toHaveLength(0)
    expect(cookieJar.delete).toHaveBeenCalledWith('session')
  })
})
