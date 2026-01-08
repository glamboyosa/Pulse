/**
 * Types for Resend webhook events
 */

export interface ResendEmailAttachment {
  id: string
  filename: string
  content_type: string
  content_disposition: 'inline' | 'attachment'
  content_id: string | null
}

export interface ResendEmailReceivedData {
  email_id: string
  created_at: string
  from: string
  to: string[]
  bcc: string[]
  cc: string[]
  message_id: string
  subject: string
  attachments: ResendEmailAttachment[]
}

export interface ResendEmailReceivedEvent {
  type: 'email.received'
  created_at: string
  data: ResendEmailReceivedData
}

export type ResendWebhookEvent = ResendEmailReceivedEvent
