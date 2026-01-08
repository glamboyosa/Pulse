import { getResendClient } from '@/lib/utils/resend'

interface SendLowPulseEmailParams {
  to: string
  userName: string
  pulsesRemaining: number
}

/**
 * Send low pulse notification email
 * Thresholds:
 * - < 5 pulses: Critical (send immediately)
 * - < 10 pulses: Warning (can use after() for async)
 */
export async function sendLowPulseEmail({
  to,
  userName,
  pulsesRemaining,
}: SendLowPulseEmailParams) {
  const resend = getResendClient()

  const isCritical = pulsesRemaining < 5
  const subject = isCritical
    ? `⚠️ Critical: Only ${pulsesRemaining} pulse${pulsesRemaining === 1 ? '' : 's'} remaining`
    : `Low Pulse Alert: ${pulsesRemaining} pulse${pulsesRemaining === 1 ? '' : 's'} remaining`

  const urgencyColor = isCritical ? '#dc2626' : '#f59e0b'
  const urgencyText = isCritical
    ? 'CRITICAL - Running Low!'
    : 'Running Low'

  const { data, error } = await resend.emails.send({
    from: 'Pulse <support@pulseapp.click>',
    to,
    subject,
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background-color: ${urgencyColor}; color: white; padding: 20px; border-radius: 8px; margin-bottom: 20px; text-align: center;">
            <h1 style="margin: 0; font-size: 24px;">⚡ ${urgencyText}</h1>
          </div>
          
          <div style="background-color: #f9f9f9; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
            <p style="font-size: 18px; font-weight: bold; margin: 0 0 10px 0;">Hi ${userName},</p>
            <p style="margin: 0 0 15px 0;">
              You currently have <strong style="color: ${urgencyColor}; font-size: 20px;">${pulsesRemaining}</strong> pulse${pulsesRemaining === 1 ? '' : 's'} remaining in your Pulse account.
            </p>
            ${isCritical ? (
              `<p style="margin: 15px 0; padding: 15px; background-color: #fee2e2; border-left: 4px solid ${urgencyColor}; border-radius: 4px;">
                <strong>⚠️ Action Required:</strong> You're running very low on pulses. Purchase more now to ensure uninterrupted feedback collection.
              </p>`
            ) : (
              `<p style="margin: 15px 0; padding: 15px; background-color: #fef3c7; border-left: 4px solid ${urgencyColor}; border-radius: 4px;">
                Consider purchasing more pulses soon to avoid interruption.
              </p>`
            )}
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${process.env.NEXT_PUBLIC_APP_URL || 'https://pulseapp.click'}/buy-pulses" 
               style="display: inline-block; background-color: #000; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px;">
              Buy More Pulses →
            </a>
          </div>
          
          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 12px; color: #666;">
            <p style="margin: 5px 0;">This is an automated notification from Pulse.</p>
            <p style="margin: 5px 0;">If you have any questions, contact us at support@pulseapp.click</p>
          </div>
        </body>
      </html>
    `,
    text: `
Hi ${userName},

You currently have ${pulsesRemaining} pulse${pulsesRemaining === 1 ? '' : 's'} remaining in your Pulse account.

${isCritical ? '⚠️ CRITICAL: You\'re running very low on pulses. Purchase more now to ensure uninterrupted feedback collection.' : 'Consider purchasing more pulses soon to avoid interruption.'}

Buy more pulses: ${process.env.NEXT_PUBLIC_APP_URL || 'https://pulseapp.click'}/buy-pulses

---
This is an automated notification from Pulse.
If you have any questions, contact us at support@pulseapp.click
    `,
  })

  if (error) {
    console.error('[Low Pulse Email] Failed to send:', error)
    throw new Error(`Failed to send low pulse email: ${error.message}`)
  }

  return data
}


