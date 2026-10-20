CREATE TABLE "affiliate_accounts" (
	"parent_id" uuid PRIMARY KEY NOT NULL,
	"provider_id" text NOT NULL,
	"provider_name" text NOT NULL,
	"kind" text NOT NULL,
	"account_encrypted" text NOT NULL,
	"account_hash" text NOT NULL,
	"account_last4" text NOT NULL,
	"holder_name" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"review_note" text,
	"changed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "affiliate_action_codes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"parent_id" uuid NOT NULL,
	"code_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"consumed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "affiliate_click_days" (
	"parent_id" uuid NOT NULL,
	"day" date NOT NULL,
	"clicks" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "affiliate_click_days_parent_id_day_pk" PRIMARY KEY("parent_id","day")
);
--> statement-breakpoint
CREATE TABLE "affiliate_ledger" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"parent_id" uuid NOT NULL,
	"type" text NOT NULL,
	"state" text NOT NULL,
	"amount" integer NOT NULL,
	"referee_id" uuid,
	"order_id" uuid,
	"payout_id" uuid,
	"available_at" timestamp with time zone,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "affiliate_payout_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"parent_id" uuid NOT NULL,
	"amount" integer NOT NULL,
	"provider_name" text NOT NULL,
	"account_last4" text NOT NULL,
	"account_encrypted" text NOT NULL,
	"holder_name" text NOT NULL,
	"status" text DEFAULT 'requested' NOT NULL,
	"note" text,
	"transfer_ref" text,
	"reviewed_by" uuid,
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reviewed_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "affiliate_accounts" ADD CONSTRAINT "affiliate_accounts_parent_id_parents_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."parents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "affiliate_action_codes" ADD CONSTRAINT "affiliate_action_codes_parent_id_parents_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."parents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "affiliate_click_days" ADD CONSTRAINT "affiliate_click_days_parent_id_parents_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."parents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "affiliate_ledger" ADD CONSTRAINT "affiliate_ledger_parent_id_parents_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."parents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "affiliate_ledger" ADD CONSTRAINT "affiliate_ledger_referee_id_parents_id_fk" FOREIGN KEY ("referee_id") REFERENCES "public"."parents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "affiliate_ledger" ADD CONSTRAINT "affiliate_ledger_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "affiliate_payout_requests" ADD CONSTRAINT "affiliate_payout_requests_parent_id_parents_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."parents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "affiliate_payout_requests" ADD CONSTRAINT "affiliate_payout_requests_reviewed_by_staff_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."staff_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "affiliate_accounts_hash_idx" ON "affiliate_accounts" USING btree ("account_hash");--> statement-breakpoint
CREATE INDEX "affiliate_action_codes_parent_idx" ON "affiliate_action_codes" USING btree ("parent_id","created_at");--> statement-breakpoint
CREATE INDEX "affiliate_ledger_parent_idx" ON "affiliate_ledger" USING btree ("parent_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "affiliate_ledger_bonus_uq" ON "affiliate_ledger" USING btree ("referee_id") WHERE "affiliate_ledger"."type" = 'signup_bonus';--> statement-breakpoint
CREATE UNIQUE INDEX "affiliate_ledger_commission_uq" ON "affiliate_ledger" USING btree ("order_id") WHERE "affiliate_ledger"."type" = 'commission';--> statement-breakpoint
CREATE INDEX "affiliate_payout_requests_parent_idx" ON "affiliate_payout_requests" USING btree ("parent_id","requested_at");--> statement-breakpoint
CREATE UNIQUE INDEX "affiliate_payout_requests_open_uq" ON "affiliate_payout_requests" USING btree ("parent_id") WHERE "affiliate_payout_requests"."status" = 'requested';
--> statement-breakpoint
INSERT INTO affiliate_ledger (parent_id, type, state, amount, referee_id, available_at, note, created_at)
SELECT r.referrer_id, 'signup_bonus',
  CASE WHEN p.email_verified_at IS NOT NULL AND (
    SELECT count(*) FROM quiz_results q JOIN children c ON c.id=q.child_id
    WHERE c.parent_id=r.referee_id AND q.finished_at <= r.created_at + interval '30 days'
  ) >= 3 THEN 'available'
  WHEN r.created_at + interval '30 days' <= now() THEN 'void' ELSE 'pending' END,
  3500, r.referee_id, r.created_at + interval '30 days', 'Bonus ajakan sebelum pembaruan', r.created_at
FROM referrals r JOIN parents p ON p.id=r.referee_id
ON CONFLICT DO NOTHING;
--> statement-breakpoint
INSERT INTO affiliate_ledger (parent_id, type, state, amount, referee_id, order_id, available_at, note, created_at)
SELECT r.referrer_id, 'commission',
  CASE WHEN coalesce(r.paid_at, o.paid_at, now()) + interval '7 days' <= now() THEN 'available' ELSE 'pending' END,
  r.commission, r.referee_id, r.order_id,
  coalesce(r.paid_at, o.paid_at, now()) + interval '7 days', 'Komisi sebelum pembaruan',
  coalesce(r.paid_at, o.paid_at, now())
FROM referrals r JOIN orders o ON o.id=r.order_id
WHERE r.commission > 0 AND o.status='paid'
ON CONFLICT DO NOTHING;
--> statement-breakpoint
INSERT INTO affiliate_ledger (parent_id, type, state, amount, payout_id, note, created_at)
SELECT parent_id, 'payout', 'available', -amount, id, note, created_at
FROM commission_payouts
ON CONFLICT DO NOTHING;
