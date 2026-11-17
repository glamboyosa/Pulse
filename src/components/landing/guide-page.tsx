import Link from 'next/link'

import { PulseLogo } from '@/components/pulse-logo'
import { Button } from '@/components/ui/button'
import { faqJsonLd, jsonLdScript } from '@/lib/structured-data'

export type Faq = { q: string; a: string }

/**
 * A page for one buyer question (a use case or a comparison), styled like
 * /software: the answer up top, sections below, then FAQs that are both shown
 * and published as FAQPage data for search engines and AI assistants.
 * Static on purpose, so it is served from the CDN; signed-in visitors who
 * click the CTA are sent from /login to their dashboard.
 */
export const GuidePage = ({
  eyebrow,
  title,
  answer,
  visual,
  faqs,
  faqTinted = true,
  closing,
  children,
}: {
  eyebrow: string
  title: string
  /** The direct answer, in a sentence or two. Shown first. */
  answer: string
  visual: React.ReactNode
  faqs: ReadonlyArray<Faq>
  /** Set to false when the band above Questions is tinted. */
  faqTinted?: boolean
  /** Headline for the closing call to action. */
  closing: string
  children: React.ReactNode
}) => (
  <div className="min-h-dvh bg-background">
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: jsonLdScript(faqJsonLd(faqs)) }}
    />
    <header className="border-b-2 border-foreground">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4">
        <Link href="/" className="flex items-center gap-2.5">
          <PulseLogo className="size-8" />
          <span className="font-display text-2xl font-extrabold tracking-tight">
            Pulse
          </span>
        </Link>
        <nav aria-label="Main" className="flex items-center gap-1 md:gap-6">
          <Link href="/login" className="px-3 font-semibold hover:underline">
            Log in
          </Link>
          <Button asChild variant="accent">
            <Link href="/login">Start free</Link>
          </Button>
        </nav>
      </div>
    </header>

    <main id="main">
      <section className="border-b-2 border-foreground">
        <div className="mx-auto grid max-w-6xl items-center gap-16 px-4 pt-14 pb-24 md:grid-cols-[1.1fr_1fr] md:pt-20 md:pb-28">
          <div>
            <p className="mb-5 inline-block rounded-md border-2 border-foreground bg-accent px-3 py-1 text-sm font-bold">
              {eyebrow}
            </p>
            <h1 className="mb-6 text-5xl leading-[0.95] font-extrabold tracking-tight text-balance md:text-6xl">
              {title}
            </h1>
            <p className="mb-8 max-w-[60ch] text-lg font-medium text-muted-foreground md:text-xl">
              {answer}
            </p>
            <Button asChild size="lg">
              <Link href="/login">Start free: 5 pulses</Link>
            </Button>
          </div>
          {visual}
        </div>
      </section>

      {children}

      <GuideSection heading="Questions" tinted={faqTinted}>
        <div className="divide-y-2 divide-foreground rounded-lg border-2 border-foreground bg-card shadow-brutal">
          {faqs.map(({ q, a }) => (
            <div key={q} className="space-y-2 p-6">
              <h3 className="text-xl font-bold leading-tight">{q}</h3>
              <p className="max-w-[70ch] font-medium text-muted-foreground">
                {a}
              </p>
            </div>
          ))}
        </div>
      </GuideSection>

      <section className="bg-foreground text-background">
        <div className="mx-auto max-w-6xl px-4 py-20 text-center">
          <h2 className="mx-auto mb-6 max-w-[18ch] text-4xl font-extrabold tracking-tight text-balance md:text-6xl">
            {closing}
          </h2>
          <Button
            asChild
            size="lg"
            variant="accent"
            className="border-background"
          >
            <Link href="/login">Start free: 5 pulses</Link>
          </Button>
        </div>
      </section>
    </main>

    <footer className="border-t-2 border-foreground">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-8 text-sm font-semibold">
        <span className="flex items-center gap-2">
          <PulseLogo className="size-5" />© 2026 Pulse
        </span>
        <nav aria-label="Footer" className="flex flex-wrap gap-x-6 gap-y-2">
          <Link href="/" className="hover:underline">
            Pulse
          </Link>
          <Link href="/restaurants" className="hover:underline">
            For restaurants
          </Link>
          <Link href="/software" className="hover:underline">
            For software
          </Link>
          <Link href="/compare/google-reviews" className="hover:underline">
            Pulse vs Google reviews
          </Link>
          <Link href="/privacy" className="hover:underline">
            Privacy
          </Link>
          <Link href="/terms" className="hover:underline">
            Terms
          </Link>
          <Link href="/dpa" className="hover:underline">
            Data processing
          </Link>
        </nav>
      </div>
    </footer>
  </div>
)

/** A full-width band with a heading, matching the sections on /software. */
export const GuideSection = ({
  heading,
  tinted = false,
  children,
}: {
  heading: string
  /** Alternate bands use the secondary background, as on /software. */
  tinted?: boolean
  children: React.ReactNode
}) => (
  <section
    className={`border-b-2 border-foreground ${tinted ? 'bg-secondary' : ''}`}
  >
    <div className="mx-auto max-w-6xl px-4 py-20">
      <h2 className="mb-12 max-w-[20ch] text-4xl font-extrabold tracking-tight text-balance md:text-5xl">
        {heading}
      </h2>
      {children}
    </div>
  </section>
)
