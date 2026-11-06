import Link from 'next/link'

import { LegalPage } from '@/components/legal-page'

export const metadata = { title: 'Data processing agreement' }

export default function DpaPage() {
  return (
    <LegalPage title="Data processing agreement" updated="6 November 2026">
      <section>
        <p>
          This agreement covers the feedback your customers leave through Pulse,
          which Pulse processes on your behalf. It applies once you use Pulse
          for your business. For a countersigned copy, email{' '}
          <a
            href="mailto:support@pulseapp.click"
            className="font-bold underline"
          >
            support@pulseapp.click
          </a>{' '}
          with your business&apos;s legal name and address.
        </p>
      </section>

      <section>
        <h2>1. Roles</h2>
        <p>
          You (the business) are the controller of your customers&apos;
          feedback. Pulse is the processor and acts only on your documented
          instructions, which are: collect feedback through your QR codes, store
          it, transcribe, translate and analyse it, show it to you, and email
          you about it.
        </p>
      </section>

      <section>
        <h2>2. What is processed</h2>
        <ul>
          <li>
            People: your customers who leave feedback, and your own staff who
            use Pulse.
          </li>
          <li>
            Data: voice recordings, typed feedback, transcripts, translations,
            summaries and topics, optional names, optional reply email
            addresses, and when and where (which QR code) feedback was left.
          </li>
          <li>
            Pulse does not ask for special category data. If a customer says
            something sensitive in a recording, it is processed only as part of
            that recording.
          </li>
        </ul>
      </section>

      <section>
        <h2>3. Pulse&apos;s obligations</h2>
        <ul>
          <li>Process the data only to provide Pulse to you.</li>
          <li>
            Use sub-processors that don&apos;t train AI models on your
            customers&apos; feedback.
          </li>
          <li>
            Make sure anyone with access to it is bound to keep it confidential.
          </li>
          <li>
            Keep it secure: encryption in transit and at rest, short-lived
            signed links for recordings, and access limited to each
            business&apos;s own data.
          </li>
          <li>
            Use only the sub-processors listed on the{' '}
            <Link href="/privacy" className="font-bold underline">
              privacy page
            </Link>
            , bind each to equivalent data protection terms, and announce new
            ones there at least 14 days before they start.
          </li>
          <li>
            Help you answer your customers&apos; requests to see or delete their
            feedback. You can delete any feedback yourself in Pulse.
          </li>
          <li>
            Tell you without undue delay, and within 72 hours of finding out,
            about any breach affecting your data.
          </li>
          <li>
            Give you the information you reasonably need to show you comply, and
            answer written questions about how Pulse protects your data.
          </li>
        </ul>
      </section>

      <section>
        <h2>4. Transfers</h2>
        <p>
          Some sub-processors are outside the UK and the EEA, mainly in the
          United States. Those transfers rely on the European Commission&apos;s
          standard contractual clauses or the UK equivalent, as set out in each
          sub-processor&apos;s terms.
        </p>
      </section>

      <section>
        <h2>5. Retention and deletion</h2>
        <p>
          Recordings are deleted after 12 months, and reply addresses within a
          day of the reply or after 90 days. Everything else stays until you
          delete it or your account. When you delete your account, Pulse deletes
          your data straight away; copies in backups can remain for up to 30
          days. You can export your data from Settings first.
        </p>
      </section>

      <section>
        <h2>6. Your obligations</h2>
        <p>
          You confirm you have a lawful basis for collecting feedback, and that
          your QR codes or signs make clear that feedback is recorded and
          analysed. Pulse&apos;s feedback page shows customers this too.
        </p>
      </section>

      <section>
        <p className="text-base text-muted-foreground">
          This agreement is a standard template, not legal advice. If your
          business needs different terms, email us.
        </p>
      </section>
    </LegalPage>
  )
}
