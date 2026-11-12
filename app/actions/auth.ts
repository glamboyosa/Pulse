'use server'

import { redirect } from 'next/navigation'
import { and, desc, eq, gt, lt, sql } from 'drizzle-orm'

import { createSession, deleteSession, getSession } from '../../lib/session'
import { db } from '@/db/index'
import { otpCodes, users } from '@/db/schema'
import { OTP_MAX_ATTEMPTS } from '@/lib/otp'
import { getUserById } from '@/lib/auth-helpers'
import { dashboardReturnPath } from '@/lib/return-path'
import { deleteAccount } from '@/server/account-data'

// New businesses get this many pulses to try Pulse.
const FREE_PULSES_ON_SIGNUP = 5

export async function loginAction(
  prevState: { error?: string } | undefined,
  formData: FormData,
): Promise<{ error: string } | never> {
  const email = formData.get('email') as string
  const otpCode = formData.get('otpCode') as string

  if (!email || !otpCode) {
    return { error: 'Email and OTP code are required' }
  }

  const latest = (
    await db
      .select({ id: otpCodes.id })
      .from(otpCodes)
      .where(
        and(eq(otpCodes.email, email.toLowerCase()), eq(otpCodes.used, false)),
      )
      .orderBy(desc(otpCodes.createdAt))
      .limit(1)
  ).at(0)

  // Every guess is counted in the same statement that checks the limit, so
  // parallel requests can't get more than OTP_MAX_ATTEMPTS guesses at a code.
  const otpRecord = latest
    ? (
        await db
          .update(otpCodes)
          .set({ attempts: sql`${otpCodes.attempts} + 1` })
          .where(
            and(
              eq(otpCodes.id, latest.id),
              eq(otpCodes.used, false),
              lt(otpCodes.attempts, OTP_MAX_ATTEMPTS),
              gt(otpCodes.expiresAt, new Date()),
            ),
          )
          .returning({ id: otpCodes.id, code: otpCodes.code })
      ).at(0)
    : undefined

  if (!otpRecord) {
    return { error: 'Invalid or expired code. Please request a new one.' }
  }

  if (otpRecord.code !== otpCode.trim()) {
    return { error: 'That code is not right. Check the email and try again.' }
  }

  // Mark the code used; the condition makes a second use of the same code fail.
  const consumed = await db
    .update(otpCodes)
    .set({ used: true })
    .where(and(eq(otpCodes.id, otpRecord.id), eq(otpCodes.used, false)))
    .returning({ id: otpCodes.id })
  if (consumed.length === 0) {
    return { error: 'Invalid or expired code. Please request a new one.' }
  }

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
        pulsesRemaining: FREE_PULSES_ON_SIGNUP,
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

  redirect(dashboardReturnPath(formData.get('next')))
}

/**
 * Deletes the signed-in owner's account after they type their feedback code
 * to confirm, then signs them out.
 */
export async function deleteAccountAction(
  _prev: { error?: string } | undefined,
  formData: FormData,
): Promise<{ error: string } | never> {
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  const typed = formData.get('confirm')
  // An owner who never finished onboarding has no code to type.
  const expected = user.uniqueCode ?? 'DELETE'
  if (typeof typed !== 'string' || typed.trim() !== expected) {
    return { error: 'Type your feedback code exactly to confirm.' }
  }
  await deleteAccount(user.id)
  await deleteSession()
  redirect('/')
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
