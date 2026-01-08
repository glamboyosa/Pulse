import { eq } from 'drizzle-orm'

import { db } from '@/db/index'
import { users } from '@/db/schema'

/**
 * Get user by ID from database
 * Shared helper that can be used in both server functions and API routes
 */
export async function getUserById(userId: string) {
  const user = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)

  if (user.length === 0) {
    return null
  }

  return user[0]
}

/**
 * Get user from session (works in both Next.js and Elysia contexts)
 * In Next.js: Uses cookies() API
 * In Elysia: Uses request headers
 */
export async function getUserFromSession(request?: Request) {
  try {
    let sessionToken: string | undefined

    if (request) {
      // Elysia context - get cookie from request headers
      const cookieHeader = request.headers.get('cookie') || ''
      const cookies = cookieHeader.split(';').reduce((acc, cookie) => {
        const [key, value] = cookie.trim().split('=')
        acc[key] = value
        return acc
      }, {} as Record<string, string>)
      sessionToken = cookies.session
    } else {
      // Next.js context - use cookies() API
      const { cookies: cookieStore } = await import('next/headers')
      const cookieStoreInstance = await cookieStore()
      sessionToken = cookieStoreInstance.get('session')?.value
    }

    if (!sessionToken) {
      return null
    }

    // Decrypt session token
    const { decrypt } = await import('../../lib/session')
    const session = await decrypt(sessionToken)

    if (!session || !session.userId) {
      return null
    }

    return await getUserById(session.userId)
  } catch (error) {
    console.error('Error getting user from session:', error)
    return null
  }
}
