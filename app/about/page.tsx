import Link from 'next/link'

import { PulseLogo } from '@/components/pulse-logo'
import { Button } from '@/components/ui/button'

export const metadata = { title: 'About' }

export default function AboutPage() {
  return (
    <div className="min-h-dvh bg-background">
      <header className="border-b-2 border-foreground">
        <div className="mx-auto max-w-3xl px-4 py-4">
          <Link href="/" className="inline-flex items-center gap-2.5">
            <PulseLogo className="size-8" />
            <span className="font-display text-2xl font-extrabold tracking-tight">
              Pulse
            </span>
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-10 px-4 py-12 text-lg leading-relaxed">
        <h1 className="text-4xl font-extrabold tracking-tight md:text-5xl">
          About Pulse
        </h1>

        <section className="space-y-4">
          <p>
            Most customers will never fill in a feedback form. Plenty of them
            will happily talk for half a minute if it takes one tap. Pulse is
            built on that: a QR code on the table, one record button, and no app
            or account for the customer.
          </p>
          <p>
            For the owner, every voice note arrives transcribed and summarised,
            in English even when the customer spoke Yoruba, Pidgin, French or
            Portuguese. Unhappy customers trigger an email straight away, and
            every Monday brings a short list of what to fix, in customers’ own
            words.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-extrabold tracking-tight">
            Who makes it
          </h2>
          <p>
            Pulse is built by Timothy Osaretin Ogbemudia, a product engineer
            with five years of experience building products people use every
            day.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button asChild variant="outline">
              <a
                href="https://glamboyosa.xyz"
                target="_blank"
                rel="noopener noreferrer"
              >
                Portfolio
              </a>
            </Button>
            <Button asChild variant="outline">
              <a
                href="https://github.com/glamboyosa"
                target="_blank"
                rel="noopener noreferrer"
              >
                GitHub
              </a>
            </Button>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-extrabold tracking-tight">
            Get in touch
          </h2>
          <p>
            Questions, ideas or a feature you need for your business? Email{' '}
            <a
              href="mailto:support@pulseapp.click"
              className="font-bold underline"
            >
              support@pulseapp.click
            </a>
            . A person reads every message.
          </p>
        </section>

        <p className="border-t-2 border-foreground pt-8">
          <Link href="/" className="font-bold underline underline-offset-4">
            Back to Pulse
          </Link>
        </p>
      </main>
    </div>
  )
}
