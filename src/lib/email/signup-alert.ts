import type { NoFreePulsesReason } from '@/server/free-pulses'
import { getResendClient } from '@/lib/utils/resend'
import { FREE_SIGNUPS_PER_CONNECTION } from '@/server/free-pulses'

const NO_FREE_PULSES: Record<NoFreePulsesReason, string> = {
  inbox:
    'No free pulses: this inbox already had them, on this or an earlier account.',
  connection: `No free pulses: this connection already got them for ${FREE_SIGNUPS_PER_CONNECTION} new accounts in the last 30 days.`,
}

/**
 * Tells the founder someone signed up, which tagged link brought them, and
 * when they got no free pulses because they look like a repeat signup.
 */
export const sendSignupAlert = async ({
  to,
  email,
  source,
  noFreePulses,
}: {
  to: string
  email: string
  source: string | null
  /** Set when the account got no free pulses, and why. */
  noFreePulses: NoFreePulsesReason | null
}) => {
  const { error } = await getResendClient().emails.send({
    from: 'Pulse <support@pulseapp.click>',
    to,
    subject: `New Pulse signup${source ? ` from ${source}` : ''}`,
    text: `${email} just signed up.\nSource: ${source ?? 'untagged (organic or a direct link)'}${noFreePulses ? `\n${NO_FREE_PULSES[noFreePulses]}` : ''}`,
  })
  if (error) throw new Error(`Failed to send signup alert: ${error.message}`)
}
