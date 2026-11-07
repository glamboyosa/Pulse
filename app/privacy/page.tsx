import Link from 'next/link'

import { LegalPage } from '@/components/legal-page'

export const metadata = { title: 'Privacy' }

const SUBPROCESSORS = [
  ['Vercel', 'Hosts the app and runs it'],
  ['Neon', 'Database: accounts, transcripts, settings'],
  ['Cloudflare R2', 'Stores recordings and logos'],
  ['ElevenLabs', 'Turns recordings into text'],
  [
    'OpenAI (OpenRouter as a fallback)',
    'Translates, summarises and tags feedback, and writes weekly digests',
  ],
  ['Resend', 'Sends login codes, alerts, digests and replies'],
  [
    'Cloudflare Turnstile',
    'Checks that logins and feedback come from a person, not a bot',
  ],
  ['Polar', 'Takes payments for pulses, as merchant of record'],
] as const

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy" updated="6 November 2026">
      <section>
        <p>
          Pulse lets businesses collect voice feedback through a QR code. This
          page explains what we keep, why, for how long, and how to get it
          deleted. Questions go to{' '}
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
        <h2>Who is responsible for what</h2>
        <p>
          For business accounts, Pulse decides how that data is used (we are the
          controller). For feedback a customer leaves, the business they leave
          it with is in charge, and Pulse handles it on their behalf (we are the
          processor). Businesses can sign our{' '}
          <Link href="/dpa" className="font-bold underline">
            data processing agreement
          </Link>
          .
        </p>
      </section>

      <section id="customers">
        <h2>If you leave feedback</h2>
        <ul>
          <li>
            Your recording, or what you type, goes to the business whose QR code
            you scanned. Nobody else sees it.
          </li>
          <li>
            It is transcribed and, if needed, translated into English by AI. The
            AI also writes a one-line summary and picks out topics.
          </li>
          <li>
            The AI services that transcribe and summarise your feedback
            don&apos;t use it to train their models.
          </li>
          <li>Your name is only stored if you give it or say it.</li>
          <li>
            If you leave an email for a reply, the business can send you one
            reply through Pulse. They don&apos;t see your address unless you
            write back. We forget it within a day of their reply, or after 90
            days.
          </li>
          <li>
            To have your feedback deleted, ask the business, or email us with
            the business name and roughly when you left it.
          </li>
        </ul>
      </section>

      <section>
        <h2>If you run a business on Pulse</h2>
        <ul>
          <li>
            We keep your email, business details, settings, spots, the feedback
            you receive and a record of pulses you buy.
          </li>
          <li>Polar handles payments. We never see your card details.</li>
          <li>
            We email you login codes, new feedback, low-balance warnings and a
            weekly digest. Nothing is sold or shared for advertising.
          </li>
          <li>
            In Settings you can export everything as a file, delete any piece of
            feedback, or delete your whole account straight away.
          </li>
        </ul>
      </section>

      <section>
        <h2>How long we keep things</h2>
        <ul>
          <li>Recordings: 12 months, then deleted automatically.</li>
          <li>
            Transcripts, summaries and settings: until you delete them or your
            account.
          </li>
          <li>Reply addresses: until a day after the reply, or 90 days.</li>
          <li>Login codes: they stop working after 10 minutes.</li>
          <li>
            Security logs (a failed bot check or a hit rate limit, with the IP
            address): kept by our host for a short time to spot abuse.
          </li>
          <li>
            Deleted data can remain in our providers&apos; backups for up to 30
            days.
          </li>
        </ul>
      </section>

      <section>
        <h2>Services we use</h2>
        <p>
          These companies process data for us, each under its own data
          processing terms. Some are in the United States; transfers rely on
          their standard contractual clauses.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full border-2 border-foreground text-left text-base">
            <thead className="bg-secondary">
              <tr>
                <th scope="col" className="border-b-2 border-foreground p-3">
                  Service
                </th>
                <th scope="col" className="border-b-2 border-foreground p-3">
                  What it does
                </th>
              </tr>
            </thead>
            <tbody>
              {SUBPROCESSORS.map(([name, role]) => (
                <tr
                  key={name}
                  className="border-b-2 border-foreground last:border-b-0"
                >
                  <td className="p-3 font-bold">{name}</td>
                  <td className="p-3">{role}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2>Security</h2>
        <p>
          Everything travels over HTTPS and is encrypted at rest by our storage
          and database providers. Recordings are only reachable through
          short-lived signed links, and each business can only see its own
          feedback.
        </p>
      </section>

      <section>
        <h2>Cookies</h2>
        <p>
          Pulse sets one cookie, to keep you signed in. There are no analytics
          or advertising cookies.
        </p>
      </section>

      <section>
        <h2>Your rights</h2>
        <p>
          You can ask to see, correct, export or delete your data, or object to
          how we use it. Business owners can do most of this themselves in
          Settings; anyone else can email{' '}
          <a
            href="mailto:support@pulseapp.click"
            className="font-bold underline"
          >
            support@pulseapp.click
          </a>{' '}
          and we will reply within 30 days. You can also complain to your data
          protection authority.
        </p>
      </section>
    </LegalPage>
  )
}
