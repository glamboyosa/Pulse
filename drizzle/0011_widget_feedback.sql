ALTER TABLE "feedback" ADD COLUMN "channel" text DEFAULT 'qr' NOT NULL;--> statement-breakpoint
ALTER TABLE "feedback" ADD COLUMN "context" jsonb;