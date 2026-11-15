import { afterEach, describe, expect, it, vi } from 'vitest'

import { formatLocalApprox } from '@/lib/pricing'
import { getLocalPricing } from '@/server/local-pricing'

const requestHeaders = vi.hoisted(() => new Headers())
vi.mock('next/headers', () => ({
  headers: () => Promise.resolve(requestHeaders),
}))

const ratesBody = {
  result: 'success',
  rates: { USD: 1, NGN: 1450.5, ZAR: 18.2 },
}

afterEach(() => {
  requestHeaders.delete('x-vercel-ip-country')
  vi.unstubAllGlobals()
})

describe('formatLocalApprox', () => {
  it('shows naira with its sign, rounded and without decimals', () => {
    expect(formatLocalApprox(700, { currency: 'NGN', usdRate: 1450.5 })).toBe(
      '~₦10,000',
    )
    expect(formatLocalApprox(5500, { currency: 'NGN', usdRate: 1450.5 })).toBe(
      '~₦80,000',
    )
  })

  it('shows rand with R', () => {
    expect(formatLocalApprox(700, { currency: 'ZAR', usdRate: 18.2 })).toBe(
      '~R\u00a0130',
    )
  })

  it('rounds small amounts to whole units', () => {
    expect(formatLocalApprox(55, { currency: 'ZAR', usdRate: 18.2 })).toBe(
      '~R\u00a010',
    )
  })
})

describe('getLocalPricing', () => {
  it('returns the rate for a localised country', async () => {
    requestHeaders.set('x-vercel-ip-country', 'NG')
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Response.json(ratesBody)),
    )

    expect(await getLocalPricing()).toEqual({
      currency: 'NGN',
      usdRate: 1450.5,
    })
  })

  it('returns null without a country header, and does not fetch', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    expect(await getLocalPricing()).toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('returns null for a country we do not localise', async () => {
    requestHeaders.set('x-vercel-ip-country', 'US')
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
