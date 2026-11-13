import { headers } from 'next/headers'
import { notFound } from 'next/navigation'

import { AppCloseButton } from '@/components/app-close-button'
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
  // The site may set its own panel title in the snippet (data-heading), or
  // the app in its component. Only there: as a shared link, a made-up title
  // on the owner's branded page could be used for phishing. A browser can't
  // add the app's header to a link.
  const { heading } = await searchParams
  const requestHeaders = await headers()
  const framed = requestHeaders.get('sec-fetch-dest') === 'iframe'
  const inApp = requestHeaders.get('x-pulse-app') === '1'
  const customHeading =
    (framed || inApp) && typeof heading === 'string'
      ? heading.trim().slice(0, 120)
      : ''
  const widget = await widgetByKey(key)
  const branding = widget?.code ? await brandingFor(widget.code) : null
  if (!widget?.code || !branding) notFound()

  return (
    <main className="relative min-h-dvh bg-secondary p-4">
      {inApp && <AppCloseButton />}
      {/* Right padding clears the close button. */}
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
