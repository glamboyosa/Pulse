import { eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { loginAction } from '../app/actions/auth'
import { resetDatabase } from './support/db'
import { db } from '@/db/index'
import { otpCodes, users } from '@/db/schema'

const cookieJar = vi.hoisted(() => ({ set: vi.fn() }))
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
