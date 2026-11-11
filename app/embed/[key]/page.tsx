import { notFound } from 'next/navigation'

import { FeedbackForm } from '@/components/feedback-form'
import { PulseLogo } from '@/components/pulse-logo'
import { brandingFor } from '@/server/branding'
import { widgetByKey } from '@/server/widget'

export const metadata = { title: 'Feedback', robots: { index: false } }

/** The website widget's panel, shown in an iframe on the owner's own site. */
export default async function EmbedPage({
  params,
}: {
  params: Promise<{ key: string }>
}) {
  const { key } = await params
  const widget = await widgetByKey(key)
  const branding = widget?.code ? await brandingFor(widget.code) : null
  if (!widget?.code || !branding) notFound()

  return (
    <main className="min-h-dvh bg-secondary p-4">
      <h1 className="mb-4 text-2xl font-black text-balance">
        {branding.question ?? 'How are we doing?'}
      </h1>
      <FeedbackForm
        businessId={widget.code}
        spot={null}
        accent={branding.accent}
        thankYouMessage={branding.thankYouMessage}
        googleReviewUrl={null}
        widget={{ key }}
      />
      <a
        href="https://www.pulseapp.click"
        target="_blank"
        rel="noreferrer"
        className="mt-4 flex items-center justify-center gap-2 text-xs font-bold text-muted-foreground"
      >
        <PulseLogo className="size-4" />
        Powered by Pulse
      </a>
    </main>
  )
}
