import { beforeEach, describe, expect, it, vi } from 'vitest'

import { passesTurnstile } from '@/server/turnstile'

const cloudflare = (result: unknown, status = 200) =>
  vi.fn().mockResolvedValue(Response.json(result, { status }))

describe('passesTurnstile', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  it('is off without a secret, so local dev and E2E runs need no keys', async () => {
    const fetcher = cloudflare({ success: false })
    expect(
      await passesTurnstile(undefined, '1.2.3.4', undefined, fetcher),
    ).toBe(true)
    expect(fetcher).not.toHaveBeenCalled()
  })

  it('refuses a request with no token without asking Cloudflare', async () => {
    const fetcher = cloudflare({ success: true })
    expect(await passesTurnstile(undefined, '1.2.3.4', 'secret', fetcher)).toBe(
      false,
    )
    expect(fetcher).not.toHaveBeenCalled()
  })

  it("sends the token, secret and visitor's IP to Cloudflare and trusts its answer", async () => {
    const pass = cloudflare({ success: true })
    expect(await passesTurnstile('token', '1.2.3.4', 'secret', pass)).toBe(true)
    const body = pass.mock.calls[0][1].body as URLSearchParams
    expect(Object.fromEntries(body)).toEqual({
      secret: 'secret',
      response: 'token',
      remoteip: '1.2.3.4',
    })

    expect(
      await passesTurnstile(
        'token',
        '1.2.3.4',
        'secret',
        cloudflare({ success: false }),
      ),
    ).toBe(false)
  })

  it('leaves out the IP when the request has none', async () => {
    const pass = cloudflare({ success: true })
    await passesTurnstile('token', 'unknown', 'secret', pass)
    const body = pass.mock.calls[0][1].body as URLSearchParams
    expect(body.has('remoteip')).toBe(false)
  })

  it('fails closed when Cloudflare errors or is unreachable', async () => {
    expect(
      await passesTurnstile('token', '1.2.3.4', 'secret', cloudflare({}, 500)),
    ).toBe(false)
    const unreachable = vi.fn().mockRejectedValue(new Error('network down'))
    vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(
      await passesTurnstile('token', '1.2.3.4', 'secret', unreachable),
    ).toBe(false)
  })
})
