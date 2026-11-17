import { pageMetadata } from '../../layout'
import { GuidePage, GuideSection } from '@/components/landing/guide-page'
import { HeroMock } from '@/components/landing/hero-mock'

const title = 'Pulse vs Google reviews'
const description =
  'Google reviews help new customers find you. Pulse is private voice feedback that tells you what to fix. How they differ, and why to use both.'

export const metadata = pageMetadata({
  title,
  description,
  path: '/compare/google-reviews',
})

const ROWS: Array<[string, string, string]> = [
  ['Who sees it', 'Only your business', 'Everyone, publicly'],
  [
    'What the customer needs',
    'A phone camera. No app or account',
    'A Google account',
  ],
  [
    'Format',
    'A voice note of up to two minutes, or typed text when they can’t record',
    'A star rating and written text, with optional photos',
  ],
  [
    'Languages',
    'Most widely spoken languages, translated into English for you',
    'Shown as written, with machine translation for readers',
  ],
  [
    'When you hear about a problem',
    'An email as soon as someone is unhappy',
    'When you next check your profile or notifications',
  ],
  [
    'What you get each week',
    'Up to three things to fix, with how many people raised each',
    'Your new reviews and rating',
  ],
  ['Cost', '5 free, then pay per piece of feedback', 'Free'],
  [
    'Main job',
    'Learning what to fix before it costs you customers',
    'Helping new customers find and trust you',
  ],
]

const FAQS = [
  {
    q: 'Is Pulse a replacement for Google reviews?',
    a: 'No. Google reviews are public and help new customers find you. Pulse is private and tells you what to fix. They work together: add your Google review link to Pulse, and every customer sees it after leaving feedback.',
  },
  {
    q: 'Does Pulse send only happy customers to Google?',
    a: 'No. Once you add your Google review link, every customer sees it after sending feedback, whatever they said. Asking only happy customers for reviews breaks Google’s rules, so Pulse never filters by sentiment.',
  },
  {
    q: 'Can I give vouchers for Google reviews?',
    a: 'No, and Pulse doesn’t. Pulse vouchers reward leaving private feedback, good or bad, and have nothing to do with the Google review link. Paying for reviews breaks Google’s policy and consumer law in many countries.',
  },
  {
    q: 'Why would customers tell Pulse things they won’t put on Google?',
    a: 'It is private, it takes one tap, and they can talk instead of type, in their own language. Many people who would never write a public review will say what went wrong in thirty seconds.',
  },
]

const WHEN = [
  {
    title: 'Google reviews, to be found',
    body: 'They shape your rating in Search and Maps.',
  },
  {
    title: 'Pulse, to improve',
    body: 'Hear the specific problems from the many customers who would never write a public review.',
  },
  {
    title: 'Both, together',
    body: 'Pulse collects private feedback first, then points every customer to your Google profile once you add your review link.',
  },
]

export default function GoogleReviewsComparisonPage() {
  return (
    <GuidePage
      eyebrow="Comparison"
      title={title}
      answer="Google reviews are public star ratings that help new customers find and trust you. Pulse is private voice feedback: customers scan a QR code, talk for a minute in their own language, and you get what to fix, with an alert when someone is unhappy. Most businesses benefit from both, and Pulse can show every customer your Google review link after they leave feedback."
      visual={<HeroMock />}
      faqs={FAQS}
      closing="Hear what customers won’t post publicly."
    >
      <GuideSection heading="Side by side" tinted>
        <div
          tabIndex={0}
          role="region"
          aria-label="Pulse vs Google reviews"
          className="overflow-x-auto rounded-lg border-2 border-foreground bg-card shadow-brutal"
        >
          <table className="w-full border-collapse text-left text-sm sm:text-base">
            <thead className="bg-accent">
              <tr>
                <th scope="col" className="p-2 font-bold sm:p-4">
                  <span className="sr-only">Question</span>
                </th>
                <th scope="col" className="p-2 text-lg font-extrabold sm:p-4">
                  Pulse
                </th>
                <th scope="col" className="p-2 text-lg font-extrabold sm:p-4">
                  Google reviews
                </th>
              </tr>
            </thead>
            <tbody>
              {ROWS.map(([label, pulse, google]) => (
                <tr key={label} className="border-t-2 border-foreground">
                  <th scope="row" className="p-2 align-top font-bold sm:p-4">
                    {label}
                  </th>
                  <td className="p-2 align-top font-medium sm:p-4">{pulse}</td>
                  <td className="p-2 align-top font-medium sm:p-4">{google}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </GuideSection>
      <GuideSection heading="When to use which">
        <ul className="grid gap-6 md:grid-cols-3">
          {WHEN.map((item) => (
            <li
              key={item.title}
              className="rounded-lg border-2 border-foreground bg-card p-6 shadow-brutal"
            >
              <h3 className="mb-2 text-2xl font-bold leading-tight">
                {item.title}
              </h3>
              <p className="font-medium text-muted-foreground">{item.body}</p>
            </li>
          ))}
        </ul>
      </GuideSection>
    </GuidePage>
  )
}
