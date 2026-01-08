import { createFileRoute, Link } from '@tanstack/react-router'

import { PulseLogo } from '@/components/pulse-logo'

export const Route = createFileRoute('/about')({
  component: AboutPage,
})

function AboutPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b-4 border-foreground bg-background">
        <div className="container mx-auto px-4 py-4">
          <Link to="/" className="flex items-center gap-3">
            <PulseLogo className="w-10 h-10 text-primary" />
            <span className="text-2xl font-bold tracking-tight">PULSE</span>
          </Link>
        </div>
      </header>

      <main className="container mx-auto px-4 py-12 max-w-4xl">
        <h1 className="text-5xl font-black mb-8">ABOUT PULSE</h1>

        <div className="space-y-8 text-lg leading-relaxed">
          <section>
            <h2 className="text-3xl font-black mb-4">What is Pulse?</h2>
            <p className="font-medium mb-4">
              Pulse is a simple, powerful tool for businesses to collect
              authentic voice feedback from customers. No apps, no complicated
              forms—just scan a QR code and speak. We believe that voice
              feedback captures the nuance, emotion, and authenticity that
              written feedback often misses.
            </p>
          </section>

          <section>
            <h2 className="text-3xl font-black mb-4">Our Mission</h2>
            <p className="font-medium mb-4">
              We're on a mission to make customer feedback collection effortless
              for businesses and frictionless for customers. By leveraging voice
              technology and AI transcription, we're helping businesses hear
              their customers in a whole new way.
            </p>
          </section>

          <section>
            <h2 className="text-3xl font-black mb-4">The Creator</h2>
            <p className="font-medium mb-4">
              Pulse is a product by{' '}
              <span className="font-black">Timothy Osaretin Ogbemudia</span>, a
              product engineer with 5 years of experience building user-focused
              applications and digital products.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 mt-6">
              <a
                href="https://github.com/glamboyosa"
                target="_blank"
                rel="noopener noreferrer"
                className="font-bold text-primary hover:underline border-4 border-foreground px-6 py-3 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] transition-all inline-block"
              >
                View GitHub →
              </a>
              <a
                href="https://glamboyosa.xyz"
                target="_blank"
                rel="noopener noreferrer"
                className="font-bold text-primary hover:underline border-4 border-foreground px-6 py-3 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] transition-all inline-block"
              >
                Visit Portfolio →
              </a>
            </div>
          </section>

          <section>
            <h2 className="text-3xl font-black mb-4">Why Voice Feedback?</h2>
            <p className="font-medium mb-4">
              Traditional feedback methods—surveys, forms, ratings—often miss
              the human element. Voice feedback captures tone, emotion, and
              context that written words can't convey. It's faster for
              customers, more authentic for businesses, and leads to better
              insights.
            </p>
          </section>

          <section>
            <h2 className="text-3xl font-black mb-4">Our Values</h2>
            <ul className="space-y-3 font-medium list-disc list-inside">
              <li>
                <strong className="font-black">Simplicity:</strong> We believe
                in making complex things simple
              </li>
              <li>
                <strong className="font-black">Privacy:</strong> Your data and
                your customers' data are protected
              </li>
              <li>
                <strong className="font-black">Transparency:</strong> No hidden
                fees, no subscriptions, just clear pricing
              </li>
              <li>
                <strong className="font-black">Quality:</strong> We're committed
                to building a product that works reliably
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-3xl font-black mb-4">Get in Touch</h2>
            <p className="font-medium mb-4">
              Have questions, feedback, or ideas? We'd love to hear from you.
            </p>
            <div className="space-y-2">
              <p className="font-bold">support@pulseapp.click</p>
              <p className="font-bold">osa@pulseapp.click</p>
            </div>
          </section>
        </div>

        <div className="mt-12 pt-8 border-t-4 border-foreground">
          <Link to="/" className="font-bold text-primary hover:underline">
            ← Back to Home
          </Link>
        </div>
      </main>
    </div>
  )
}
