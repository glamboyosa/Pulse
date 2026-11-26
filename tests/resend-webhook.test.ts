import { afterEach, describe, expect, it, vi } from 'vitest'

const resendMocks = vi.hoisted(() => ({
  verify: vi.fn(),
  receivingGet: vi.fn(),
  send: vi.fn(),
}))

vi.mock('@/lib/utils/resend', () => ({
  getResendClient: () => ({
    webhooks: { verify: resendMocks.verify },
    emails: {
      receiving: { get: resendMocks.receivingGet },
      send: resendMocks.send,
    },
  }),
}))

const loadPost = async () => {
  vi.resetModules()
  return (await import('../app/api/[[...slugs]]/route')).POST
}

const sendWebhook = async (body = '{}') => {
  const POST = await loadPost()
  return POST(
    new Request('https://pulse.test/api/webhook/resend', {
      method: 'POST',
      headers: {
        'svix-id': 'msg_1',
        'svix-timestamp': '1700000000',
        'svix-signature': 'v1,sig',
      },
      body,
    }),
  )
}

afterEach(() => {
  vi.unstubAllEnvs()
  resendMocks.verify.mockReset()
  resendMocks.receivingGet.mockReset()
  resendMocks.send.mockReset()
})

describe('POST /api/webhook/resend', () => {
  it('returns 500 when RESEND_WEBHOOK_SECRET is not configured', async () => {
    vi.stubEnv('RESEND_WEBHOOK_SECRET', '')
    const response = await sendWebhook()
    expect(response.status).toBe(500)
    expect(await response.json()).toEqual({
      error: 'Webhook secret not configured',
    })
    expect(resendMocks.verify).not.toHaveBeenCalled()
    expect(resendMocks.receivingGet).not.toHaveBeenCalled()
  })

  it('acknowledges verified non-email.received events with 200 without fetching or forwarding', async () => {
    vi.stubEnv('RESEND_WEBHOOK_SECRET', 'whsec_test')
    resendMocks.verify.mockReturnValue({
      type: 'email.delivered',
      data: { email_id: 'em_123' },
    })

    const response = await sendWebhook()
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ received: true })
    expect(resendMocks.receivingGet).not.toHaveBeenCalled()
    expect(resendMocks.send).not.toHaveBeenCalled()
  })

  it('returns 400 for malformed email.received payloads missing a valid email_id', async () => {
    vi.stubEnv('RESEND_WEBHOOK_SECRET', 'whsec_test')
    resendMocks.verify.mockReturnValue({
      type: 'email.received',
      data: { from: 'sender@example.test' },
    })

    const response = await sendWebhook()
    expect(response.status).toBe(400)
    expect(resendMocks.receivingGet).not.toHaveBeenCalled()
    expect(resendMocks.send).not.toHaveBeenCalled()
  })

  it('forwards valid email.received events cleanly', async () => {
    vi.stubEnv('RESEND_WEBHOOK_SECRET', 'whsec_test')
    resendMocks.verify.mockReturnValue({
      type: 'email.received',
      created_at: '2026-11-26T00:00:00Z',
      data: {
        email_id: 'em_valid',
        created_at: '2026-11-26T00:00:00Z',
        from: 'customer@example.test',
        to: ['support@pulseapp.click'],
        cc: [],
        subject: 'Question',
      },
    })
    resendMocks.receivingGet.mockResolvedValue({
      data: { html: '<p>Hello</p>', text: 'Hello' },
      error: null,
    })
    resendMocks.send.mockResolvedValue({ data: { id: 'sent_1' }, error: null })

    const response = await sendWebhook()
    expect(response.status).toBe(200)
    expect(resendMocks.receivingGet).toHaveBeenCalledWith('em_valid')
    expect(resendMocks.send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'ogbemudiatimothy@gmail.com',
        replyTo: 'customer@example.test',
        subject: '[Forwarded] Question',
      }),
    )
  })
})
