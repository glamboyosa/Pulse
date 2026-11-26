import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'

import { getSession } from '../../lib/session'
import { AccountData } from '@/components/account-data'
import { BrandingForm } from '@/components/branding-form'
import { VoucherSettings } from '@/components/voucher-settings'
import { WidgetSettings } from '@/components/widget-settings'
import { getUserById } from '@/lib/auth-helpers'
import { logoPathFor } from '@/server/branding'
import { VOUCHER_LIMITS, voucherSettingsFromUser } from '@/server/vouchers'
import { widgetSettingsFromUser } from '@/server/widget'
import { env } from '@/env'

export default async function SettingsPage() {
  const session = await getSession()
  if (!session) redirect('/login')

  const user = await getUserById(session.userId)
  if (!user) redirect('/login')

  const businessName = user.businessName || user.email.split('@')[0] || 'User'

  return (
    <main id="main" className="min-h-screen bg-secondary p-4 md:p-8">
      <div className="max-w-3xl mx-auto">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 font-bold mb-8 border-2 border-transparent hover:border-foreground px-3 py-2"
        >
          <ArrowLeft className="size-4" />
          Back to Dashboard
        </Link>
        <h1 className="text-4xl md:text-5xl font-black mb-2">
          Your feedback page
        </h1>
        <p className="text-lg font-semibold text-muted-foreground mb-8">
          What customers see when they scan your QR code.
        </p>
        <BrandingForm
          businessName={businessName}
          feedbackUrl={`/f/${user.uniqueCode ?? ''}`}
          initial={{
            feedbackQuestion: user.feedbackQuestion ?? '',
            accentColor: user.accentColor ?? 'black',
            googleReviewUrl: user.googleReviewUrl ?? '',
            thankYouMessage: user.thankYouMessage ?? '',
          }}
          logoUrl={logoPathFor(user.uniqueCode, user.logoKey)}
        />
        <div className="mt-10">
          <VoucherSettings
            initial={voucherSettingsFromUser(user)}
            offerLimit={VOUCHER_LIMITS.offer}
          />
        </div>
        <div className="mt-10">
          <WidgetSettings
            initial={widgetSettingsFromUser(user)}
            appUrl={env.SERVER_URL ?? 'https://www.pulseapp.click'}
          />
        </div>
        <div className="mt-10">
          <AccountData confirmWord={user.uniqueCode ?? 'DELETE'} />
        </div>
      </div>
    </main>
  )
}
