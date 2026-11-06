import { env } from '@/env'
import { escapeHtml } from '@/lib/utils/html'
import { getResendClient } from '@/lib/utils/resend'

type DigestEmail = {
  to: string
  businessName: string
  content: {
    headline: string
    fixes: Array<{
      title: string
      customers: number
      why: string
      quote: string
    }>
    wins: Array<string>
  }
  idempotencyKey: string
}

export const sendWeeklyDigestEmail = async ({
  to,
  businessName,
  content,
  idempotencyKey,
}: DigestEmail) => {
  const appUrl = env.SERVER_URL || 'https://pulseapp.click'
  const insightsUrl = `${appUrl}/dashboard?tab=insights`

  const fixesHtml = content.fixes
    .map(
      (fix, i) => `
        <div style="border: 3px solid #111; padding: 16px; margin-bottom: 12px; box-shadow: 4px 4px 0 #111;">
          <p style="margin: 0 0 6px 0; font-size: 18px; font-weight: bold;">${i + 1}. ${escapeHtml(fix.title)}</p>
          <p style="margin: 0 0 10px 0; color: #444;">${fix.customers} customer${fix.customers === 1 ? '' : 's'}: ${escapeHtml(fix.why)}</p>
          <p style="margin: 0; padding: 10px 12px; background: #fef3c7; font-style: italic;">“${escapeHtml(fix.quote)}”</p>
        </div>`,
    )
    .join('')
  const winsHtml = content.wins
    .map((win) => `<li style="margin-bottom: 6px;">${escapeHtml(win)}</li>`)
    .join('')

  const { error } = await getResendClient().emails.send(
    {
      from: 'Pulse <support@pulseapp.click>',
      to,
      subject: `Your week at ${businessName}: ${content.headline}`,
      html: `<!DOCTYPE html>
<html>
  <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
  <body style="font-family: Arial, sans-serif; line-height: 1.5; color: #111; max-width: 600px; margin: 0 auto; padding: 20px;">
    <p style="margin: 0 0 4px 0; font-size: 12px; font-weight: bold; letter-spacing: 1px;">PULSE WEEKLY</p>
    <h1 style="margin: 0 0 20px 0; font-size: 24px;">${escapeHtml(content.headline)}</h1>
    ${content.fixes.length > 0 ? `<h2 style="font-size: 16px; margin: 0 0 12px 0;">Fix this week</h2>${fixesHtml}` : ''}
    ${content.wins.length > 0 ? `<h2 style="font-size: 16px; margin: 20px 0 8px 0;">What customers loved</h2><ul style="padding-left: 20px; margin: 0;">${winsHtml}</ul>` : ''}
    <p style="margin: 28px 0;"><a href="${insightsUrl}" style="background: #111; color: #fff; padding: 12px 20px; text-decoration: none; font-weight: bold;">See all insights</a></p>
    <p style="font-size: 12px; color: #666;">Sent to ${escapeHtml(businessName)} every Monday when customers left feedback that week.</p>
  </body>
</html>`,
      text: [
        content.headline,
        '',
        ...content.fixes.map(
          (fix, i) =>
            `${i + 1}. ${fix.title}\n${fix.customers} customer${fix.customers === 1 ? '' : 's'}: ${fix.why}\n"${fix.quote}"\n`,
        ),
        ...(content.wins.length > 0
          ? ['What customers loved:', ...content.wins.map((w) => `- ${w}`)]
          : []),
        '',
        `See all insights: ${insightsUrl}`,
      ].join('\n'),
    },
    { idempotencyKey },
  )

  if (error) throw new Error(`Weekly digest email failed: ${error.message}`)
}
