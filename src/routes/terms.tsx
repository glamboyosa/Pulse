import { Link, createFileRoute } from '@tanstack/react-router'

import { PulseLogo } from '@/components/pulse-logo'

export const Route = createFileRoute('/terms')({
  component: TermsPage,
})

function TermsPage() {
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
        <h1 className="text-5xl font-black mb-8">TERMS OF SERVICE</h1>
        <p className="text-sm font-semibold text-muted-foreground mb-12">
          Last updated:{' '}
          {new Date().toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })}
        </p>

        <div className="space-y-8 text-lg leading-relaxed">
          <section>
            <h2 className="text-3xl font-black mb-4">1. Acceptance of Terms</h2>
            <p className="font-medium mb-4">
              By accessing and using Pulse, you accept and agree to be bound by
              the terms and provision of this agreement. If you do not agree to
              these terms, you should not use our service.
            </p>
          </section>

          <section>
            <h2 className="text-3xl font-black mb-4">
              2. Description of Service
            </h2>
            <p className="font-medium mb-4">
              Pulse is a voice feedback collection platform that allows
              businesses to collect, transcribe, and analyze customer feedback
              through QR codes and voice recordings.
            </p>
          </section>

          <section>
            <h2 className="text-3xl font-black mb-4">
              3. Account Registration
            </h2>
            <p className="font-medium mb-4">
              To use Pulse, you must create an account by providing a valid
              email address. You are responsible for maintaining the
              confidentiality of your account and for all activities that occur
              under your account.
            </p>
          </section>

          <section>
            <h2 className="text-3xl font-black mb-4">4. Pulse Credits</h2>
            <div className="space-y-4 font-medium">
              <p>
                Pulse operates on a credit-based system. Each voice feedback
                submission consumes one Pulse credit. You can purchase Pulse
                credits in packages.
              </p>
              <p>
                Pulse credits do not expire. All sales are final, and refunds
                are provided only in exceptional circumstances at our
                discretion.
              </p>
            </div>
          </section>

          <section>
            <h2 className="text-3xl font-black mb-4">5. Acceptable Use</h2>
            <p className="font-medium mb-4">You agree not to:</p>
            <ul className="space-y-2 font-medium list-disc list-inside">
              <li>Use the service for any illegal or unauthorized purpose</li>
              <li>Violate any laws in your jurisdiction</li>
              <li>Transmit any harmful, offensive, or inappropriate content</li>
              <li>Attempt to gain unauthorized access to our systems</li>
              <li>Interfere with or disrupt the service</li>
            </ul>
          </section>

          <section>
            <h2 className="text-3xl font-black mb-4">
              6. Intellectual Property
            </h2>
            <p className="font-medium mb-4">
              The service and its original content, features, and functionality
              are owned by Pulse and are protected by international copyright,
              trademark, and other intellectual property laws.
            </p>
          </section>

          <section>
            <h2 className="text-3xl font-black mb-4">
              7. Limitation of Liability
            </h2>
            <p className="font-medium mb-4">
              Pulse shall not be liable for any indirect, incidental, special,
              consequential, or punitive damages resulting from your use or
              inability to use the service.
            </p>
          </section>

          <section>
            <h2 className="text-3xl font-black mb-4">8. Termination</h2>
            <p className="font-medium mb-4">
              We may terminate or suspend your account immediately, without
              prior notice, for conduct that we believe violates these Terms of
              Service or is harmful to other users, us, or third parties.
            </p>
          </section>

          <section>
            <h2 className="text-3xl font-black mb-4">9. Changes to Terms</h2>
            <p className="font-medium mb-4">
              We reserve the right to modify these terms at any time. We will
              notify users of any material changes via email or through the
              service.
            </p>
          </section>

          <section>
            <h2 className="text-3xl font-black mb-4">
              10. Contact Information
            </h2>
            <p className="font-medium mb-4">
              If you have any questions about these Terms of Service, please
              contact us at:
            </p>
            <p className="font-bold">support@pulseapp.click</p>
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
