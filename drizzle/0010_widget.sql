ALTER TABLE "users" ADD COLUMN "widget_key" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "widget_origins" text[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_widget_key_unique" UNIQUE("widget_key");