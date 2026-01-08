'use server'

import { redirect } from 'next/navigation'
import { eq } from 'drizzle-orm'

import { db } from '@/db/index'
import { users } from '@/db/schema'
import { getSession } from '../../lib/session'

export async function completeOnboardingAction(
  prevState: { error?: string } | undefined,
  formData: FormData,
) {
  const businessName = formData.get('businessName') as string
  const businessType = formData.get('businessType') as string
  const uniqueCode = formData.get('uniqueCode') as string

  if (!businessName || !businessType || !uniqueCode) {
    return { error: 'All fields are required' }
  }

  // Get userId from session
  const session = await getSession()

  if (!session || !session.userId) {
    redirect('/login')
  }

  // Check if unique code is already taken
  const existing = await db
    .select()
    .from(users)
    .where(eq(users.uniqueCode, uniqueCode))
    .limit(1)

  if (existing.length > 0) {
    return { error: 'This unique code is already taken' }
  }

  // Update user with onboarding data and mark as verified
  await db
    .update(users)
    .set({
      businessName,
      businessType,
      uniqueCode,
      isVerified: true,
      updatedAt: new Date(),
    })
    .where(eq(users.id, session.userId))

  // Redirect to dashboard
  redirect('/dashboard')
}
