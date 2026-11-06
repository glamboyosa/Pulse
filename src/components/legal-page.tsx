import Link from 'next/link'

import { PulseLogo } from '@/components/pulse-logo'

/** The shared frame for the privacy policy and the DPA. */
export function LegalPage({
  title,
  updated,
  children,
}: {
  title: string
  /** Written out, e.g. "6 November 2026", so it only changes when the text does. */
  updated: string
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b-2 border-foreground">
        <div className="container mx-auto px-4 py-4">
          <Link href="/" className="inline-flex items-center gap-3">
            <PulseLogo className="size-10" />
            <span className="font-display text-2xl font-extrabold tracking-tight">
              Pulse
            </span>
          </Link>
        </div>
      </header>
      <main className="container mx-auto max-w-3xl px-4 py-12">
        <h1 className="mb-3 text-4xl font-black md:text-5xl">{title}</h1>
        <p className="mb-12 font-semibold text-muted-foreground">
          Last updated {updated}
        </p>
        <div className="space-y-10 text-lg leading-relaxed [&_h2]:mb-4 [&_h2]:text-2xl [&_h2]:font-black [&_li]:mb-2 [&_p]:mb-4 [&_ul]:list-disc [&_ul]:pl-6">
          {children}
        </div>
        <p className="mt-12 border-t-2 border-foreground pt-8">
          <Link href="/" className="font-bold underline underline-offset-4">
            Back to Pulse
          </Link>
        </p>
      </main>
    </div>
  )
}
