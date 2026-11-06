import {
  boolean,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core'

// Users table - extends authentication with business info
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash'), // Optional - using OTP auth
  businessName: text('business_name'),
  businessType: text('business_type'),
  uniqueCode: text('unique_code').unique(), // Unique code for QR/link (e.g., "acme-cafe")
  isVerified: boolean('is_verified').default(false).notNull(),
  pulsesRemaining: integer('pulses_remaining').default(0).notNull(), // Credit system
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

// Feedback submissions from customers
export const feedback = pgTable('feedback', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .references(() => users.id)
    .notNull(),
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

// Pulse purchases for tracking credit purchases
export const pulsePurchases = pgTable('pulse_purchases', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .references(() => users.id)
    .notNull(),
  amount: integer('amount').notNull(), // Number of pulses purchased
  price: integer('price').notNull(), // Price in cents
  // Polar order id. Unique so a redelivered webhook can't credit the same order twice.
  stripePaymentId: text('stripe_payment_id').unique(),
  refundedPulses: integer('refunded_pulses').default(0).notNull(),
  status: text('status').default('completed').notNull(), // 'pending', 'completed', 'failed'
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

// OTP codes for email authentication
export const otpCodes = pgTable('otp_codes', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull(),
  code: text('code').notNull(), // 6-digit code
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

// Types for TypeScript
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
