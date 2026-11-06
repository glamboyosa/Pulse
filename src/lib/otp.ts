import { randomInt } from 'node:crypto'

export const OTP_TTL_MS = 10 * 60 * 1000
export const OTP_MAX_ATTEMPTS = 5

/** A 6-digit one-time code from a cryptographic random source. */
export function generateOTP(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, '0')
}
