CREATE TABLE "vouchers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"feedback_id" uuid,
	"code" text NOT NULL,
	"offer" text NOT NULL,
	"ip_hash" text,
	"expires_at" timestamp NOT NULL,
	"redeemed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "vouchers_feedback_id_unique" UNIQUE("feedback_id"),
	CONSTRAINT "vouchers_user_id_code_unique" UNIQUE("user_id","code")
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "voucher_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "voucher_offer" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "voucher_expiry_days" integer DEFAULT 30 NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "voucher_monthly_cap" integer DEFAULT 50 NOT NULL;--> statement-breakpoint
ALTER TABLE "vouchers" ADD CONSTRAINT "vouchers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vouchers" ADD CONSTRAINT "vouchers_feedback_id_feedback_id_fk" FOREIGN KEY ("feedback_id") REFERENCES "public"."feedback"("id") ON DELETE set null ON UPDATE no action;