import Link from 'next/link'

import { LegalPage } from '@/components/legal-page'

export const metadata = { title: 'Terms' }

export default function TermsPage() {
  return (
    <LegalPage title="Terms" updated="6 November 2026">
      <section>
        <p>
          These terms cover using Pulse to collect feedback from your customers.
          By creating an account you agree to them. Questions go to{' '}
          <a
            href="mailto:support@pulseapp.click"
            className="font-bold underline"
          >
            support@pulseapp.click
          </a>
          .
        </p>
      </section>

      <section>
        <h2>Your account</h2>
        <ul>
          <li>
            You sign in with a code sent to your email. Keep that inbox secure.
          </li>
          <li>
            You are responsible for how your business uses Pulse, including
            telling customers that feedback is recorded and analysed
            (Pulse&apos;s page tells them too).
          </li>
          <li>You can delete your account at any time from Settings.</li>
        </ul>
      </section>

      <section>
        <h2>Pulses and payment</h2>
        <ul>
          <li>
            Each piece of feedback, recorded or typed, uses one pulse. New
            accounts get 5 free.
          </li>
          <li>
            Polar sells pulses to you as merchant of record, so its checkout
            terms and receipts apply to the purchase.
          </li>
          <li>
            Pulses don&apos;t expire. Unused pulses are not refunded when you
            delete your account. If something went wrong with a purchase, email
            us within 14 days and we will make it right.
          </li>
        </ul>
      </section>

      <section>
        <h2>Fair use</h2>
        <p>Don&apos;t use Pulse to:</p>
        <ul>
          <li>
            collect feedback for a business you don&apos;t run or represent;
          </li>
          <li>
            send replies that are spam, harassment, or anything other than an
            answer to the feedback;
          </li>
          <li>break the law, or try to break into Pulse or other accounts.</li>
        </ul>
        <p>We may suspend accounts that do.</p>
      </section>

      <section>
        <h2>AI and accuracy</h2>
        <p>
          Transcripts, translations, summaries and digests are written by AI and
          can be wrong. The original recording is there to check against.
        </p>
      </section>

      <section>
        <h2>Availability and liability</h2>
        <p>
          We work to keep Pulse running and your data safe, but provide it as
          is. As far as the law allows, our liability is limited to what you
          paid us in the 12 months before a claim.
        </p>
      </section>

      <section>
        <h2>Privacy and changes</h2>
        <p>
          How we handle data is on the{' '}
          <Link href="/privacy" className="font-bold underline">
            privacy page
          </Link>
          . If these terms change in a way that matters, we will email you
          first.
        </p>
      </section>
    </LegalPage>
  )
}
