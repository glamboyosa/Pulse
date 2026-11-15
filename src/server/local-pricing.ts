import { headers } from 'next/headers'
import { z } from 'zod'

import type { LocalPricing } from '@/lib/pricing'
import { LOCAL_CURRENCIES } from '@/lib/pricing'

const ratesResponse = z.object({
  result: z.literal('success'),
  rates: z.record(z.string(), z.number().positive()),
})

/**
 * The visitor's local currency and its rate against USD, or null when the
 * country is unknown, not one we localise, or the rate can't be fetched. The
 * rates are cached for a day.
 */
export const getLocalPricing = async (): Promise<LocalPricing | null> => {
  const country = (await headers()).get('x-vercel-ip-country')
  const currency = country ? LOCAL_CURRENCIES[country] : undefined
  if (!currency) return null

  try {
    const response = await fetch('https://open.er-api.com/v6/latest/USD', {
      next: { revalidate: 60 * 60 * 24 },
      signal: AbortSignal.timeout(1500),
    })
    const parsed = ratesResponse.safeParse(await response.json())
    const usdRate = parsed.success ? parsed.data.rates[currency] : undefined
    return usdRate ? { currency, usdRate } : null
  } catch {
    // Without a rate the page shows USD only, which is still correct.
    return null
  }
}
