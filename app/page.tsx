import Link from 'next/link'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import {
  BellRing,
  Languages,
  MapPin,
  MessageSquareReply,
  Printer,
  Sparkles,
  Star,
  Trash2,
} from 'lucide-react'

import { getCurrentUser } from './actions/auth'
import {
  appUrl,
  preview,
  description as siteDescription,
  title as siteTitle,
} from './layout'
import type { Metadata } from 'next'
import { HeroMock } from '@/components/landing/hero-mock'
import { PulseLogo } from '@/components/pulse-logo'
import { Button } from '@/components/ui/button'
import { CUSTOM_PULSES_MAX, CUSTOM_PULSES_MIN, PACKS } from '@/lib/pricing'

const formatPrice = (cents: number) =>
  `$${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`

const STEPS = [
  {
    title: 'Put a QR code on the table',
    body: 'Print a table tent or sticker in one click. One code per branch or table if you like.',
  },
  {
    title: 'Customers talk for a minute',
    body: 'They scan, tap record and say what they think, in any language. No app, no account, no form.',
  },
  {
    title: 'You hear it, then fix it',
    body: 'Every note arrives transcribed, translated and summarised. Unhappy ones reach your inbox straight away.',
  },
]

const FEATURES = [
  {
    icon: Languages,
    title: 'Any language, read in English',
    body: 'Yoruba, Pidgin, French, Portuguese and many more are detected on their own and translated, with the original kept beside it.',
  },
  {
    icon: BellRing,
    title: 'Alerts for unhappy customers',
    body: 'Negative feedback comes as an email with a one-line summary, so you can make it right while they are still nearby.',
  },
  {
    icon: Sparkles,
    title: 'A weekly digest of what to fix',
    body: 'Every Monday: up to three fixes, each with how many people raised it and their own words.',
  },
  {
    icon: MapPin,
    title: 'Spots for every branch and table',
    body: 'Give each place its own QR code and see which one the feedback came from.',
  },
  {
    icon: Star,
    title: 'Your page, with a Google review prompt',
    body: 'Your logo and question on the page. After sending, everyone sees your thank-you offer and a link to review you on Google.',
  },
  {
    icon: MessageSquareReply,
    title: 'Reply without seeing their email',
    body: 'Customers can ask for a reply. You answer once from the dashboard; their address stays private.',
  },
  {
    icon: Printer,
    title: 'Print-ready table tents',
    body: 'A4 table tents and sticker sheets with your logo and question, ready for any printer or print shop.',
  },
  {
    icon: Trash2,
    title: 'Private by default',
    body: 'Recordings are deleted after 12 months. Export or delete everything whenever you want.',
  },
]

const FAQS = [
  {
    q: 'What is a pulse?',
    a: 'One piece of feedback: a voice note of up to two minutes, or typed feedback when a customer can’t record. Transcription, translation, the summary and the alerts are included. Pulses never expire.',
  },
  {
    q: 'Do customers need an app?',
    a: 'No. They scan the QR code with their phone camera and record in the browser. It works on iPhone and Android.',
  },
  {
    q: 'Which languages work?',
    a: 'Speech-to-text detects the language on its own, and it handles most widely spoken languages. We test with English, Nigerian Pidgin, Yoruba, French and Portuguese. Anything not in English comes with a translation.',
  },
  {
    q: 'Is there a subscription?',
    a: 'No. Buy pulses when you need them. New businesses start with 5 free.',
  },
  {
    q: 'What happens to recordings?',
    a: 'Only your business sees them. Recordings are deleted automatically after 12 months; transcripts stay until you delete them. The privacy page lists every service involved.',
  },
  {
    q: 'Can I ask happy customers for Google reviews?',
    a: 'Pulse shows your review link to everyone who leaves feedback, never only to happy customers. Asking only happy customers breaks Google’s rules.',
  },
]

/**
 * The home page's link preview adds a short video of the hero. LinkedIn can't
 * play og:video and drops the image when one is present, so its crawler gets
 * the image alone.
 */
export const generateMetadata = async (): Promise<Metadata> => {
  const userAgent = (await headers()).get('user-agent') ?? ''
  if (userAgent.includes('LinkedInBot')) return {}
  const video = new URL('/og-preview.mp4', appUrl).href
  return {
    openGraph: {
      title: siteTitle,
      description: siteDescription,
      url: '/',
      siteName: 'Pulse',
      type: 'website',
      images: [{ ...preview, type: 'image/jpeg' }],
      videos: [
        {
          url: video,
          secureUrl: video,
          type: 'video/mp4',
          width: 1200,
          height: 630,
        },
      ],
    },
  }
}

export default async function HomePage() {
  const user = await getCurrentUser()
  // Signed-in owners who type the address or open a bookmark (a request the
  // browser starts itself) land on their dashboard. A click from inside Pulse
  // or another site still shows this page, so the homepage stays reachable.
  if (user && (await headers()).get('sec-fetch-site') === 'none') {
    redirect('/dashboard')
  }
  const cta = user
    ? { href: '/dashboard', label: 'Go to dashboard' }
    : { href: '/login', label: 'Start free: 5 pulses' }

  return (
    <div className="min-h-dvh bg-background">
      <header className="border-b-2 border-foreground">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4">
          <Link href="/" className="flex items-center gap-2.5">
            <PulseLogo className="size-8" />
            <span className="font-display text-2xl font-extrabold tracking-tight">
              Pulse
            </span>
          </Link>
          <nav aria-label="Main" className="flex items-center gap-1 md:gap-6">
            <a
              href="#how-it-works"
              className="hidden font-semibold hover:underline md:inline"
            >
              How it works
            </a>
            <a
              href="#features"
              className="hidden font-semibold hover:underline md:inline"
            >
              Features
            </a>
            <a
              href="#pricing"
              className="hidden font-semibold hover:underline md:inline"
            >
              Pricing
            </a>
            <Link
              href="/software"
              className="hidden font-semibold hover:underline md:inline"
            >
              For software
            </Link>
            {!user && (
              <Link
                href="/login"
                className="px-3 font-semibold hover:underline"
              >
                Log in
              </Link>
            )}
            <Button asChild variant="accent">
              <Link href={cta.href}>{user ? 'Dashboard' : 'Start free'}</Link>
            </Button>
          </nav>
        </div>
      </header>

      <main>
        <section className="border-b-2 border-foreground">
          <div className="mx-auto grid max-w-6xl items-center gap-16 px-4 pt-14 pb-24 md:grid-cols-[1.1fr_1fr] md:pt-20 md:pb-28">
            <div>
              <p className="mb-5 inline-block rounded-md border-2 border-foreground bg-accent px-3 py-1 text-sm font-bold">
                Voice feedback for restaurants, salons and shops
              </p>
              <h1 className="mb-6 text-5xl leading-[0.95] font-extrabold tracking-tight md:text-7xl">
                Hear what your customers really think.
              </h1>
              <p className="mb-8 max-w-[52ch] text-lg font-medium text-muted-foreground md:text-xl">
                They scan a QR code and leave a voice note, in any language. You
                get the transcript, an English translation, an alert when
                someone is unhappy, and a weekly list of what to fix.
              </p>
              <div className="flex flex-wrap items-center gap-4">
                <Button asChild size="lg">
                  <Link href={cta.href}>{cta.label}</Link>
                </Button>
                <Button asChild size="lg" variant="outline">
                  <a href="#how-it-works">See how it works</a>
                </Button>
              </div>
              <p className="mt-6 text-sm font-semibold text-muted-foreground">
                No app for customers · No subscription · Pulses never expire
              </p>
              <p className="mt-3 text-sm font-semibold">
                Building software?{' '}
                <Link href="/software" className="underline underline-offset-4">
                  Add a voice feedback button to your app
                </Link>
              </p>
            </div>
            <HeroMock />
          </div>
        </section>

        <section
          id="how-it-works"
          className="scroll-mt-4 border-b-2 border-foreground bg-secondary"
        >
          <div className="mx-auto max-w-6xl px-4 py-20">
            <h2 className="mb-12 text-4xl font-extrabold tracking-tight md:text-5xl">
              How it works
            </h2>
            <ol className="grid gap-6 md:grid-cols-3">
              {STEPS.map((step, i) => (
                <li
                  key={step.title}
                  className="rounded-lg border-2 border-foreground bg-card p-6 shadow-brutal"
                >
                  <span className="mb-4 flex size-12 items-center justify-center rounded-md border-2 border-foreground bg-accent font-display text-2xl font-extrabold">
                    {i + 1}
                  </span>
                  <h3 className="mb-2 text-2xl font-bold">{step.title}</h3>
                  <p className="font-medium text-muted-foreground">
                    {step.body}
                  </p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section
          id="features"
          className="scroll-mt-4 border-b-2 border-foreground"
        >
          <div className="mx-auto max-w-6xl px-4 py-20">
            <h2 className="mb-4 max-w-[20ch] text-4xl font-extrabold tracking-tight md:text-5xl">
              Everything a busy owner needs, nothing they don’t
            </h2>
            <p className="mb-12 max-w-[60ch] text-lg font-medium text-muted-foreground">
              Built for places where customers won’t fill in a form but will
              happily tell you what they think.
            </p>
            <ul className="grid gap-px overflow-hidden rounded-lg border-2 border-foreground bg-foreground sm:grid-cols-2 lg:grid-cols-4">
              {FEATURES.map(({ icon: Icon, title, body }) => (
                <li key={title} className="bg-card p-6">
                  <Icon
                    className="mb-4 size-7"
                    strokeWidth={2.25}
                    aria-hidden="true"
                  />
                  <h3 className="mb-2 text-xl font-bold leading-tight">
                    {title}
                  </h3>
                  <p className="font-medium text-muted-foreground">{body}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section
          id="pricing"
          className="scroll-mt-4 border-b-2 border-foreground bg-secondary"
        >
          <div className="mx-auto max-w-6xl px-4 py-20">
            <h2 className="mb-4 text-4xl font-extrabold tracking-tight md:text-5xl">
              Pay per voice note
            </h2>
            <p className="mb-12 max-w-[60ch] text-lg font-medium text-muted-foreground">
              Start with 5 free pulses. One pulse is one piece of feedback, with
              transcription, translation and alerts included. Or choose any
              amount from {CUSTOM_PULSES_MIN} to {CUSTOM_PULSES_MAX}.
            </p>
            <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {PACKS.map((pack) => {
                const popular = pack.id === 'popular'
                return (
                  <li
                    key={pack.id}
                    className={`flex flex-col rounded-lg border-2 border-foreground p-6 ${popular ? 'bg-accent shadow-brutal-lg' : 'bg-card shadow-brutal'}`}
                  >
                    <p className="mb-1 text-sm font-bold uppercase tracking-wider">
                      {popular ? 'Most popular' : `${pack.pulses} pulses`}
                    </p>
                    <p className="font-display text-5xl font-extrabold tabular-nums">
                      {formatPrice(pack.priceCents)}
                    </p>
                    <p className="mt-1 mb-6 font-semibold text-muted-foreground tabular-nums">
                      {pack.pulses} pulses ·{' '}
                      {formatPrice(Math.round(pack.priceCents / pack.pulses))}{' '}
                      each
                    </p>
                    <Button
                      asChild
                      variant={popular ? 'default' : 'outline'}
                      className="mt-auto"
                    >
                      <Link href={user ? '/buy-pulses' : '/login'}>
                        {user ? 'Buy pulses' : 'Start free'}
                      </Link>
                    </Button>
                  </li>
                )
              })}
            </ul>
          </div>
        </section>

        <section className="border-b-2 border-foreground">
          <div className="mx-auto max-w-3xl px-4 py-20">
            <h2 className="mb-10 text-4xl font-extrabold tracking-tight md:text-5xl">
              Questions
            </h2>
            <div className="divide-y-2 divide-foreground rounded-lg border-2 border-foreground bg-card">
              {FAQS.map(({ q, a }) => (
                <details key={q} className="group">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-5 font-display text-lg font-bold [&::-webkit-details-marker]:hidden">
                    {q}
                    <span
                      aria-hidden="true"
                      className="text-2xl leading-none transition-transform duration-200 group-open:rotate-45"
                    >
                      +
                    </span>
                  </summary>
                  <p className="max-w-[65ch] px-5 pb-5 font-medium text-muted-foreground">
                    {a}
                  </p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-foreground text-background">
          <div className="mx-auto max-w-6xl px-4 py-20 text-center">
            <h2 className="mx-auto mb-6 max-w-[18ch] text-4xl font-extrabold tracking-tight md:text-6xl">
              Your customers are already talking. Start listening.
            </h2>
            <Button
              asChild
              size="lg"
              variant="accent"
              className="border-background"
            >
              <Link href={cta.href}>{cta.label}</Link>
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
            <Link href="/about" className="hover:underline">
              About
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
            <a href="mailto:support@pulseapp.click" className="hover:underline">
              support@pulseapp.click
            </a>
          </nav>
        </div>
      </footer>
    </div>
  )
}
