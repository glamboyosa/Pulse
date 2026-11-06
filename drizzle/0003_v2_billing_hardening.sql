ALTER TABLE "feedback" ADD COLUMN "status" text DEFAULT 'ready' NOT NULL;--> statement-breakpoint
ALTER TABLE "feedback" ADD COLUMN "analysis_attempts" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "feedback" ADD COLUMN "analysis_started_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "otp_codes" ADD COLUMN "attempts" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "pulse_purchases" ADD COLUMN "refunded_pulses" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "pulse_purchases" ADD CONSTRAINT "pulse_purchases_stripe_payment_id_unique" UNIQUE("stripe_payment_id");