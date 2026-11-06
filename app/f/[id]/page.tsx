import { notFound } from 'next/navigation'

import { FeedbackForm } from '@/components/feedback-form'
import { PulseLogo } from '@/components/pulse-logo'
import { brandingFor } from '@/server/branding'
import { findSpot } from '@/server/spots'

interface FeedbackPageProps {
  params: Promise<{ id: string }>
  searchParams: Promise<{ spot?: string | Array<string> }>
}

export default async function FeedbackPage({
  params,
  searchParams,
}: FeedbackPageProps) {
  const { id } = await params
  const { spot: spotParam } = await searchParams

  const branding = await brandingFor(id)
  if (!branding) {
    notFound()
  }
  const spot = await findSpot(
    branding.userId,
    typeof spotParam === 'string' ? spotParam : null,
  )

  return (
    <main className="min-h-dvh bg-secondary flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-3 mb-6">
            {branding.logoUrl ? (
              <img
                src={branding.logoUrl}
                alt=""
                className="size-14 border-2 border-foreground bg-card object-contain"
              />
            ) : null}
            <span className="text-2xl font-black tracking-tight">
              {branding.businessName}
            </span>
          </div>
          <h1 className="text-4xl md:text-5xl font-black mb-4 text-balance">
            {branding.question ?? 'How did we do?'}
          </h1>
          <p className="text-lg md:text-xl font-semibold leading-relaxed text-balance">
            Record a quick voice note. It goes straight to the team.
          </p>
          {spot && (
            <p className="mt-4 inline-block border-2 border-foreground bg-card px-3 py-1 text-sm font-bold uppercase">
              {spot.name}
            </p>
          )}
        </div>
        <FeedbackForm
          businessId={id}
          spot={spot?.slug ?? null}
          accent={branding.accent}
          thankYouMessage={branding.thankYouMessage}
          googleReviewUrl={branding.googleReviewUrl}
        />
      </div>
      <a
        href="https://www.pulseapp.click"
        className="mt-10 inline-flex items-center gap-2 text-sm font-bold text-muted-foreground"
      >
        <PulseLogo className="size-5" />
        Powered by Pulse
      </a>
    </main>
  )
}
