import { escapeHtml } from '@/lib/utils/html'
import { getResendClient } from '@/lib/utils/resend'

type ReplyEmail = {
  to: string
  ownerEmail: string
  businessName: string
  message: string
  feedbackDate: Date
  idempotencyKey: string
}

/** One line, no control characters: safe in a header such as the subject. */
const headerSafe = (value: string) =>
  // eslint-disable-next-line no-control-regex -- stripping them is the point
  value.replace(/[\u0000-\u001f\u007f]+/g, ' ').trim()

/** An RFC 5322 quoted display name, so commas or @ in a name can't split it. */
const quotedName = (value: string) =>
  `"${headerSafe(value).replace(/["\\]/g, '\\$&')} via Pulse"`

/** The owner's reply to a customer. Replying to it goes to the owner. */
export const sendReplyToCustomer = async ({
  to,
  ownerEmail,
  businessName,
  message,
  feedbackDate,
  idempotencyKey,
}: ReplyEmail) => {
  const day = new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'long',
  }).format(feedbackDate)

  const { error } = await getResendClient().emails.send(
    {
      // The display name is the business; the address stays Pulse's.
      from: `${quotedName(businessName)} <support@pulseapp.click>`,
      to,
      replyTo: ownerEmail,
      subject: `${headerSafe(businessName)} replied to your feedback`,
      html: `<!DOCTYPE html>
<html>
  <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
  <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #111; max-width: 600px; margin: 0 auto; padding: 20px;">
    <p style="margin: 0 0 16px 0;">Thanks for the feedback you left on ${day}. ${escapeHtml(businessName)} replied:</p>
    <div style="border-left: 4px solid #111; padding: 4px 0 4px 16px; margin: 0 0 20px 0; white-space: pre-wrap;">${escapeHtml(message)}</div>
    <p style="margin: 0 0 8px 0;">Reply to this email to answer them directly.</p>
    <p style="font-size: 12px; color: #666; margin-top: 24px;">You asked for a reply when you left feedback with Pulse. ${escapeHtml(businessName)} hasn't seen your address, and won't unless you write back. If you didn't leave feedback there, ignore this email; you won't hear from them again.</p>
  </body>
</html>`,
      text: `Thanks for the feedback you left on ${day}. ${businessName} replied:

${message}

Reply to this email to answer them directly.

You asked for a reply when you left feedback with Pulse. ${businessName} hasn't seen your address, and won't unless you write back. If you didn't leave feedback there, ignore this email; you won't hear from them again.`,
    },
    { idempotencyKey },
  )
  if (error) throw new Error(`Reply email failed: ${error.message}`)
}
