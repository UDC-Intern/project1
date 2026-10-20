ALTER TABLE "parents" ADD COLUMN "referral_code" text;--> statement-breakpoint
ALTER TABLE "parents" ADD CONSTRAINT "parents_referral_code_unique" UNIQUE("referral_code");