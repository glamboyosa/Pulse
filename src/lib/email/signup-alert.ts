import { getResendClient } from '@/lib/utils/resend'

/** Tells the founder someone signed up, and which tagged link brought them. */
export const sendSignupAlert = async ({
  to,
  email,
  source,
}: {
  to: string
  email: string
  source: string | null
}) => {
  const { error } = await getResendClient().emails.send({
    from: 'Pulse <support@pulseapp.click>',
    to,
    subject: `New Pulse signup${source ? ` from ${source}` : ''}`,
    text: `${email} just signed up.\nSource: ${source ?? 'untagged (organic or a direct link)'}`,
  })
  if (error) throw new Error(`Failed to send signup alert: ${error.message}`)
}
