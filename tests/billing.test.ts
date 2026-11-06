import { sql } from 'drizzle-orm'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createBusiness, pulsesOf, resetDatabase } from './support/db'
import type { PaidOrder } from '@/server/billing'
import { db } from '@/db/index'
import { customPriceCents } from '@/lib/pricing'
import {
  CheckoutError,
  createCheckout,
  creditPaidOrder,
  refundOrder,
} from '@/server/billing'

const STARTER_SANDBOX = '9d2ffe60-4204-4ed0-abc2-9707e66d713f'
const SCALE_PRODUCTION = 'f4f82b5c-2c39-4b8d-a8bf-53de00594e21'

const order = (overrides: Partial<PaidOrder> = {}): PaidOrder => ({
  id: crypto.randomUUID(),
  productId: STARTER_SANDBOX,
  totalAmount: 700,
  netAmount: 700,
  refundedAmount: 0,
  metadata: {},
  customer: { externalId: null, email: 'nobody@example.test' },
  ...overrides,
})

beforeEach(resetDatabase)

describe('custom pricing', () => {
  it('charges the rate of the largest pack the amount reaches', () => {
    expect(customPriceCents(5)).toBe(350) // starter rate, $0.70
    expect(customPriceCents(30)).toBe(1920) // popular rate, $0.64
    expect(customPriceCents(60)).toBe(3600) // growth rate, $0.60
    expect(customPriceCents(200)).toBe(11000) // scale rate, $0.55
  })

  it('is never cheaper per pulse than the pack at the same size', () => {
    expect(customPriceCents(100)).toBe(5500)
    expect(customPriceCents(25)).toBe(1600)
  })
})

describe('createCheckout', () => {
  const user = {
    id: crypto.randomUUID(),
    email: 'owner@example.test',
    name: 'Owner',
  }
  const fakeClient = () => {
    const create = vi
      .fn()
      .mockResolvedValue({ url: 'https://polar.test/checkout' })
    return { create, client: { checkouts: { create } } as never }
  }

  it('uses the catalogue product and puts the pulses in metadata for a pack', async () => {
    const { create, client } = fakeClient()
    const result = await createCheckout(
      user,
      { kind: 'pack', packId: 'popular' },
      client,
      'sandbox',
    )

    expect(result.url).toBe('https://polar.test/checkout')
    const args = create.mock.calls[0][0]
    expect(args.products).toEqual(['1d502f05-c411-49f8-8f27-83e7b6e7e515'])
    expect(args.prices).toBeUndefined()
    expect(args.externalCustomerId).toBe(user.id)
    expect(args.metadata).toEqual({ pulses: '25', userId: user.id })
    expect(args.successUrl).toBe('https://pulse.test/dashboard?payment=success')
  })

  it('prices a custom amount on the server with an ad-hoc price', async () => {
    const { create, client } = fakeClient()
    await createCheckout(
      user,
      { kind: 'custom', pulses: 60 },
      client,
      'production',
    )

    const args = create.mock.calls[0][0]
    const product = 'fad8b1dd-d9f5-42a1-b84d-c4a07059e475'
    expect(args.products).toEqual([product])
    expect(args.prices[product]).toEqual([
      { amountType: 'fixed', priceAmount: 3600, priceCurrency: 'usd' },
    ])
    expect(args.metadata.pulses).toBe('60')
  })

  it.each([0, 4, 501, 2.5, -10])(
    'rejects a custom amount of %s pulses',
    async (pulses) => {
      const { create, client } = fakeClient()
      await expect(
        createCheckout(user, { kind: 'custom', pulses }, client, 'sandbox'),
      ).rejects.toBeInstanceOf(CheckoutError)
      expect(create).not.toHaveBeenCalled()
    },
  )
})

describe('creditPaidOrder', () => {
  it('credits the pulses from the checkout metadata to the external customer', async () => {
    const owner = await createBusiness({ pulsesRemaining: 2 })
    const result = await creditPaidOrder(
      order({
        metadata: { pulses: '60' },
        customer: { externalId: owner.id, email: 'other@example.test' },
        totalAmount: 3600,
      }),
    )

    expect(result).toEqual({ status: 'credited', userId: owner.id, pulses: 60 })
    expect(await pulsesOf(owner.id)).toBe(62)
  })

  it('falls back to the catalogue pack when the order has no metadata', async () => {
    const owner = await createBusiness({ pulsesRemaining: 0 })
    await creditPaidOrder(
      order({
        productId: SCALE_PRODUCTION,
        customer: { externalId: owner.id, email: owner.email },
      }),
    )
    expect(await pulsesOf(owner.id)).toBe(100)
  })

  it('matches the buyer by email when there is no external id', async () => {
    const owner = await createBusiness({ pulsesRemaining: 1 })
    await creditPaidOrder(
      order({
        customer: { externalId: null, email: owner.email.toUpperCase() },
      }),
    )
    expect(await pulsesOf(owner.id)).toBe(11)
  })

  it('credits a redelivered order only once', async () => {
    const owner = await createBusiness({ pulsesRemaining: 0 })
    const paid = order({
      customer: { externalId: owner.id, email: owner.email },
    })

    expect((await creditPaidOrder(paid)).status).toBe('credited')
    expect(await creditPaidOrder(paid)).toEqual({ status: 'duplicate' })
    expect(await pulsesOf(owner.id)).toBe(10)
  })

  it('credits once when the same order arrives many times at once', async () => {
    const owner = await createBusiness({ pulsesRemaining: 0 })
    const paid = order({
      customer: { externalId: owner.id, email: owner.email },
    })

    const results = await Promise.all(
      Array.from({ length: 8 }, () => creditPaidOrder(paid)),
    )
    expect(results.filter((r) => r.status === 'credited')).toHaveLength(1)
    expect(await pulsesOf(owner.id)).toBe(10)
  })

  it('reports an order it cannot match and credits nobody', async () => {
    const owner = await createBusiness({ pulsesRemaining: 3 })
    expect((await creditPaidOrder(order())).status).toBe('unmatched')
    expect(
      (
        await creditPaidOrder(
          order({
            productId: 'not-a-pack',
            customer: { externalId: owner.id, email: owner.email },
          }),
        )
      ).status,
    ).toBe('unmatched')
    expect(await pulsesOf(owner.id)).toBe(3)
  })

  it('stores the amount actually paid', async () => {
    const owner = await createBusiness()
    const paid = order({
      totalAmount: 1600,
      metadata: { pulses: '25' },
      customer: { externalId: owner.id, email: owner.email },
    })
    await creditPaidOrder(paid)
    const rows = await db.execute<{ price: number; amount: number }>(
      sql`select price, amount from pulse_purchases where stripe_payment_id = ${paid.id}`,
    )
    expect(rows.rows[0]).toEqual({ price: 1600, amount: 25 })
  })
})

describe('refundOrder', () => {
  const buy = async (pulses: number, price: number, tax = 0) => {
    const owner = await createBusiness({ pulsesRemaining: 0 })
    const paid = order({
      totalAmount: price + tax,
      netAmount: price,
      metadata: { pulses: String(pulses) },
      customer: { externalId: owner.id, email: owner.email },
    })
    await creditPaidOrder(paid)
    return { owner, paid }
  }

  it('removes all the pulses on a full refund', async () => {
    const { owner, paid } = await buy(25, 1600)
    expect(await refundOrder({ ...paid, refundedAmount: 1600 })).toEqual({
      removed: 25,
    })
    expect(await pulsesOf(owner.id)).toBe(0)
  })

  it('removes all the pulses when a taxed order is fully refunded', async () => {
    // Polar reports the refund before tax, in refundedAmount.
    const { owner, paid } = await buy(10, 700, 70)
    expect(await refundOrder({ ...paid, refundedAmount: 700 })).toEqual({
      removed: 10,
    })
    expect(await pulsesOf(owner.id)).toBe(0)
  })

  it('removes a proportional share on a partial refund, then the rest', async () => {
    const { owner, paid } = await buy(50, 3000)
    expect(await refundOrder({ ...paid, refundedAmount: 1500 })).toEqual({
      removed: 25,
    })
    expect(await pulsesOf(owner.id)).toBe(25)
    expect(await refundOrder({ ...paid, refundedAmount: 3000 })).toEqual({
      removed: 25,
    })
    expect(await pulsesOf(owner.id)).toBe(0)
  })

  it('removes nothing when the same refund arrives again', async () => {
    const { owner, paid } = await buy(10, 700)
    await refundOrder({ ...paid, refundedAmount: 700 })
    await refundOrder({ ...paid, refundedAmount: 700 })
    expect(await pulsesOf(owner.id)).toBe(0)
  })

  it('lets the balance go negative when the refunded pulses were already used', async () => {
    const { owner, paid } = await buy(10, 700)
    await db.execute(
      sql`update users set pulses_remaining = 3 where id = ${owner.id}`,
    )
    await refundOrder({ ...paid, refundedAmount: 700 })
    expect(await pulsesOf(owner.id)).toBe(-7)
  })

  it('ignores a refund for an order it never credited', async () => {
    expect(await refundOrder(order({ refundedAmount: 700 }))).toEqual({
      removed: 0,
    })
  })
})
