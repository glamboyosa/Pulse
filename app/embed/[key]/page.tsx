import { headers } from 'next/headers'
import { notFound } from 'next/navigation'

import { FeedbackForm } from '@/components/feedback-form'
import { PulseLogo } from '@/components/pulse-logo'
import { brandingFor } from '@/server/branding'
import { widgetByKey } from '@/server/widget'

export const metadata = { title: 'Feedback', robots: { index: false } }

/** The website widget's panel, shown in an iframe on the owner's own site. */
export default async function EmbedPage({
  params,
  searchParams,
}: {
  params: Promise<{ key: string }>
  searchParams: Promise<{ heading?: string | Array<string> }>
}) {
  const { key } = await params
  // The site may set its own panel title in the snippet (data-heading).
  // Only inside a frame: as a shared link, a made-up title on the owner's
  // branded page could be used for phishing.
  const { heading } = await searchParams
  const framed = (await headers()).get('sec-fetch-dest') === 'iframe'
  const customHeading =
    framed && typeof heading === 'string' ? heading.trim().slice(0, 120) : ''
  const widget = await widgetByKey(key)
  const branding = widget?.code ? await brandingFor(widget.code) : null
  if (!widget?.code || !branding) notFound()

  return (
    <main className="min-h-dvh bg-secondary p-4">
      {/* Right padding clears the close button the widget draws over the frame. */}
      <h1 className="mb-4 pr-12 text-2xl font-black text-balance">
        {customHeading || branding.question || 'How are we doing?'}
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
