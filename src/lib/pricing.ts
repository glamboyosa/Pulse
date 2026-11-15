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

// Countries whose currency code doesn't start with the country code: shared
// currencies, and countries with more than one matching code in the rates.
// Bermuda, the Bahamas and Panama peg 1:1 to the dollar, so they see USD only.
const CURRENCY_EXCEPTIONS: Record<string, string> = {
  USD: 'BM BS PA',
  EUR: 'AD AT AX BE BG BL CY DE EE ES FI FR GF GP GR HR IE IT LT LU LV MC ME MF MQ MT NL PM PT RE SI SK SM VA XK YT',
  XOF: 'BF BJ CI GW ML NE SN TG',
  XAF: 'CF CG CM GA GQ TD',
  XCD: 'AG AI DM GD KN LC MS VC',
  XPF: 'NC PF WF',
  XCG: 'CW SX',
  AUD: 'CC CX NF NR',
  NZD: 'CK NU PN TK',
  DKK: 'GL',
  CHF: 'LI',
  MAD: 'EH',
  ILS: 'PS',
  CLP: 'CL',
  CNY: 'CN',
  SLE: 'SL',
  ZWG: 'ZW',
}

const COUNTRY_CURRENCY_EXCEPTIONS: Record<string, string> = Object.fromEntries(
  Object.entries(CURRENCY_EXCEPTIONS).flatMap(([currency, countries]) =>
    countries.split(' ').map((country) => [country, currency]),
  ),
)

/**
 * The currency for an ISO country code, picked from the codes we have rates
 * for, or null when there is none. Most currency codes start with the country
 * code (NGN for NG, KES for KE); the rest are listed above.
 */
export const currencyForCountry = (
  country: string,
  ratedCurrencies: Array<string>,
): string | null => {
  const exception = COUNTRY_CURRENCY_EXCEPTIONS[country]
  if (exception) return ratedCurrencies.includes(exception) ? exception : null
  return ratedCurrencies.find((code) => code.startsWith(country)) ?? null
}

export type LocalPricing = {
  country: string
  currency: string
  usdRate: number
}

// Pounds pegged 1:1 to sterling, which rightly show as "£".
const STERLING = ['GBP', 'GIP', 'FKP', 'SHP']

/**
 * Approximate local price for a USD amount, like "~₦10,000", written the way
 * the visitor's country writes it. Rounded to two significant figures with no
 * decimals: the figure is a guide, and the exact amount depends on the bank.
 */
export const formatLocalApprox = (
  usdCents: number,
  { country, currency, usdRate }: LocalPricing,
): string => {
  const amount = (usdCents / 100) * usdRate
  const step = 10 ** Math.max(0, Math.floor(Math.log10(amount)) - 1)
  const rounded = Math.round(amount / step) * step
  const format = (locale: string, currencyDisplay: 'narrowSymbol' | 'symbol') =>
    new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      currencyDisplay,
      maximumFractionDigits: 0,
    }).format(rounded)
  const local = format(`en-${country}`, 'narrowSymbol')
  // A local "$" (Canada, Mexico, ...) would read as USD next to the real price,
  // and a bare "£" (Syria, South Sudan) as sterling, so those get a prefixed
  // symbol like CA$ or a code like SYP instead.
  const misleading =
    local.includes('$') ||
    (/(^|[^A-Za-z])£/.test(local) && !STERLING.includes(currency))
  return `~${misleading ? format('en-US', 'symbol') : local}`
}
