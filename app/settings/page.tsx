import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { eq } from 'drizzle-orm'

import { getCurrentUser } from '../actions/auth'
import { BrandingForm } from '@/components/branding-form'
import { db } from '@/db/index'
import { users } from '@/db/schema'
import { brandingFor } from '@/server/branding'

export default async function SettingsPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const [row] = await db
    .select({
      feedbackQuestion: users.feedbackQuestion,
      accentColor: users.accentColor,
      googleReviewUrl: users.googleReviewUrl,
      thankYouMessage: users.thankYouMessage,
    })
    .from(users)
    .where(eq(users.id, user.id))

  return (
    <div className="min-h-screen bg-secondary p-4 md:p-8">
      <div className="max-w-3xl mx-auto">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 font-bold mb-8 border-2 border-transparent hover:border-foreground px-3 py-2"
        >
          <ArrowLeft className="size-4" />
          Back to Dashboard
        </Link>
        <h1 className="text-4xl md:text-5xl font-black mb-2">
          YOUR FEEDBACK PAGE
        </h1>
        <p className="text-lg font-semibold text-muted-foreground mb-8">
          What customers see when they scan your QR code.
        </p>
        <BrandingForm
          businessName={user.businessName ?? user.name}
          feedbackUrl={`/f/${user.uniqueCode ?? ''}`}
          initial={{
            feedbackQuestion: row.feedbackQuestion ?? '',
            accentColor: row.accentColor ?? 'black',
            googleReviewUrl: row.googleReviewUrl ?? '',
            thankYouMessage: row.thankYouMessage ?? '',
          }}
          logoUrl={
            user.uniqueCode
              ? ((await brandingFor(user.uniqueCode))?.logoUrl ?? null)
              : null
          }
        />
      </div>
    </div>
  )
}
