ALTER TABLE "feedback" ADD COLUMN "language" text;--> statement-breakpoint
ALTER TABLE "feedback" ADD COLUMN "translation" text;--> statement-breakpoint
ALTER TABLE "feedback" ADD COLUMN "summary" text;--> statement-breakpoint
ALTER TABLE "feedback" ADD COLUMN "themes" text[] DEFAULT '{}' NOT NULL;