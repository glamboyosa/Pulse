import { Polar } from '@polar-sh/sdk'
import { sql } from 'drizzle-orm'

import type { PackId } from '@/lib/pricing'
import { db } from '@/db/index'
import { env } from '@/env'
import {
  CUSTOM_PULSES_MAX,
  CUSTOM_PULSES_MIN,
  PACKS,
  customPriceCents,
} from '@/lib/pricing'

export type PolarEnvironment = 'sandbox' | 'production'

export const polarEnvironment = (): PolarEnvironment =>
  env.POLAR_ENVIRONMENT === 'sandbox' ? 'sandbox' : 'production'

const polarToken = (environment: PolarEnvironment) =>
  environment === 'sandbox' ? env.POLAR_SANDBOX_API_TOKEN : env.POLAR_API_KEY

export const polarWebhookSecret = (environment: PolarEnvironment) =>
  environment === 'sandbox'
    ? env.POLAR_SANDBOX_WEBHOOK_SECRET
    : env.POLAR_WEBHOOK_SECRET

// The Polar catalogue products behind each pack, per Polar environment.
const PACK_PRODUCTS: Record<PolarEnvironment, Record<PackId, string>> = {
  sandbox: {
    starter: '9d2ffe60-4204-4ed0-abc2-9707e66d713f',
    popular: '1d502f05-c411-49f8-8f27-83e7b6e7e515',
    growth: 'd04c9f17-af15-4ee1-86bb-da89b340b562',
    scale: 'cfa4b754-6a75-4c39-a703-93cf92597d02',
  },
  production: {
    starter: 'f4f82b5c-2c39-4b8d-a8bf-53de00594e21',
    popular: '80ed7c99-0512-48af-88d5-83dc29cfec50',
    growth: 'fad8b1dd-d9f5-42a1-b84d-c4a07059e475',
    scale: '1a60a8a1-a88e-4aa9-8cd1-43bf88cd15f5',
  },
}

// A neutral "Pulse credits" product for custom amounts, so the checkout and
// receipt don't show a pack's name. Sandbox has none and uses its starter pack.
const CUSTOM_PRODUCT: Record<PolarEnvironment, string> = {
  sandbox: PACK_PRODUCTS.sandbox.starter,
  production: '87b9fe15-5339-4b5c-a3d3-6fe6cca3cdfe',
}

export type CheckoutRequest =
  | { kind: 'pack'; packId: PackId }
  | { kind: 'custom'; pulses: number }

export class CheckoutError extends Error {}

export type CheckoutUser = { id: string; email: string; name: string }

type CheckoutClient = Pick<Polar, 'checkouts'>

const defaultClient = (environment: PolarEnvironment): CheckoutClient => {
  const accessToken = polarToken(environment)
  if (!accessToken) {
    throw new CheckoutError(`Polar ${environment} access token is not set`)
  }
  return new Polar({ accessToken, server: environment })
}

/**
 * Creates a Polar checkout for the signed-in user. The amount and price come
 * from the server: the browser only names a pack or a pulse count. The pulse
 * count travels in the checkout metadata, which Polar copies onto the order.
 */
export const createCheckout = async (
  user: CheckoutUser,
  request: CheckoutRequest,
  client: CheckoutClient = defaultClient(polarEnvironment()),
  environment: PolarEnvironment = polarEnvironment(),
): Promise<{ url: string }> => {
  const products = PACK_PRODUCTS[environment]
  const appUrl = env.SERVER_URL || 'http://localhost:3000'

  let productId: string
  let pulses: number
  let prices: Parameters<CheckoutClient['checkouts']['create']>[0]['prices']

  if (request.kind === 'pack') {
    const pack = PACKS.find((p) => p.id === request.packId)
    if (!pack) throw new CheckoutError('Unknown pack')
    productId = products[pack.id]
    pulses = pack.pulses
  } else {
    if (
      !Number.isInteger(request.pulses) ||
      request.pulses < CUSTOM_PULSES_MIN ||
      request.pulses > CUSTOM_PULSES_MAX
    ) {
      throw new CheckoutError(
        `Choose between ${CUSTOM_PULSES_MIN} and ${CUSTOM_PULSES_MAX} pulses`,
      )
    }
    productId = CUSTOM_PRODUCT[environment]
    pulses = request.pulses
    // An ad-hoc price for this checkout only, so no catalogue product is created.
    prices = {
      [productId]: [
        {
          amountType: 'fixed',
          priceAmount: customPriceCents(pulses),
          priceCurrency: 'usd',
        },
      ],
    }
  }

  const checkout = await client.checkouts.create({
    products: [productId],
    prices,
    externalCustomerId: user.id,
    customerEmail: user.email,
    customerName: user.name,
    metadata: { pulses: String(pulses), userId: user.id },
    successUrl: `${appUrl}/dashboard?payment=success`,
    returnUrl: `${appUrl}/buy-pulses`,
  })

  return { url: checkout.url }
}

/** What the webhook needs from a Polar order. */
export type PaidOrder = {
  id: string
  productId: string | null
  totalAmount: number
  // Before tax. Polar reports refunds before tax too, in refundedAmount.
  netAmount: number
  refundedAmount: number
  metadata: Record<string, string | number | boolean>
  customer: { externalId: string | null; email: string }
}

const pulsesForOrder = (order: PaidOrder): number => {
  const fromMetadata = Number(order.metadata.pulses)
  if (Number.isInteger(fromMetadata) && fromMetadata > 0) return fromMetadata

  // Orders from a Polar checkout link carry no metadata: use the catalogue.
  for (const environment of ['production', 'sandbox'] as const) {
    for (const pack of PACKS) {
      if (PACK_PRODUCTS[environment][pack.id] === order.productId) {
        return pack.pulses
      }
    }
  }
  return 0
}

export type CreditResult =
  | { status: 'credited'; userId: string; pulses: number }
  | { status: 'duplicate' }
  | { status: 'unmatched'; reason: string }

/**
 * Credits a paid order exactly once. The purchase insert and the balance update
 * run in one statement: a redelivered or concurrent webhook for the same order
 * hits the unique order id, inserts nothing, and so adds nothing.
 */
export const creditPaidOrder = async (
  order: PaidOrder,
): Promise<CreditResult> => {
  const pulses = pulsesForOrder(order)
  if (pulses === 0) {
    return { status: 'unmatched', reason: 'no pulse amount on order' }
  }

  const externalId =
    order.customer.externalId ?? (order.metadata.userId as string | undefined)

  const result = await db.execute<{ user_id: string }>(sql`
    with buyer as (
      select id from users
      where ${externalId ? sql`id = ${externalId}::uuid` : sql`false`}
         or lower(email) = lower(${order.customer.email})
      order by (id::text = ${externalId ?? ''}) desc
      limit 1
    ),
    purchase as (
      insert into pulse_purchases (user_id, amount, price, stripe_payment_id, status)
      select id, ${pulses}, ${order.totalAmount}, ${order.id}, 'completed' from buyer
      on conflict (stripe_payment_id) do nothing
      returning user_id, amount
    )
    update users set
      pulses_remaining = users.pulses_remaining + purchase.amount,
      updated_at = now()
    from purchase
    where users.id = purchase.user_id
    returning users.id as user_id
  `)

  if (result.rows.length === 1) {
    return { status: 'credited', userId: result.rows[0].user_id, pulses }
  }

  const existing = await db.execute(
    sql`select 1 from pulse_purchases where stripe_payment_id = ${order.id}`,
  )
  return existing.rows.length > 0
    ? { status: 'duplicate' }
    : { status: 'unmatched', reason: 'no user for order customer' }
}

/**
 * Removes the pulses a refund covers. A partial refund removes a proportional
 * share, rounded down. The purchase row records how many pulses have been
 * refunded so far, so a repeated event removes nothing extra. The balance can
 * go below zero if the pulses were already used; new feedback is then refused
 * until the business tops up.
 */
export const refundOrder = async (
  order: PaidOrder,
): Promise<{ removed: number }> => {
  const result = await db.execute<{ removed: number }>(sql`
    with target as (
      select id, user_id, refunded_pulses,
        least(amount, floor(amount * ${order.refundedAmount}::numeric / nullif(${order.netAmount}, 0)))::int as refund_total
      from pulse_purchases
      where stripe_payment_id = ${order.id}
      for update
    ),
    changed as (
      update pulse_purchases p set
        refunded_pulses = target.refund_total,
        status = case when target.refund_total >= p.amount then 'refunded' else 'partially_refunded' end
      from target
      where p.id = target.id and target.refund_total > target.refunded_pulses
      returning p.user_id, target.refund_total - target.refunded_pulses as removed
    )
    update users set
      pulses_remaining = users.pulses_remaining - changed.removed,
      updated_at = now()
    from changed
    where users.id = changed.user_id
    returning changed.removed as removed
  `)

  return { removed: result.rows[0]?.removed ?? 0 }
}
