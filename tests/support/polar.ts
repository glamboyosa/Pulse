import { Webhook } from 'standardwebhooks'

type OrderOptions = {
  id?: string
  productId?: string | null
  externalId?: string | null
  email?: string
  totalAmount?: number
  taxAmount?: number
  refundedAmount?: number
  metadata?: Record<string, string>
}

const now = '2026-11-06T12:00:00Z'

/** A Polar order as it arrives on the wire (snake_case), for webhook tests. */
export const orderPayload = ({
  id = crypto.randomUUID(),
  productId = '9d2ffe60-4204-4ed0-abc2-9707e66d713f',
  externalId = null,
  email = 'owner@example.test',
  totalAmount = 700,
  taxAmount = 0,
  refundedAmount = 0,
  metadata = {},
}: OrderOptions = {}) => {
  const customerId = crypto.randomUUID()
  return {
    id,
    created_at: now,
    modified_at: now,
    status: refundedAmount > 0 ? 'refunded' : 'paid',
    paid: true,
    subtotal_amount: totalAmount - taxAmount,
    discount_amount: 0,
    net_amount: totalAmount - taxAmount,
    tax_amount: taxAmount,
    total_amount: totalAmount,
    applied_balance_amount: 0,
    due_amount: 0,
    refunded_amount: refundedAmount,
    refunded_tax_amount: 0,
    currency: 'usd',
    billing_reason: 'purchase',
    billing_name: null,
    billing_address: null,
    invoice_number: 'PULSE-0001',
    is_invoice_generated: false,
    customer_id: customerId,
    product_id: productId,
    discount_id: null,
    subscription_id: null,
    checkout_id: crypto.randomUUID(),
    metadata,
    custom_field_data: {},
    platform_fee_amount: 0,
    customer: {
      id: customerId,
      created_at: now,
      modified_at: now,
      metadata: {},
      external_id: externalId,
      email,
      email_verified: true,
      name: 'Test Owner',
      billing_address: null,
      tax_id: null,
      organization_id: crypto.randomUUID(),
      deleted_at: null,
      avatar_url: 'https://example.test/avatar.png',
    },
    user_id: crypto.randomUUID(),
    product: productId
      ? {
          id: productId,
          created_at: now,
          modified_at: now,
          trial_interval: null,
          trial_interval_count: null,
          name: 'Starter Pack - 10 Pulses',
          description: null,
          recurring_interval: null,
          recurring_interval_count: null,
          is_recurring: false,
          is_archived: false,
          organization_id: crypto.randomUUID(),
          metadata: {},
        }
      : null,
    discount: null,
    subscription: null,
    items: [
      {
        created_at: now,
        modified_at: now,
        id: crypto.randomUUID(),
        label: 'Starter Pack - 10 Pulses',
        amount: totalAmount,
        tax_amount: 0,
        proration: false,
        product_price_id: crypto.randomUUID(),
      },
    ],
    description: 'Starter Pack - 10 Pulses',
  }
}

/** Signs a webhook body the way Polar does, for a given webhook secret. */
export const signedWebhook = (
  type: string,
  data: unknown,
  secret: string,
): { body: string; headers: Record<string, string> } => {
  const body = JSON.stringify({ type, timestamp: now, data })
  const msgId = `msg_${crypto.randomUUID()}`
  const timestamp = new Date()
  const webhook = new Webhook(Buffer.from(secret, 'utf-8').toString('base64'))
  return {
    body,
    headers: {
      'content-type': 'application/json',
      'webhook-id': msgId,
      'webhook-timestamp': String(Math.floor(timestamp.getTime() / 1000)),
      'webhook-signature': webhook.sign(msgId, timestamp, body),
    },
  }
}
