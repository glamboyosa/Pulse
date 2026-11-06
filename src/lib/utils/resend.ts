import { Resend } from 'resend'

import { env } from '@/env'

let resendClient: Resend | null = null

/**
 * The shared Resend client. With EMAIL_DELIVERY=log (local dev and the E2E
 * runs) emails are printed instead of sent, so tests don't spend the daily
 * Resend quota.
 */
export function getResendClient(): Resend {
  if (resendClient) return resendClient

  if (env.EMAIL_DELIVERY === 'log') {
    // Log mode in production would silently stop every login email.
    if (
      env.VERCEL_ENV === 'production' ||
      (process.env.NODE_ENV === 'production' && !env.VERCEL_ENV)
    ) {
      throw new Error('EMAIL_DELIVERY=log is not allowed in production')
    }
    resendClient = new Resend(env.SERVER_RESEND_API_KEY ?? 're_log_only')
    resendClient.emails.send = (payload) => {
      // Never runs in production, so printing the email (login codes are in
      // the subject) is fine.
      console.info('[email:log]', {
        to: payload.to,
        subject: payload.subject,
        text: payload.text,
      })
      return Promise.resolve({
        data: { id: `logged-${crypto.randomUUID()}` },
        error: null,
        headers: null,
      })
    }
    return resendClient
  }

  if (!env.SERVER_RESEND_API_KEY) {
    throw new Error(
      'SERVER_RESEND_API_KEY is not configured. Please set it in your environment variables.',
    )
  }
  resendClient = new Resend(env.SERVER_RESEND_API_KEY)
  return resendClient
}
