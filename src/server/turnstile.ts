import { env } from '@/env'

const VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify'

/**
 * Asks Cloudflare whether a Turnstile token came from a person. Without a
 * secret (local dev, E2E runs) the check is off. Any failure, including
 * Cloudflare being unreachable, counts as not passed.
 */
export const passesTurnstile = async (
  token: string | undefined,
  ip: string,
  secret: string | undefined = env.TURNSTILE_SECRET_KEY,
  fetcher: typeof fetch = fetch,
): Promise<boolean> => {
  if (!secret) return true
  if (!token) return false
  try {
    const response = await fetcher(VERIFY_URL, {
      method: 'POST',
      body: new URLSearchParams({
        secret,
        response: token,
        ...(ip === 'unknown' ? {} : { remoteip: ip }),
      }),
      signal: AbortSignal.timeout(5000),
    })
    if (!response.ok) return false
    const result = (await response.json()) as { success?: unknown }
    return result.success === true
  } catch (error) {
    console.error('[turnstile] verification request failed', error)
    return false
  }
}
