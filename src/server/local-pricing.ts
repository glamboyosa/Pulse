import { headers } from 'next/headers'
import { z } from 'zod'

import type { LocalPricing } from '@/lib/pricing'
import { currencyForCountry } from '@/lib/pricing'

const ratesResponse = z.object({
  result: z.literal('success'),
  rates: z.record(z.string(), z.number().positive()),
})

/**
 * The visitor's local currency and its rate against USD, or null when the
 * country is unknown, uses USD, or the rate can't be fetched. The rates are
 * cached for a day.
 */
export const getLocalPricing = async (): Promise<LocalPricing | null> => {
  const country = (await headers()).get('x-vercel-ip-country')
  if (!country || !/^[A-Z]{2}$/.test(country) || country === 'US') return null

  try {
    const response = await fetch('https://open.er-api.com/v6/latest/USD', {
      next: { revalidate: 60 * 60 * 24 },
      signal: AbortSignal.timeout(1500),
    })
    const parsed = ratesResponse.safeParse(await response.json())
    if (!parsed.success) return null
    const { rates } = parsed.data
    const currency = currencyForCountry(country, Object.keys(rates))
    if (!currency || currency === 'USD') return null
    return { country, currency, usdRate: rates[currency] }
  } catch {
    // Without a rate the page shows USD only, which is still correct.
    return null
  }
}
