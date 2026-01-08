/**
 * Generate a 6-digit OTP code
 */
export function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

/**
 * Check if OTP is expired (10 minutes)
 */
export function isOTPExpired(createdAt: Date): boolean {
  const tenMinutes = 10 * 60 * 1000
  return Date.now() - createdAt.getTime() > tenMinutes
}

