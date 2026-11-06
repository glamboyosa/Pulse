// Pulse packs and custom-amount pricing. Shared by the buy page and the
// server, which is the only place a checkout price is actually set.

export const PACKS = [
  { id: 'starter', pulses: 10, priceCents: 700 },
  { id: 'popular', pulses: 25, priceCents: 1600 },
  { id: 'growth', pulses: 50, priceCents: 3000 },
  { id: 'scale', pulses: 100, priceCents: 5500 },
] as const

export type PackId = (typeof PACKS)[number]['id']

export const CUSTOM_PULSES_MIN = 5
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
