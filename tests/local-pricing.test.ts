import { afterEach, describe, expect, it, vi } from 'vitest'

import { currencyForCountry, formatLocalApprox } from '@/lib/pricing'
import { getLocalPricing } from '@/server/local-pricing'

const requestHeaders = vi.hoisted(() => new Headers())
vi.mock('next/headers', () => ({
  headers: () => Promise.resolve(requestHeaders),
}))

const ratesBody = {
  result: 'success',
  rates: {
    USD: 1,
    NGN: 1450.5,
    ZAR: 18.2,
    KES: 129.3,
    EUR: 0.86,
    HRK: 6.5,
    XOF: 563.4,
    CLF: 0.024,
    CLP: 940.1,
    PAB: 1,
  },
}
const ratedCurrencies = Object.keys(ratesBody.rates)

afterEach(() => {
  requestHeaders.delete('x-vercel-ip-country')
  vi.unstubAllGlobals()
})

describe('currencyForCountry', () => {
  it('finds the currency whose code starts with the country code', () => {
    expect(currencyForCountry('NG', ratedCurrencies)).toBe('NGN')
    expect(currencyForCountry('KE', ratedCurrencies)).toBe('KES')
  })

  it('uses the shared currency, even where an old code still has a rate', () => {
    expect(currencyForCountry('SN', ratedCurrencies)).toBe('XOF')
    expect(currencyForCountry('HR', ratedCurrencies)).toBe('EUR')
  })

  it('picks the everyday currency when several codes match', () => {
    expect(currencyForCountry('CL', ratedCurrencies)).toBe('CLP')
  })

  it('treats dollar-pegged countries as USD', () => {
    expect(currencyForCountry('PA', ratedCurrencies)).toBe('USD')
  })

  it('returns null when no rated currency fits', () => {
    expect(currencyForCountry('EC', ratedCurrencies)).toBeNull()
    expect(currencyForCountry('GH', ratedCurrencies)).toBeNull()
  })
})

describe('formatLocalApprox', () => {
  const ng = { country: 'NG', currency: 'NGN', usdRate: 1450.5 }

  it('shows naira with its sign, rounded and without decimals', () => {
    expect(formatLocalApprox(700, ng)).toBe('~₦10,000')
    expect(formatLocalApprox(5500, ng)).toBe('~₦80,000')
  })

  it('writes the amount the way the country does', () => {
    const za = { country: 'ZA', currency: 'ZAR', usdRate: 18.2 }
    expect(formatLocalApprox(700, za)).toBe('~R 130')
    const ke = { country: 'KE', currency: 'KES', usdRate: 129.3 }
    expect(formatLocalApprox(700, ke)).toBe('~Ksh 910')
    const india = { country: 'IN', currency: 'INR', usdRate: 88.7 }
    expect(formatLocalApprox(275_00, india)).toBe('~₹24,000')
  })

  it('never shows a bare $ for a local dollar', () => {
    const ca = { country: 'CA', currency: 'CAD', usdRate: 1.4 }
    expect(formatLocalApprox(700, ca)).toBe('~CA$10')
    const mx = { country: 'MX', currency: 'MXN', usdRate: 18.4 }
    expect(formatLocalApprox(700, mx)).toBe('~MX$130')
  })

  it('keeps £ for sterling but not for other pounds', () => {
    const gb = { country: 'GB', currency: 'GBP', usdRate: 0.76 }
    expect(formatLocalApprox(700, gb)).toBe('~£5')
    const sy = { country: 'SY', currency: 'SYP', usdRate: 13000 }
    expect(formatLocalApprox(700, sy)).not.toContain('£')
    const eg = { country: 'EG', currency: 'EGP', usdRate: 48.5 }
    expect(formatLocalApprox(700, eg)).toBe('~E£340')
  })

  it('rounds small amounts to whole units', () => {
    const za = { country: 'ZA', currency: 'ZAR', usdRate: 18.2 }
    expect(formatLocalApprox(55, za)).toBe('~R 10')
  })
})

describe('getLocalPricing', () => {
  it('returns the currency and rate for the visitor country', async () => {
    requestHeaders.set('x-vercel-ip-country', 'KE')
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Response.json(ratesBody)),
    )

    expect(await getLocalPricing()).toEqual({
      country: 'KE',
      currency: 'KES',
      usdRate: 129.3,
    })
  })

  it.each([null, 'US', 'T1'])(
    'returns null without fetching for country %s',
    async (country) => {
      if (country) requestHeaders.set('x-vercel-ip-country', country)
      const fetchMock = vi.fn()
      vi.stubGlobal('fetch', fetchMock)

      expect(await getLocalPricing()).toBeNull()
      expect(fetchMock).not.toHaveBeenCalled()
    },
  )

  it('returns null for a country that uses USD', async () => {
    requestHeaders.set('x-vercel-ip-country', 'PA')
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Response.json(ratesBody)),
    )

    expect(await getLocalPricing()).toBeNull()
  })

  it('returns null when the rates request fails', async () => {
    requestHeaders.set('x-vercel-ip-country', 'ZA')
    vi.stubGlobal(
      'fetch',
      vi.fn(() => {
        throw new TypeError('fetch failed')
      }),
    )

    expect(await getLocalPricing()).toBeNull()
  })

  it('returns null when the rates response is not a success', async () => {
    requestHeaders.set('x-vercel-ip-country', 'ZA')
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Response.json({ result: 'error' }, { status: 429 })),
    )

    expect(await getLocalPricing()).toBeNull()
  })

  it('returns null when the rates lack the currency', async () => {
    requestHeaders.set('x-vercel-ip-country', 'NG')
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Response.json({ result: 'success', rates: { USD: 1 } })),
    )

    expect(await getLocalPricing()).toBeNull()
  })
})
