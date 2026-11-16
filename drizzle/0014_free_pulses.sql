CREATE TABLE "free_pulse_grants" (
	"mailbox_hash" text PRIMARY KEY NOT NULL,
	"granted_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "free_pulses_withheld" text;