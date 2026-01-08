import { createServerFn } from '@tanstack/react-start'
import { redirect } from '@tanstack/react-router'
import { and, desc, eq } from 'drizzle-orm'

import { db } from '@/db/index'
import { otpCodes, users } from '@/db/schema'
import { useAppSession } from '@/lib/session'
import { isOTPExpired } from '@/lib/otp'
import { getUserById } from '@/lib/auth-helpers'

// Login server function (OTP-based)
export const loginFn = createServerFn({ method: 'POST' })
  .inputValidator((data: { email: string; otpCode: string }) => data)
  .handler(async ({ data }) => {
    // Verify OTP directly (same logic as API route)
    const otp = await db
      .select()
      .from(otpCodes)
      .where(
        and(
          eq(otpCodes.email, data.email.toLowerCase()),
          eq(otpCodes.code, data.otpCode),
          eq(otpCodes.used, false),
        ),
      )
      .orderBy(desc(otpCodes.createdAt))
      .limit(1)

    if (otp.length === 0) {
      return { error: 'Invalid or expired code' }
    }

    const otpRecord = otp[0]

    // Check if expired
    if (isOTPExpired(otpRecord.expiresAt)) {
      return { error: 'Code has expired. Please request a new one.' }
    }

    // Mark OTP as used
    await db
      .update(otpCodes)
      .set({ used: true })
      .where(eq(otpCodes.id, otpRecord.id))

    // Find or create user
    let user = await db
      .select()
      .from(users)
      .where(eq(users.email, data.email.toLowerCase()))
      .limit(1)

    if (user.length === 0) {
      // Create new user
      const [newUser] = await db
        .insert(users)
        .values({
          email: data.email.toLowerCase(),
          isVerified: false, // User needs to complete onboarding
          pulsesRemaining: 0,
        })
        .returning()

      user = [newUser]
    }

    const userData = user[0]

    // Create session
    const session = await useAppSession()
    await session.update({
      userId: userData.id,
      email: userData.email,
    })

    // Redirect to dashboard or onboarding
    // Check uniqueCode from DB to determine if onboarding is complete
    if (!userData.uniqueCode) {
      throw redirect({ to: '/onboarding' })
    }

    throw redirect({ to: '/dashboard' })
  })

// Logout server function
export const logoutFn = createServerFn({ method: 'POST' }).handler(async () => {
  const session = await useAppSession()
  await session.clear()
  throw redirect({ to: '/' })
})

// Get current user
export const getCurrentUserFn = createServerFn({ method: 'GET' }).handler(
  async () => {
    const session = await useAppSession()
    const userId = session.data.userId

    if (!userId) {
      return null
    }

    // Get user from database using shared helper
    const user = await getUserById(userId)

    if (!user) {
      return null
    }

    return {
      id: user.id,
      email: user.email,
      name: user.businessName || user.email.split('@')[0] || 'User',
      businessName: user.businessName || null,
      businessType: user.businessType || null,
      uniqueCode: user.uniqueCode || null,
      isVerified: user.isVerified,
      pulsesRemaining: user.pulsesRemaining,
    }
  },
)
