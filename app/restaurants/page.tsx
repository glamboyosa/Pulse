import { pageMetadata } from '../layout'
import { GuidePage } from '@/components/landing/guide-page'
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

const SECTIONS: Array<{
  heading: string
  body?: string
  items?: Array<string>
}> = [
  {
    heading: 'Why voice works better than a form',
    body: 'Most guests will never fill in a comment card or a survey. Many will happily talk for half a minute if it takes one tap. A voice note also carries the detail a star rating misses: which dish, which waiter, what was too slow.',
  },
  {
    heading: 'How it works',
    items: [
      'Print a table tent or sticker with your logo and question, in one click.',
      'Guests scan, tap record and say what they think, in their own language.',
      'Each note arrives transcribed, translated into English and summarised.',
      'Unhappy feedback is emailed to you straight away, so you can fix it while they are still in the restaurant.',
      'Every Monday you get up to three things to fix, with how many people raised each one, in their own words.',
    ],
  },
  {
    heading: 'Built for busy restaurants',
    items: [
      'One QR code per branch or table, so you know where each note came from.',
      'Reply to a guest who asks for one, without ever seeing their email address.',
      'After sending, every guest sees your thank-you message and Google review link, if you add them.',
      'Recordings are deleted after 12 months, and only your restaurant sees them.',
    ],
  },
]

export default function RestaurantsPage() {
  return (
    <GuidePage
      title={title}
      answer="Pulse lets restaurant guests leave feedback by scanning a QR code on the table and recording a short voice note in their own language. You read every note in English, get an email when someone is unhappy, and get a weekly list of what to fix. No app for guests and no subscription."
      faqs={FAQS}
    >
      {SECTIONS.map((section) => (
        <section key={section.heading} className="space-y-4">
          <h2 className="text-3xl font-black text-balance">
            {section.heading}
          </h2>
          {section.body && <p className="max-w-[65ch]">{section.body}</p>}
          {section.items && (
            <ul className="max-w-[65ch] list-disc space-y-2 pl-6">
              {section.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          )}
        </section>
      ))}
    </GuidePage>
  )
}
