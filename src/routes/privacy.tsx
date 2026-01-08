import { Link, createFileRoute } from '@tanstack/react-router'

import { PulseLogo } from '@/components/pulse-logo'

export const Route = createFileRoute('/privacy')({
  component: PrivacyPage,
})

function PrivacyPage() {
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
        <h1 className="text-5xl font-black mb-8">PRIVACY POLICY</h1>
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
            <h2 className="text-3xl font-black mb-4">1. Introduction</h2>
            <p className="font-medium mb-4">
              Pulse ("we," "our," or "us") is committed to protecting your
              privacy. This Privacy Policy explains how we collect, use,
              disclose, and safeguard your information when you use our voice
              feedback collection service.
            </p>
          </section>

          <section>
            <h2 className="text-3xl font-black mb-4">
              2. Information We Collect
            </h2>
            <div className="space-y-4 font-medium">
              <div>
                <h3 className="text-xl font-bold mb-2">Account Information</h3>
                <p>
                  When you create an account, we collect your email address and
                  business information (business name, type, and unique code).
                </p>
              </div>
              <div>
                <h3 className="text-xl font-bold mb-2">Voice Feedback</h3>
                <p>
                  We collect and store voice recordings submitted by your
                  customers through our service. These recordings are
                  automatically transcribed and stored securely.
                </p>
              </div>
              <div>
                <h3 className="text-xl font-bold mb-2">Usage Data</h3>
                <p>
                  We collect information about how you use our service,
                  including feedback submission counts, pulse usage, and
                  dashboard interactions.
                </p>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-3xl font-black mb-4">
              3. How We Use Your Information
            </h2>
            <ul className="space-y-2 font-medium list-disc list-inside">
              <li>To provide and maintain our service</li>
              <li>To process and transcribe voice feedback</li>
              <li>To send you service-related communications</li>
              <li>To improve our service and develop new features</li>
              <li>To comply with legal obligations</li>
            </ul>
          </section>

          <section>
            <h2 className="text-3xl font-black mb-4">
              4. Data Storage and Security
            </h2>
            <p className="font-medium mb-4">
              All voice recordings and transcripts are encrypted and stored
              securely using industry-standard security measures. We use
              Cloudflare R2 for audio storage and implement access controls to
              protect your data.
            </p>
          </section>

          <section>
            <h2 className="text-3xl font-black mb-4">5. Data Retention</h2>
            <p className="font-medium mb-4">
              We retain your account information and feedback data for as long
              as your account is active. You may request deletion of your data
              at any time by contacting us.
            </p>
          </section>

          <section>
            <h2 className="text-3xl font-black mb-4">6. Your Rights</h2>
            <p className="font-medium mb-4">
              Under GDPR and other privacy laws, you have the right to:
            </p>
            <ul className="space-y-2 font-medium list-disc list-inside">
              <li>Access your personal data</li>
              <li>Request correction of inaccurate data</li>
              <li>Request deletion of your data</li>
              <li>Object to processing of your data</li>
              <li>Data portability</li>
            </ul>
          </section>

          <section>
            <h2 className="text-3xl font-black mb-4">
              7. Third-Party Services
            </h2>
            <p className="font-medium mb-4">
              We use the following third-party services:
            </p>
            <ul className="space-y-2 font-medium list-disc list-inside">
              <li>Google Gemini API for audio transcription</li>
              <li>Cloudflare R2 for audio storage</li>
              <li>Resend for email delivery</li>
            </ul>
          </section>

          <section>
            <h2 className="text-3xl font-black mb-4">8. Contact Us</h2>
            <p className="font-medium mb-4">
              If you have questions about this Privacy Policy, please contact us
              at:
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
