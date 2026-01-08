import { createServerFn } from '@tanstack/react-start'
import { redirect } from '@tanstack/react-router'
import { eq } from 'drizzle-orm'

import { db } from '@/db/index'
import { users } from '@/db/schema'
import { useAppSession } from '@/lib/session'

interface CompleteOnboardingInput {
  businessName: string
  businessType: string
  uniqueCode: string
}

/**
 * Complete onboarding - Server Function
 * This is a one-off action tied to the onboarding form, so it makes sense as a server function
 */
export const completeOnboarding = createServerFn({
  method: 'POST',
})
  .inputValidator((data: CompleteOnboardingInput) => data)
  .handler(async ({ data }) => {
    // Get userId from session
    const session = await useAppSession()
    const userId = session.data.userId

    if (!userId) {
      throw redirect({ to: '/login' })
    }

    // Check if unique code is already taken
    const existing = await db
      .select()
      .from(users)
      .where(eq(users.uniqueCode, data.uniqueCode))
      .limit(1)

    if (existing.length > 0) {
      throw new Error('This unique code is already taken')
    }

    // Update user with onboarding data and mark as verified
    await db
      .update(users)
      .set({
        businessName: data.businessName,
        businessType: data.businessType,
        uniqueCode: data.uniqueCode,
        isVerified: true, // Mark user as verified after completing onboarding
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId))

    // Redirect to dashboard
    throw redirect({ to: '/dashboard' })
  })
