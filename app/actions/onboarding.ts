'use server'

import { redirect } from 'next/navigation'
import { and, eq, isNull } from 'drizzle-orm'

import { getSession } from '../../lib/session'
import { db } from '@/db/index'
import { users } from '@/db/schema'

const UNIQUE_CODE_RE = /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])$/

const isUniqueCodeViolation = (error: unknown): boolean => {
  const dbError =
    (error as { cause?: { code?: string; constraint?: string } } | null)
      ?.cause ?? (error as { code?: string; constraint?: string } | null)
  return (
    dbError?.code === '23505' &&
    (!dbError.constraint || dbError.constraint === 'users_unique_code_unique')
  )
}

export async function completeOnboardingAction(
  prevState: { error?: string } | undefined,
  formData: FormData,
) {
  const rawBusinessName = formData.get('businessName')
  const rawBusinessType = formData.get('businessType')
  const rawUniqueCode = formData.get('uniqueCode')
  const rawChannel = formData.get('channel')

  const businessName =
    typeof rawBusinessName === 'string' ? rawBusinessName.trim() : ''
  const businessType =
    typeof rawBusinessType === 'string' ? rawBusinessType.trim() : ''
  const uniqueCode =
    typeof rawUniqueCode === 'string' ? rawUniqueCode.trim() : ''
  const channel = typeof rawChannel === 'string' ? rawChannel : ''

  if (!businessName || !businessType || !uniqueCode) {
    return { error: 'All fields are required' }
  }

  if (!UNIQUE_CODE_RE.test(uniqueCode)) {
    return {
      error:
        'Unique code must be 2 to 64 lowercase letters, numbers, or hyphens',
    }
  }

  const session = await getSession()

  if (!session || !session.userId) {
    redirect('/login')
  }

  let updated: Array<{ id: string }>
  try {
    updated = await db
      .update(users)
      .set({
        businessName,
        businessType,
        uniqueCode,
        isVerified: true,
        updatedAt: new Date(),
      })
      .where(and(eq(users.id, session.userId), isNull(users.uniqueCode)))
      .returning({ id: users.id })
  } catch (error) {
    if (isUniqueCodeViolation(error)) {
      return { error: 'This unique code is already taken' }
    }
    throw error
  }

  if (updated.length === 0) {
    const existing = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, session.userId))
      .limit(1)
    if (existing.length === 0) {
      redirect('/login')
    }
    return { error: 'Onboarding has already been completed' }
  }

  // Website owners go straight to setting up the widget.
  redirect(
    channel === 'website' || channel === 'both'
      ? '/settings?setup=widget'
      : '/dashboard',
  )
}
