// Pulse packs and custom-amount pricing. Shared by the buy page and the
// server, which is the only place a checkout price is actually set.

export const PACKS = [
  { id: 'starter', pulses: 10, priceCents: 700 },
  { id: 'popular', pulses: 25, priceCents: 1600 },
  { id: 'growth', pulses: 50, priceCents: 3000 },
  { id: 'scale', pulses: 100, priceCents: 5500 },
] as const

export type PackId = (typeof PACKS)[number]['id']

// Above the smallest pack, so a custom amount never undercuts it.
export const CUSTOM_PULSES_MIN = 11
export const CUSTOM_PULSES_MAX = 500

/**
 * Price in cents for a custom number of pulses. A custom amount costs the
 * per-pulse rate of the largest pack it reaches, so it is never cheaper than
 * buying packs.
 */
export const customPriceCents = (pulses: number): number => {
  const rate =
    [...PACKS].reverse().find((pack) => pulses >= pack.pulses) ?? PACKS[0]
  return Math.round((rate.priceCents / rate.pulses) * pulses)
}

export const formatUsd = (cents: number): string =>
  `$${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`

// Countries that see an approximate local price next to the USD one, keyed by
// the ISO code in Vercel's x-vercel-ip-country header. Billing stays in USD.
export const LOCAL_CURRENCIES: Record<string, string> = {
  NG: 'NGN',
  ZA: 'ZAR',
}

export type LocalPricing = { currency: string; usdRate: number }

/**
 * Approximate local price for a USD amount, like "~₦10,000". Rounded to two
 * significant figures with no decimals: the figure is a guide, and the exact
 * amount depends on the buyer's bank.
 */
export const formatLocalApprox = (
  usdCents: number,
  { currency, usdRate }: LocalPricing,
): string => {
  const amount = (usdCents / 100) * usdRate
  const step = 10 ** Math.max(0, Math.floor(Math.log10(amount)) - 1)
  const formatted = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    currencyDisplay: 'narrowSymbol',
    maximumFractionDigits: 0,
  }).format(Math.round(amount / step) * step)
  return `~${formatted}`
}
