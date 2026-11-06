import { beforeEach, describe, expect, it, vi } from 'vitest'

import { sendFeedbackReceivedEmail } from '@/lib/email/feedback-received'
import { sendWeeklyDigestEmail } from '@/lib/email/weekly-digest'

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
