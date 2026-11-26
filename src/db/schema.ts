import {
  boolean,
  date,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core'

import type { DigestContent } from '@/server/digest'
import type { WidgetContext } from '@/server/widget'

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash'), // Optional - using OTP auth
  businessName: text('business_name'),
  businessType: text('business_type'),
  uniqueCode: text('unique_code').unique(), // Unique code for QR/link (e.g., "acme-cafe")
  isVerified: boolean('is_verified').default(false).notNull(),
  pulsesRemaining: integer('pulses_remaining').default(0).notNull(),
  // Why a new account got no free pulses ('inbox' or 'connection'), so the
  // dashboard can say so and point to support.
  freePulsesWithheld: text('free_pulses_withheld'),
  // Branding on the customer page, all optional. See src/server/branding.ts.
  feedbackQuestion: text('feedback_question'),
  accentColor: text('accent_color'),
  logoKey: text('logo_key'),
  googleReviewUrl: text('google_review_url'),
  thankYouMessage: text('thank_you_message'),
  // The website widget, off until the owner creates a key. The key is public;
  // only pages on the listed origins may use it. See src/server/widget.ts.
  widgetKey: text('widget_key').unique(),
  widgetOrigins: text('widget_origins').array().default([]).notNull(),
  // A reward for leaving feedback, whatever it says. See src/server/vouchers.ts.
  voucherEnabled: boolean('voucher_enabled').default(false).notNull(),
  voucherOffer: text('voucher_offer'),
  voucherExpiryDays: integer('voucher_expiry_days').default(30).notNull(),
  voucherMonthlyCap: integer('voucher_monthly_cap').default(50).notNull(),
  // The tagged link the owner first arrived from. See src/lib/signup-source.ts.
  signupSource: text('signup_source'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

// A place a QR code points to: a branch, a table, an event. Owners archive
// rather than delete, so old feedback keeps its label.
export const spots = pgTable(
  'spots',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .references(() => users.id)
      .notNull(),
    name: text('name').notNull(),
    // In the QR link: /f/<business code>?spot=<slug>
    slug: text('slug').notNull(),
    archivedAt: timestamp('archived_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [unique().on(table.userId, table.slug)],
)

export const feedback = pgTable('feedback', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .references(() => users.id)
    .notNull(),
  spotId: uuid('spot_id').references(() => spots.id),
  // 'voice' for recordings; 'text' when the customer couldn't record and typed.
  source: text('source').default('voice').notNull(),
  // Where it was left: 'qr' (the feedback page) or 'widget' (a website).
  channel: text('channel').default('qr').notNull(),
  // For the widget: the page, browser and user it came from. Untrusted: it
  // was sent by the host website. See WidgetContext in src/server/widget.ts.
  context: jsonb('context').$type<WidgetContext>(),
  // Close the loop: an address the customer chose to leave for one reply.
  // Never shown to the owner; Pulse sends the reply.
  contactEmail: text('contact_email'),
  replyText: text('reply_text'),
  repliedAt: timestamp('replied_at'),
  customerName: text('customer_name'),
  audioUrl: text('audio_url'), // Presigned URL to stored audio file (expires)
  audioKey: text('audio_key'), // R2 key for the audio file (permanent, can regenerate URLs)
  transcript: text('transcript'),
  sentiment: text('sentiment'), // 'positive', 'neutral', 'negative'
  language: text('language'), // as spoken, in English: 'French', 'Nigerian Pidgin'
  translation: text('translation'), // English translation; null when spoken in English
  summary: text('summary'),
  themes: text('themes').array().default([]).notNull(),
  duration: integer('duration'), // Duration in seconds
  // 'processing' until transcription and analysis finish, then 'ready' or 'failed'
  status: text('status').default('ready').notNull(),
  // Page-view retries are capped and can take over a run stuck in
  // 'processing', e.g. one killed by a redeploy.
  analysisAttempts: integer('analysis_attempts').default(0).notNull(),
  analysisStartedAt: timestamp('analysis_started_at').defaultNow().notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

// One voucher per feedback. The offer is copied, so later edits to the
// owner's offer don't change vouchers already issued.
export const vouchers = pgTable(
  'vouchers',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .references(() => users.id)
      .notNull(),
    feedbackId: uuid('feedback_id')
      .references(() => feedback.id, { onDelete: 'set null' })
      .unique(),
    code: text('code').notNull(),
    offer: text('offer').notNull(),
    // HMAC of the customer's IP, to limit vouchers per connection.
    ipHash: text('ip_hash'),
    expiresAt: timestamp('expires_at').notNull(),
    redeemedAt: timestamp('redeemed_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [unique().on(table.userId, table.code)],
)

export const pulsePurchases = pgTable('pulse_purchases', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .references(() => users.id)
    .notNull(),
  amount: integer('amount').notNull(),
  price: integer('price').notNull(), // Price in cents
  // Polar order id. Unique so a redelivered webhook can't credit the same order twice.
  stripePaymentId: text('stripe_payment_id').unique(),
  refundedPulses: integer('refunded_pulses').default(0).notNull(),
  status: text('status').default('completed').notNull(), // 'completed', 'partially_refunded', 'refunded'
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const otpCodes = pgTable('otp_codes', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull(),
  code: text('code').notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  used: boolean('used').default(false).notNull(),
  attempts: integer('attempts').default(0).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

// Rate limiting table (simple fixed-window counters)
export const rateLimits = pgTable('rate_limits', {
  key: text('key').primaryKey(),
  count: integer('count').default(0).notNull(),
  resetAt: timestamp('reset_at').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

// Inboxes that have had free pulses, as keyed fingerprints. Kept when an
// account is deleted, so deleting and signing up again doesn't refill them.
export const freePulseGrants = pgTable('free_pulse_grants', {
  mailboxHash: text('mailbox_hash').primaryKey(),
  grantedAt: timestamp('granted_at').defaultNow().notNull(),
})

// One AI digest per owner per week (weeks start Monday, UTC). An owner can
// rewrite the current week's from the Insights tab; the Monday cron claims the
// week that just ended by setting sendingAt, so nobody is emailed twice.
export const weeklyDigests = pgTable(
  'weekly_digests',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .references(() => users.id)
      .notNull(),
    weekStart: date('week_start').notNull(),
    content: jsonb('content').$type<DigestContent>(),
    sendingAt: timestamp('sending_at'),
    emailedAt: timestamp('emailed_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [unique().on(table.userId, table.weekStart)],
)

export type User = typeof users.$inferSelect
export type NewUser = typeof users.$inferInsert
export type Feedback = typeof feedback.$inferSelect
export type NewFeedback = typeof feedback.$inferInsert
export type PulsePurchase = typeof pulsePurchases.$inferSelect
export type NewPulsePurchase = typeof pulsePurchases.$inferInsert
export type OtpCode = typeof otpCodes.$inferSelect
export type NewOtpCode = typeof otpCodes.$inferInsert
export type RateLimit = typeof rateLimits.$inferSelect
export type NewRateLimit = typeof rateLimits.$inferInsert
