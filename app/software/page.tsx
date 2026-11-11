import Link from 'next/link'
import {
  BellRing,
  Code2,
  Languages,
  ListChecks,
  MousePointerClick,
  ShieldCheck,
} from 'lucide-react'

import { getCurrentUser } from '../actions/auth'
import { PulseLogo } from '@/components/pulse-logo'
import { Button } from '@/components/ui/button'
import { PACKS } from '@/lib/pricing'

const title = 'Voice feedback for your website or app'
const description =
  'One script tag adds a feedback button to your product. Users leave a voice note in any language, and you get the transcript, a summary and the exact page it happened on.'

export const metadata = {
  title,
  description,
  openGraph: { title: `${title} | Pulse`, description },
}

const STEPS = [
  {
    title: 'Paste one script tag',
    body: 'Turn the widget on in settings, list your sites and paste the snippet before </body>. No build step and no SDK.',
  },
  {
    title: 'Users tap and talk',
    body: 'A feedback button sits in the corner. Users record a short voice note, in any language, without leaving the page.',
  },
  {
    title: 'You get the what and the where',
    body: 'Each note arrives transcribed, translated and summarised, with the page, browser and app version it came from.',
  },
]

const FEATURES = [
  {
    icon: MousePointerClick,
    title: 'Right where it happened',
    body: 'Every note carries the page path, title, browser and screen size, so "this button does nothing" points somewhere.',
  },
  {
    icon: Languages,
    title: 'Any language, read in English',
    body: 'Users talk in the language they think in. You read the original next to an English translation.',
  },
  {
    icon: BellRing,
    title: 'Alerts for unhappy users',
    body: 'An email arrives straight away when someone is frustrated, with the summary in the subject line.',
  },
  {
    icon: ListChecks,
    title: 'A Monday list of what to fix',
    body: 'Up to three things to fix each week, with how many people raised each and their own words.',
  },
  {
    icon: Code2,
    title: 'Your user, your fields',
    body: 'Call Pulse.identify and Pulse.setContext to attach a user, your app version or a plan to each note.',
  },
  {
    icon: ShieldCheck,
    title: 'Safe on your pages',
    body: 'The recorder runs in a Pulse iframe that only your listed sites can show. Query strings are never sent.',
  },
]

const SNIPPET = `<script src="https://www.pulseapp.click/widget.js"
        data-key="pk_your_key" async></script>`

const smallestPack = PACKS[0]

const formatPrice = (cents: number) =>
  `$${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`

export default async function SoftwarePage() {
  const user = await getCurrentUser()
  const cta = user
    ? { href: '/settings', label: 'Set up the widget' }
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
            <Link
              href="/"
              className="hidden font-semibold hover:underline md:inline"
            >
              For restaurants and shops
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
              <Link href={user ? '/dashboard' : cta.href}>
                {user ? 'Dashboard' : 'Start free'}
              </Link>
            </Button>
          </nav>
        </div>
      </header>

      <main>
        <section className="border-b-2 border-foreground">
          <div className="mx-auto grid max-w-6xl items-center gap-16 px-4 pt-14 pb-24 md:grid-cols-[1.1fr_1fr] md:pt-20 md:pb-28">
            <div>
              <p className="mb-5 inline-block rounded-md border-2 border-foreground bg-accent px-3 py-1 text-sm font-bold">
                Voice feedback for websites and apps
              </p>
              <h1 className="mb-6 text-5xl leading-[0.95] font-extrabold tracking-tight md:text-7xl">
                Let users tell you what’s wrong, right where it happened.
              </h1>
              <p className="mb-8 max-w-[52ch] text-lg font-medium text-muted-foreground md:text-xl">
                {description}
              </p>
              <Button asChild size="lg">
                <Link href={cta.href}>{cta.label}</Link>
              </Button>
            </div>

            <div
              role="img"
              aria-label="A product page with a Pulse feedback button, and the note it produced: a summary with the page it was left on"
              className="pointer-events-none select-none space-y-5"
            >
              <div className="relative h-56 rounded-lg border-2 border-foreground bg-card p-5 shadow-brutal">
                <div className="mb-4 flex gap-1.5">
                  <span className="size-3 rounded-full border-2 border-foreground" />
                  <span className="size-3 rounded-full border-2 border-foreground" />
                  <span className="size-3 rounded-full border-2 border-foreground" />
                </div>
                <div className="mb-2 h-4 w-2/3 rounded bg-secondary" />
                <div className="mb-2 h-4 w-1/2 rounded bg-secondary" />
                <div className="h-4 w-3/5 rounded bg-secondary" />
                <span className="absolute right-4 bottom-4 rounded-full border-2 border-foreground bg-foreground px-4 py-2 text-sm font-bold text-background shadow-brutal-sm">
                  Feedback
                </span>
              </div>
              <div className="rounded-lg border-2 border-foreground bg-card p-5 shadow-brutal-lg">
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <span className="rounded-md border-2 border-foreground bg-negative px-2 py-0.5 text-xs font-bold text-white uppercase">
                    Unhappy
                  </span>
                  <span className="rounded-md border-2 border-foreground bg-foreground px-2 py-0.5 text-xs font-bold text-background">
                    Website · /billing
                  </span>
                </div>
                <p className="mb-2 text-lg font-bold leading-snug">
                  The export button on billing does nothing, and I need my
                  invoices.
                </p>
                <p className="text-sm font-medium text-muted-foreground">
                  app 3.1.0 · user 42 · Billing
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="border-b-2 border-foreground bg-secondary">
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
            <pre className="mt-10 overflow-x-auto rounded-lg border-2 border-foreground bg-card p-5 text-sm shadow-brutal">
              <code>{SNIPPET}</code>
            </pre>
          </div>
        </section>

        <section className="border-b-2 border-foreground">
          <div className="mx-auto max-w-6xl px-4 py-20">
            <h2 className="mb-12 max-w-[20ch] text-4xl font-extrabold tracking-tight md:text-5xl">
              Feedback you can act on, not just read
            </h2>
            <ul className="grid gap-px overflow-hidden rounded-lg border-2 border-foreground bg-foreground sm:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map(({ icon: Icon, title: name, body }) => (
                <li key={name} className="bg-card p-6">
                  <Icon
                    className="mb-4 size-7"
                    strokeWidth={2.25}
                    aria-hidden="true"
                  />
                  <h3 className="mb-2 text-xl font-bold leading-tight">
                    {name}
                  </h3>
                  <p className="font-medium text-muted-foreground">{body}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="border-b-2 border-foreground bg-secondary">
          <div className="mx-auto max-w-6xl px-4 py-20">
            <h2 className="mb-4 text-4xl font-extrabold tracking-tight md:text-5xl">
              Same simple pricing
            </h2>
            <p className="max-w-[60ch] text-lg font-medium text-muted-foreground">
              One pulse is one piece of feedback, spoken or typed, from your
              website or a QR code. Start with 5 free, then packs from{' '}
              {formatPrice(smallestPack.priceCents)} for {smallestPack.pulses}.
              No subscription.{' '}
              <Link href="/#pricing" className="font-bold underline">
                See all packs
              </Link>
              .
            </p>
          </div>
        </section>

        <section className="bg-foreground text-background">
          <div className="mx-auto max-w-6xl px-4 py-20 text-center">
            <h2 className="mx-auto mb-6 max-w-[18ch] text-4xl font-extrabold tracking-tight md:text-6xl">
              Your users already know what’s broken. Let them say it.
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
            <Link href="/" className="hover:underline">
              For restaurants and shops
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
}
