import { db } from '@/db/index'
import { users } from '@/db/schema'
import { eq } from 'drizzle-orm'

/**
 * Get user by email
 * TODO: In production, get from session/token
 */
export async function getUser(email?: string) {
  if (!email) {
    // TODO: Get from session/cookie
    return null
  }

  const user = await db
    .select()
    .from(users)
    .where(eq(users.email, email.toLowerCase()))
    .limit(1)

  if (user.length === 0) {
    return null
  }

  return {
    id: user[0].id,
    email: user[0].email,
    name: user[0].businessName || user[0].email.split('@')[0] || 'User',
    businessName: user[0].businessName || null,
    businessType: user[0].businessType || null,
    uniqueCode: user[0].uniqueCode || null,
    isVerified: user[0].isVerified,
    pulsesRemaining: user[0].pulsesRemaining,
  }
}

/**
 * Get user by unique code (for feedback pages)
 */
export async function getUserByUniqueCode(uniqueCode: string) {
  const user = await db
    .select()
    .from(users)
    .where(eq(users.uniqueCode, uniqueCode))
    .limit(1)

  if (user.length === 0) {
    return null
  }

  return user[0]
}

