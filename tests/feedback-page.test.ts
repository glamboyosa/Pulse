import { beforeEach, describe, expect, it, vi } from 'vitest'

import FeedbackPage from '../app/feedback/[id]/page'
import { createBusiness, resetDatabase } from './support/db'

const currentUser = vi.hoisted(() => ({ value: null as unknown }))
vi.mock('../app/actions/auth', () => ({
  getCurrentUser: () => Promise.resolve(currentUser.value),
}))
vi.mock('next/server', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  after: vi.fn(),
}))
vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('NEXT_NOT_FOUND')
  },
  redirect: (path: string) => {
    throw new Error(`redirect:${path}`)
  },
}))

beforeEach(async () => {
  await resetDatabase()
  currentUser.value = null
})

describe('FeedbackPage', () => {
  it('calls notFound() for non-UUID feedback ids instead of throwing a database error', async () => {
    const owner = await createBusiness()
    currentUser.value = { id: owner.id, email: owner.email }

    await expect(
      FeedbackPage({ params: Promise.resolve({ id: 'not-a-uuid' }) }),
    ).rejects.toThrow('NEXT_NOT_FOUND')
  })
})
