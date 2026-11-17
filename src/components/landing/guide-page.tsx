import Link from 'next/link'

import { PulseLogo } from '@/components/pulse-logo'
import { Button } from '@/components/ui/button'
import { faqJsonLd, jsonLdScript } from '@/lib/structured-data'

export type Faq = { q: string; a: string }

/**
 * A plain, readable page for one buyer question (a use case or a
 * comparison): the answer up top, sections below, then FAQs that are both
 * shown and published as FAQPage data for search engines and AI assistants.
 */
export const GuidePage = ({
  title,
  answer,
  faqs,
  children,
}: {
  title: string
  /** The direct answer, in a sentence or two. Shown first. */
  answer: string
  faqs: ReadonlyArray<Faq>
  children: React.ReactNode
}) => (
  <div className="min-h-dvh bg-background">
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: jsonLdScript(faqJsonLd(faqs)) }}
    />
    <header className="border-b-2 border-foreground">
      <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-4 py-4">
        <Link href="/" className="inline-flex items-center gap-3">
          <PulseLogo className="size-8" />
          <span className="font-display text-2xl font-extrabold tracking-tight">
            Pulse
          </span>
        </Link>
        <Link href="/login" className="font-bold hover:underline">
          Log in
        </Link>
      </div>
    </header>
    <main
      id="main"
      className="mx-auto max-w-3xl space-y-12 px-4 py-12 text-lg leading-relaxed"
    >
      <div className="space-y-6">
        <h1 className="text-4xl font-black text-balance md:text-5xl">
          {title}
        </h1>
        <p className="max-w-[65ch] text-xl font-medium">{answer}</p>
        <Button asChild size="lg">
          <Link href="/login">Start free: 5 pulses</Link>
        </Button>
      </div>
      {children}
      <section className="space-y-4">
        <h2 className="text-3xl font-black text-balance">Questions</h2>
        <div className="divide-y-2 divide-foreground rounded-lg border-2 border-foreground bg-card">
          {faqs.map(({ q, a }) => (
            <div key={q} className="space-y-2 p-5">
              <h3 className="font-display text-lg font-bold">{q}</h3>
              <p className="max-w-[65ch] font-medium text-muted-foreground">
                {a}
              </p>
            </div>
          ))}
        </div>
      </section>
    </main>
    <footer className="border-t-2 border-foreground">
      <nav
        aria-label="Footer"
        className="mx-auto flex max-w-3xl flex-wrap gap-x-6 gap-y-2 px-4 py-8 text-sm font-semibold"
      >
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
      </nav>
    </footer>
  </div>
)
