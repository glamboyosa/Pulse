import { Resend } from 'resend'
import { env } from '@/env'

let resendClient: Resend | null = null

/**
 * Get Resend client instance (lazy initialization)
 * Throws error if API key is not configured
 */
export function getResendClient(): Resend {
  if (!env.SERVER_RESEND_API_KEY) {
    throw new Error(
      'SERVER_RESEND_API_KEY is not configured. Please set it in your environment variables.',
    )
  }

  if (!resendClient) {
    resendClient = new Resend(env.SERVER_RESEND_API_KEY)
  }

  return resendClient
}

