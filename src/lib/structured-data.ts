// Schema.org JSON-LD for search engines and AI assistants: what Pulse is, what
// it costs and the answers to common questions, in a form they read directly.
import { PACKS } from './pricing'

type JsonLd = Record<string, unknown>

/**
 * Serialises JSON-LD for a <script type="application/ld+json"> tag. "<" is
 * escaped so text such as "</script>" in an answer can't end the tag early.
 */
export const jsonLdScript = (data: JsonLd) =>
  JSON.stringify(data).replace(/</g, '\\u003c')

export const organizationJsonLd = (appUrl: string): JsonLd => ({
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'Pulse',
  url: appUrl,
  logo: `${appUrl}/logo512.png`,
  email: 'support@pulseapp.click',
  founder: { '@type': 'Person', name: 'Timothy Osaretin Ogbemudia' },
})

/**
 * Pulse as a web app, priced by the pulse packs (one-off, no subscription).
 * Published once, on /software. Google's software rich result also wants
 * ratings, which Pulse doesn't have yet, so this is for understanding only.
 */
export const softwareJsonLd = ({
  appUrl,
  url,
  description,
}: {
  appUrl: string
  url: string
  description: string
}): JsonLd => {
  const prices = PACKS.map((pack) => pack.priceCents / 100)
  return {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'Pulse',
    url,
    description,
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web',
    publisher: { '@type': 'Organization', name: 'Pulse', url: appUrl },
    offers: {
      '@type': 'AggregateOffer',
      priceCurrency: 'USD',
      lowPrice: Math.min(...prices),
      highPrice: Math.max(...prices),
      offerCount: PACKS.length,
    },
  }
}

export const faqJsonLd = (faqs: ReadonlyArray<{ q: string; a: string }>) => ({
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: faqs.map(({ q, a }) => ({
    '@type': 'Question',
    name: q,
    acceptedAnswer: { '@type': 'Answer', text: a },
  })),
})
