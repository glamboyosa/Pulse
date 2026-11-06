import { getResendClient } from '@/lib/utils/resend'
import { env } from '@/env'
import { escapeHtml } from '@/lib/utils/html'

interface SendFeedbackReceivedEmailParams {
  to: string
  businessName: string
  feedbackId: string
  customerName?: string | null
  duration?: number | null
  sentiment?: string | null
  transcript?: string | null
  summary?: string | null
  /** Set when the transcript shown is a translation from this language. */
  language?: string | null
}

const formatDuration = (seconds?: number | null) => {
  if (!seconds || seconds <= 0) return '0:00'
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}:${String(secs).padStart(2, '0')}`
}

const getAppUrl = () =>
  env.SERVER_URL || env.NEXT_PUBLIC_APP_URL || 'https://pulseapp.click'

export async function sendFeedbackReceivedEmail({
  to,
  businessName,
  feedbackId,
  customerName,
  duration,
  sentiment,
  transcript,
  summary,
  language,
}: SendFeedbackReceivedEmailParams) {
  const resend = getResendClient()
  const appUrl = getAppUrl()
  const feedbackUrl = `${appUrl}/feedback/${feedbackId}`
  const displayName = customerName || 'Anonymous'
  const safeTranscript = transcript?.trim() || ''
  const transcriptPreview = safeTranscript
    ? safeTranscript.slice(0, 300)
    : 'Transcript pending...'
  const sentimentText = sentiment ? sentiment.toUpperCase() : 'PENDING'

  // Negative feedback is the one owners must see fast, so it reads as an alert.
  const negative = sentiment === 'negative'
  const from = customerName ? ` from ${customerName}` : ''
  const subject = negative
    ? `Unhappy customer${from}: ${summary ?? 'listen now'}`
    : `New feedback${from}${summary ? `: ${summary}` : ''}`
  const heading = negative
    ? 'An unhappy customer just left feedback'
    : 'New feedback received'
  const transcriptLabel = language
    ? `Translated from ${language}`
    : 'Transcript'

  const { error, data } = await resend.emails.send({
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
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #111; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="margin: 0 0 12px 0;${negative ? ' color: #b91c1c;' : ''}">${heading}</h2>
          <p style="margin: 0 0 16px 0;">Hi ${escapeHtml(businessName)},${negative ? ' reply or fix it while they still remember the visit.' : ' you just received new voice feedback.'}</p>
          ${summary ? `<p style="margin: 0 0 16px 0; font-size: 18px; font-weight: bold;">${escapeHtml(summary)}</p>` : ''}
          <div style="border: 2px solid #111; padding: 16px; margin-bottom: 16px;">
            <p style="margin: 0 0 8px 0;"><strong>From:</strong> ${escapeHtml(displayName)}</p>
            <p style="margin: 0 0 8px 0;"><strong>Duration:</strong> ${formatDuration(duration)}</p>
            <p style="margin: 0 0 8px 0;"><strong>Sentiment:</strong> ${sentimentText}</p>
            <p style="margin: 12px 0 8px 0;"><strong>${escapeHtml(transcriptLabel)}:</strong></p>
            <p style="margin: 0; background: #f5f5f5; padding: 12px;">${escapeHtml(transcriptPreview)}</p>
          </div>
          <div style="text-align: center; margin: 24px 0;">
            <a href="${feedbackUrl}" style="display: inline-block; background-color: ${negative ? '#b91c1c' : '#111'}; color: #fff; padding: 12px 20px; text-decoration: none; border-radius: 6px; font-weight: bold;">
              View Feedback
            </a>
          </div>
          <p style="font-size: 12px; color: #666;">If the transcript is pending, it will appear shortly on the feedback page.</p>
        </body>
      </html>
    `,
    text: `
${heading}
${summary ? `\n${summary}\n` : ''}
From: ${displayName}
Duration: ${formatDuration(duration)}
Sentiment: ${sentimentText}

${transcriptLabel}:
${transcriptPreview}

View feedback: ${feedbackUrl}
    `,
  })

  if (error) {
    console.error('[Feedback Email] Failed to send:', error)
    throw new Error(`Failed to send feedback email: ${error.message}`)
  }

  return data
}
