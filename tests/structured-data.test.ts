import { describe, expect, it } from 'vitest'

import { faqJsonLd, jsonLdScript, softwareJsonLd } from '@/lib/structured-data'

describe('structured data', () => {
  it('prices Pulse from the smallest to the largest pack', () => {
    const app = softwareJsonLd({
      appUrl: 'https://pulse.test',
      url: 'https://pulse.test/software',
      description: 'Voice feedback',
    })
    expect(app.offers).toEqual({
      '@type': 'AggregateOffer',
      priceCurrency: 'USD',
      lowPrice: 4,
      highPrice: 120,
      offerCount: 6,
    })
  })

  it('cannot close its script tag early, and still parses back', () => {
    const data = faqJsonLd([{ q: 'Odd', a: '</script><script>alert(1)' }])
    const script = jsonLdScript(data)
    expect(script).not.toContain('</script>')
    expect(JSON.parse(script)).toEqual(data)
  })
})
