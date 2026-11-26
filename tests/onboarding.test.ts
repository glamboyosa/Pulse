import { eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { completeOnboardingAction } from '../app/actions/onboarding'
import { encrypt } from '../lib/session'
import { createBusiness, resetDatabase } from './support/db'
import { db } from '@/db/index'
import { users } from '@/db/schema'

const cookieJar = vi.hoisted(() => ({
  get: vi.fn(),
}))

vi.mock('next/headers', () => ({
  cookies: () => Promise.resolve(cookieJar),
}))
vi.mock('next/navigation', () => ({
  redirect: (path: string) => {
    throw new Error(`redirect:${path}`)
  },
}))

const signInAs = async (user: { id: string; email: string }) => {
  const token = await encrypt({
    userId: user.id,
    email: user.email,
    expiresAt: new Date(Date.now() + 3600_000),
  })
  cookieJar.get.mockReturnValue({ value: token })
}

const submitOnboarding = (fields: {
  businessName?: string | File
  businessType?: string | File
  uniqueCode?: string | File
  channel?: string
}) => {
  const form = new FormData()
  if (fields.businessName !== undefined) {
    form.append('businessName', fields.businessName)
  }
  if (fields.businessType !== undefined) {
    form.append('businessType', fields.businessType)
  }
  if (fields.uniqueCode !== undefined) {
    form.append('uniqueCode', fields.uniqueCode)
  }
  if (fields.channel !== undefined) {
    form.append('channel', fields.channel)
  }
  return completeOnboardingAction(undefined, form).catch(
    (error: Error) => error.message,
  )
}

beforeEach(async () => {
  await resetDatabase()
  cookieJar.get.mockReset()
})

describe('completeOnboardingAction', () => {
  it.each([
    'My-Cafe',
    'foo/bar',
    '../admin',
    'my cafe',
    'a',
    'a'.repeat(65),
    '-leading',
    'trailing-',
    'bad_underscore',
  ])(
    'rejects invalid uniqueCode %j without updating the user',
    async (badCode) => {
      const user = await createBusiness({ uniqueCode: null, isVerified: false })
      await signInAs(user)

      const result = await submitOnboarding({
        businessName: 'Test Setting 130',
        businessType: 'Restaurant',
        uniqueCode: badCode,
      })

      expect(result).toEqual({
        error:
          'Unique code must be 2 to 64 lowercase letters, numbers, or hyphens',
      })
      const [row] = await db.select().from(users).where(eq(users.id, user.id))
      expect(row.uniqueCode).toBeNull()
    },
  )

  it('rejects non-string FormData values safely', async () => {
    const user = await createBusiness({ uniqueCode: null, isVerified: false })
    await signInAs(user)

    const result = await submitOnboarding({
      businessName: 'Test Setting 130',
      businessType: 'Restaurant',
      uniqueCode: new File(['abc'], 'code.txt'),
    })

    expect(result).toEqual({ error: 'All fields are required' })
    const [row] = await db.select().from(users).where(eq(users.id, user.id))
    expect(row.uniqueCode).toBeNull()
  })

  it('prevents an already-onboarded user from overwriting their active uniqueCode', async () => {
    const user = await createBusiness({ uniqueCode: 'original-slug' })
    await signInAs(user)

    const result = await submitOnboarding({
      businessName: 'Renamed Cafe',
      businessType: 'Restaurant',
      uniqueCode: 'replacement-slug',
    })

    expect(result).toEqual({ error: 'Onboarding has already been completed' })
    const [row] = await db.select().from(users).where(eq(users.id, user.id))
    expect(row.uniqueCode).toBe('original-slug')
  })

  it('translates duplicate uniqueCode conflicts cleanly, even under concurrent submissions', async () => {
    const alice = await createBusiness({ uniqueCode: null, isVerified: false })
    const bob = await createBusiness({ uniqueCode: null, isVerified: false })

    const aliceToken = await encrypt({
      userId: alice.id,
      email: alice.email,
      expiresAt: new Date(Date.now() + 3600_000),
    })
    const bobToken = await encrypt({
      userId: bob.id,
      email: bob.email,
      expiresAt: new Date(Date.now() + 3600_000),
    })

    cookieJar.get
      .mockReturnValueOnce({ value: aliceToken })
      .mockReturnValueOnce({ value: bobToken })

    const results = await Promise.all([
      submitOnboarding({
        businessName: 'Cafe One',
        businessType: 'Restaurant',
        uniqueCode: 'shared-slug',
        channel: 'venue',
      }),
      submitOnboarding({
        businessName: 'Cafe Two',
        businessType: 'Restaurant',
        uniqueCode: 'shared-slug',
        channel: 'venue',
      }),
    ])

    expect(results).toContain('redirect:/dashboard')
    expect(results).toContainEqual({
      error: 'This unique code is already taken',
    })
  })
})
