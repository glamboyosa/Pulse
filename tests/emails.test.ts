import { beforeEach, describe, expect, it, vi } from 'vitest'

import { sendFeedbackReceivedEmail } from '@/lib/email/feedback-received'
import { sendWeeklyDigestEmail } from '@/lib/email/weekly-digest'
import { sendReplyToCustomer } from '@/lib/email/reply-to-customer'

const send = vi.hoisted(() => vi.fn())
vi.mock('@/lib/utils/resend', () => ({
  getResendClient: () => ({ emails: { send } }),
}))

type Sent = { subject: string; html: string; text: string }
const sent = (): Sent => send.mock.calls[0][0] as Sent

beforeEach(() => {
  send.mockReset()
  send.mockResolvedValue({ data: { id: 'email-1' }, error: null })
})

describe('feedback email', () => {
  it('turns negative feedback into an alert with the translation', async () => {
    await sendFeedbackReceivedEmail({
      to: 'owner@example.test',
      businessName: 'Test Cafe 130',
      feedbackId: 'f-1',
      sentiment: 'negative',
      summary: '<b>Service</b> was slow',
      transcript: 'The service was <script>x</script> slow.',
      language: 'French',
    })

    const email = sent()
    expect(email.subject).toBe('Unhappy customer: <b>Service</b> was slow')
    expect(email.html).toContain('An unhappy customer just left feedback')
    expect(email.html).toContain('Translated from French')
    expect(email.html).toContain('&lt;b&gt;Service&lt;/b&gt; was slow')
    expect(email.html).not.toContain('<b>Service</b>')
    expect(email.html).not.toContain('<script>')
  })

  it('keeps positive feedback calm and labels an English transcript plainly', async () => {
    await sendFeedbackReceivedEmail({
      to: 'owner@example.test',
      businessName: 'Test Cafe 130',
      feedbackId: 'f-2',
      customerName: 'Ada',
      sentiment: 'positive',
      summary: 'Loved the coffee.',
      transcript: 'Great coffee.',
      language: null,
    })

    const email = sent()
    expect(email.subject).toBe('New feedback from Ada: Loved the coffee.')
    expect(email.html).toContain('New feedback received')
    expect(email.html).toContain('Transcript:')
    expect(email.html).not.toContain('Translated from')
  })
})

describe('typed feedback email', () => {
  it('says the feedback was typed instead of showing a duration', async () => {
    await sendFeedbackReceivedEmail({
      to: 'owner@example.test',
      businessName: 'Test Cafe 130',
      feedbackId: 'f-3',
      sentiment: 'neutral',
      transcript: 'Music too loud.',
      duration: null,
      typed: true,
    })
    const email = sent()
    expect(email.text).toContain('Typed rather than recorded')
    expect(email.text).not.toContain('Duration')
  })
})

describe('weekly digest email', () => {
  it('escapes everything the model and the owner wrote, and sends once per key', async () => {
    await sendWeeklyDigestEmail({
      to: 'owner@example.test',
      businessName: 'Test Cafe <130>',
      idempotencyKey: 'weekly-digest/u1/2026-11-02',
      content: {
        headline: '<img src=x onerror=alert(1)> week',
        fixes: [
          {
            title: '<b>Faster</b> food',
            customers: 2,
            why: 'Waits & delays',
            quote: '"we waited" <script>',
          },
        ],
        wins: ['<i>Great</i> suya'],
      },
    })

    const email = sent()
    expect(email.html).not.toMatch(/<img|<b>|<script>|<i>|Cafe <130>/)
    expect(email.html).toContain('&lt;img src=x onerror=alert(1)&gt; week')
    expect(email.html).toContain('2 customers: Waits &amp; delays')
    expect(send.mock.calls[0][1]).toEqual({
      idempotencyKey: 'weekly-digest/u1/2026-11-02',
    })
  })
})

describe('reply to a customer', () => {
  it('keeps a name with a comma or line break in one quoted sender', async () => {
    await sendReplyToCustomer({
      to: 'ada@example.test',
      ownerEmail: 'owner@example.test',
      businessName: 'Smith, Jones\nCafe',
      message: 'Thanks',
      feedbackDate: new Date('2026-11-06T12:00:00Z'),
      idempotencyKey: 'reply/f-2',
    })
    const [payload] = send.mock.calls[0] as [{ from: string; subject: string }]
    expect(payload.from).toBe(
      '"Smith, Jones Cafe via Pulse" <support@pulseapp.click>',
    )
    expect(payload.subject).toBe('Smith, Jones Cafe replied to your feedback')
  })

  it('comes from the business name, replies go to the owner, and text is escaped', async () => {
    await sendReplyToCustomer({
      to: 'ada@example.test',
      ownerEmail: 'owner@example.test',
      businessName: 'Test Cafe "<130>"',
      message: 'Sorry! <b>We</b> fixed it.',
      feedbackDate: new Date('2026-11-06T12:00:00Z'),
      idempotencyKey: 'reply/f-1',
    })
    const [payload, options] = send.mock.calls[0] as [
      { from: string; replyTo: string; html: string; text: string },
      { idempotencyKey: string },
    ]
    expect(payload.from).toBe(
      '"Test Cafe \\"<130>\\" via Pulse" <support@pulseapp.click>',
    )
    expect(payload.replyTo).toBe('owner@example.test')
    expect(payload.html).toContain('Sorry! &lt;b&gt;We&lt;/b&gt; fixed it.')
    expect(payload.html).not.toContain('<b>We</b>')
    expect(payload.html).toContain("won't unless you write back")
    expect(options).toEqual({ idempotencyKey: 'reply/f-1' })
  })
})
