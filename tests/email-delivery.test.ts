import { afterEach, describe, expect, it, vi } from 'vitest'

const loadClient = async () => {
  vi.resetModules()
  return (await import('@/lib/utils/resend')).getResendClient()
}

afterEach(() => vi.unstubAllEnvs())

describe('EMAIL_DELIVERY', () => {
  it('logs emails instead of sending them in log mode', async () => {
    vi.stubEnv('EMAIL_DELIVERY', 'log')
    const info = vi.spyOn(console, 'info').mockImplementation(() => undefined)
    const fetchSpy = vi.spyOn(globalThis, 'fetch')

    const result = await (
      await loadClient()
    ).emails.send({
      from: 'Pulse <support@pulseapp.click>',
      to: 'owner@example.test',
      subject: 'Your code is 123456',
      text: 'Your code is 123456',
    })

    expect(result.error).toBeNull()
    expect(fetchSpy).not.toHaveBeenCalled()
    expect(info).toHaveBeenCalledWith(
      '[email:log]',
      expect.objectContaining({ to: 'owner@example.test' }),
    )
  })

  it('refuses log mode on Vercel production, where it would stop logins', async () => {
    vi.stubEnv('EMAIL_DELIVERY', 'log')
    vi.stubEnv('VERCEL_ENV', 'production')
    await expect(loadClient()).rejects.toThrow('not allowed in production')
  })
})
