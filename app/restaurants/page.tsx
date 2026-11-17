import { MapPin, Reply, ShieldCheck, Star } from 'lucide-react'

import { pageMetadata } from '../layout'
import { BranchesMock } from '@/components/landing/branches-mock'
import { GuidePage, GuideSection } from '@/components/landing/guide-page'
import { HeroMock } from '@/components/landing/hero-mock'
import { CUSTOM_PULSES_MAX, PACKS, formatUsd } from '@/lib/pricing'

const title = 'QR code customer feedback for restaurants'
const description =
  'A QR code on each table. Guests leave a short voice note in their own language; you read it in English, with alerts and a weekly list of what to fix.'

export const metadata = pageMetadata({
  title,
  description,
  path: '/restaurants',
})

const smallest = PACKS[0]
const largest = PACKS[PACKS.length - 1]

const FAQS = [
  {
    q: 'How do restaurant customers leave feedback with Pulse?',
    a: 'They scan the QR code on the table with their phone camera, tap record and talk for up to two minutes. No app, no account and no form. Customers who can’t record can type instead.',
  },
  {
    q: 'What if customers speak Yoruba, Pidgin or another language?',
    a: 'Pulse detects the language on its own and gives you an English translation beside the original. It is tested with English, Nigerian Pidgin, Yoruba, French and Portuguese, and handles most widely spoken languages.',
  },
  {
    q: 'How much does it cost?',
    a: `New restaurants get 5 free pulses. After that, packs start at ${formatUsd(smallest.priceCents)} for ${smallest.pulses} pieces of feedback, up to ${formatUsd(largest.priceCents)} for ${largest.pulses}, or any amount up to ${CUSTOM_PULSES_MAX}. There is no subscription and pulses never expire.`,
  },
  {
    q: 'Can I tell which branch or table the feedback came from?',
    a: 'Yes. Give each branch or table its own QR code, and every note shows where it was left.',
  },
  {
    q: 'Can I reward customers for leaving feedback?',
    a: 'Yes. Turn on vouchers and write your own offer, such as 10% off the next visit. Real feedback earns one, good or bad, up to limits you set, and staff redeem it by scanning its QR code or typing its code.',
  },
]

const STEPS = [
  'Print a table tent or sticker with your logo and question, in one click.',
  'Guests scan, tap record and say what they think, in their own language.',
  'Each note arrives transcribed, translated into English and summarised.',
  'Unhappy feedback is emailed to you straight away, so you can fix it while they are still in the restaurant.',
  'Every Monday you get up to three things to fix, with how many people raised each one, in their own words.',
]

const FEATURES = [
  {
    icon: MapPin,
    title: 'Know where it came from',
    body: 'One QR code per branch or table, so you know where each note came from.',
  },
  {
    icon: Reply,
    title: 'Reply privately',
    body: 'Reply to a guest who asks for one, without ever seeing their email address.',
  },
  {
    icon: Star,
    title: 'Google reviews too',
    body: 'After sending, every guest sees your thank-you message and Google review link, if you add them.',
  },
  {
    icon: ShieldCheck,
    title: 'Private by default',
    body: 'Recordings are deleted after 12 months, and only your restaurant sees them.',
  },
]

export default function RestaurantsPage() {
  return (
    <GuidePage
      eyebrow="Voice feedback for restaurants"
      title={title}
      answer="Pulse lets restaurant guests leave feedback by scanning a QR code on the table and recording a short voice note in their own language. You read every note in English, get an email when someone is unhappy, and get a weekly list of what to fix. No app for guests and no subscription."
      visual={<HeroMock />}
      faqs={FAQS}
      faqTinted={false}
      closing="Your guests already know what to fix. Let them say it."
    >
      <GuideSection heading="How it works" tinted>
        <ol className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {STEPS.map((step, i) => (
            <li
              key={step}
              className="rounded-lg border-2 border-foreground bg-card p-6 shadow-brutal"
            >
              <span className="mb-4 flex size-12 items-center justify-center rounded-md border-2 border-foreground bg-accent font-display text-2xl font-extrabold">
                {i + 1}
              </span>
              <p className="text-lg font-medium">{step}</p>
            </li>
          ))}
        </ol>
      </GuideSection>
      <GuideSection heading="Why voice works better than a form">
        <p className="max-w-[60ch] text-lg font-medium text-muted-foreground md:text-xl">
          Most guests will never fill in a comment card or a survey. Many will
          happily talk for half a minute if it takes one tap. A voice note also
          carries the detail a star rating misses: which dish, which waiter,
          what was too slow.
        </p>
      </GuideSection>
      <GuideSection heading="Built for busy restaurants" tinted>
        <div className="grid items-start gap-12 md:grid-cols-2">
          <ul className="grid gap-px overflow-hidden rounded-lg border-2 border-foreground bg-foreground sm:grid-cols-2 md:grid-cols-1 xl:grid-cols-2">
            {FEATURES.map(({ icon: Icon, title: name, body }) => (
              <li key={name} className="bg-card p-6">
                <Icon
                  className="mb-4 size-7"
                  strokeWidth={2.25}
                  aria-hidden="true"
                />
                <h3 className="mb-2 text-xl font-bold leading-tight">{name}</h3>
                <p className="font-medium text-muted-foreground">{body}</p>
              </li>
            ))}
          </ul>
          <BranchesMock />
        </div>
      </GuideSection>
    </GuidePage>
  )
}
