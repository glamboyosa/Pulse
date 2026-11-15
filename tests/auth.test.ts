import { eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { deleteAccountAction, loginAction } from '../app/actions/auth'
import { encrypt } from '../lib/session'
import { createBusiness, resetDatabase } from './support/db'
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
vi.mock('next/headers', () => ({
  cookies: () => Promise.resolve(cookieJar),
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
    email,
    code,
    expiresAt: new Date(Date.now() + 10 * 60_000),
    ...overrides,
  })

const login = (otpCode: string) => {
  const form = new FormData()
  form.append('email', email)
  form.append('otpCode', otpCode)
  return loginAction(undefined, form).catch((error: Error) => error.message)
}

beforeEach(async () => {
  await resetDatabase()
  cookieJar.set.mockClear()
  cookieJar.get.mockReset()
  cookieJar.delete.mockClear()
  afterCallbacks.length = 0
  sendSignupAlert.mockReset().mockResolvedValue(undefined)
})

const arrivedFrom = (value: string) =>
  cookieJar.get.mockImplementation((name: string) =>
    name === 'pulse_ref' ? { value } : undefined,
  )
const signedUp = async () =>
  (await db.select().from(users).where(eq(users.email, email)))[0]

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
