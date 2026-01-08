import { OTPEmail } from '@/emails/otp-email'
import { getResendClient } from '@/lib/utils/resend'

interface SendOTPEmailParams {
  to: string
  otpCode: string
  businessName?: string
}

export async function sendOTPEmail({
  to,
  otpCode,
  businessName,
}: SendOTPEmailParams) {
  const resend = getResendClient()
  const { data, error } = await resend.emails.send({
    from: 'Pulse <auth@pulseapp.click>',
    to,
    subject: `Your Pulse login code: ${otpCode}`,
    react: <OTPEmail otpCode={otpCode} businessName={businessName} />,
  })

  if (error) {
    throw new Error(`Failed to send email: ${error.message}`)
  }

  return data
}
