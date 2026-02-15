'use server'

import { redirect } from 'next/navigation'
import { and, desc, eq } from 'drizzle-orm'

import { db } from '@/db/index'
import { otpCodes, users } from '@/db/schema'
import { createSession, deleteSession, getSession } from '../../lib/session'
import { isOTPExpired } from '@/lib/otp'
import { getUserById } from '@/lib/auth-helpers'

export async function loginAction(
  prevState: { error?: string } | undefined,
  formData: FormData,
): Promise<{ error: string } | never> {
  const email = formData.get('email') as string
  const otpCode = formData.get('otpCode') as string

  if (!email || !otpCode) {
    return { error: 'Email and OTP code are required' }
  }

  // Verify OTP
  const otp = await db
    .select()
    .from(otpCodes)
    .where(
      and(
        eq(otpCodes.email, email.toLowerCase()),
        eq(otpCodes.code, otpCode),
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
    .where(eq(users.email, email.toLowerCase()))
    .limit(1)

  if (user.length === 0) {
    // Create new user
    const [newUser] = await db
      .insert(users)
      .values({
        email: email.toLowerCase(),
        isVerified: false,
        pulsesRemaining: 3,
      })
      .returning()

    user = [newUser]
  }

  const userData = user[0]

  // Create session - must complete before redirect
  await createSession(userData.id, userData.email)

  // Redirect to dashboard or onboarding
  // redirect() throws NEXT_REDIRECT which Next.js handles automatically
  // In Server Actions, this returns a 303 redirect response
  if (!userData.uniqueCode) {
    redirect('/onboarding')
  }

  redirect('/dashboard')
}

export async function logoutAction() {
  await deleteSession()
  redirect('/')
}

export async function getCurrentUser() {
  const session = await getSession()

  if (!session) {
    return null
  }

  const user = await getUserById(session.userId)

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
    pulsesRemaining: Math.max(0, user.pulsesRemaining), // Ensure no negative values
  }
}
