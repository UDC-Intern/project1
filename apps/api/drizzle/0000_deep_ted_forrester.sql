CREATE TABLE "app_settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "billing_packages" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"duration_days" integer,
	"list_price" integer NOT NULL,
	"price" integer NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "books" (
	"slug" text PRIMARY KEY NOT NULL,
	"grade" smallint NOT NULL,
	"subject" text NOT NULL,
	"title" text NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	"custom" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cash_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"day" date NOT NULL,
	"kind" text NOT NULL,
	"amount" integer NOT NULL,
	"category" text DEFAULT 'lain' NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"order_id" uuid,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cash_entries_order_id_unique" UNIQUE("order_id")
);
--> statement-breakpoint
CREATE TABLE "certificates" (
	"id" text PRIMARY KEY NOT NULL,
	"child_id" uuid NOT NULL,
	"child_name" text NOT NULL,
	"book_slug" text NOT NULL,
	"book_title" text NOT NULL,
	"topics" smallint NOT NULL,
	"levels" smallint NOT NULL,
	"design" text DEFAULT 'klasik' NOT NULL,
	"source" text NOT NULL,
	"average_score" smallint,
	"issued_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "children" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"parent_id" uuid,
	"class_id" uuid,
	"nickname" text NOT NULL,
	"momo_color" text DEFAULT 'blue' NOT NULL,
	"picture_pin_hash" text,
	"failed_pin_attempts" integer DEFAULT 0 NOT NULL,
	"pin_lock_count" integer DEFAULT 0 NOT NULL,
	"pin_locked_until" timestamp with time zone,
	"active" boolean DEFAULT true NOT NULL,
	"certificate_name" text,
	"certificate_consent_at" timestamp with time zone,
	"last_level_id" text,
	"last_active_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "classes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"facilitator_id" uuid NOT NULL,
	"name" text NOT NULL,
	"code" text NOT NULL,
	"closed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "classes_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "commission_payouts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"parent_id" uuid NOT NULL,
	"amount" integer NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "email_outbox" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"to_email" text NOT NULL,
	"subject" text NOT NULL,
	"html" text,
	"text" text,
	"kind" text NOT NULL,
	"ref_id" text,
	"status" text DEFAULT 'queued' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"smtp_response" text,
	"next_attempt_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"sent_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "email_verifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"parent_id" uuid NOT NULL,
	"purpose" text NOT NULL,
	"new_email" text,
	"code_hash" text NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" uuid PRIMARY KEY NOT NULL,
	"child_id" uuid NOT NULL,
	"type" text NOT NULL,
	"payload" jsonb NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "illustrations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" text NOT NULL,
	"subject" text NOT NULL,
	"theme" text NOT NULL,
	"count" smallint NOT NULL,
	"with_momo" boolean NOT NULL,
	"momo_color" text NOT NULL,
	"variant" smallint NOT NULL,
	"status" text DEFAULT 'review' NOT NULL,
	"engine" text NOT NULL,
	"prompt" text,
	"image_mime" text,
	"image_data" "bytea",
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reviewed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "level_progress" (
	"child_id" uuid NOT NULL,
	"level_id" text NOT NULL,
	"best_score" smallint DEFAULT 0 NOT NULL,
	"best_ms" integer,
	"passed" boolean DEFAULT false NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"first_passed_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "level_progress_child_id_level_id_pk" PRIMARY KEY("child_id","level_id")
);
--> statement-breakpoint
CREATE TABLE "levels" (
	"id" text PRIMARY KEY NOT NULL,
	"topic_id" text NOT NULL,
	"number" smallint NOT NULL,
	"title" text NOT NULL,
	"free_override" boolean,
	"generator" text,
	"generator_params" jsonb,
	"bank" jsonb,
	"custom" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "media_files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"mime" text NOT NULL,
	"bytes" integer NOT NULL,
	"data" "bytea" NOT NULL,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"number" text NOT NULL,
	"parent_id" uuid NOT NULL,
	"package_id" text NOT NULL,
	"package_name" text NOT NULL,
	"duration_days" integer,
	"list_price" integer NOT NULL,
	"discount" integer NOT NULL,
	"price" integer NOT NULL,
	"unique_code" integer NOT NULL,
	"total" integer NOT NULL,
	"method_id" text NOT NULL,
	"method_kind" text NOT NULL,
	"method_name" text NOT NULL,
	"method_number" text NOT NULL,
	"method_holder" text NOT NULL,
	"status" text DEFAULT 'awaiting_payment' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"proof_name" text,
	"proof_mime" text,
	"proof_data" "bytea",
	"proof_at" timestamp with time zone,
	"reject_note" text,
	"paid_at" timestamp with time zone,
	"reviewed_by" text,
	CONSTRAINT "orders_number_unique" UNIQUE("number")
);
--> statement-breakpoint
CREATE TABLE "parents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"family_code" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"consent_at" timestamp with time zone,
	"email_verified_at" timestamp with time zone,
	"password_changed_at" timestamp with time zone,
	"pending_email" text,
	"premium_until" timestamp with time zone,
	"signup_ip_hash" text,
	"last_login_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "parents_family_code_unique" UNIQUE("family_code")
);
--> statement-breakpoint
CREATE TABLE "payment_methods" (
	"id" text PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"name" text NOT NULL,
	"number" text NOT NULL,
	"holder" text NOT NULL,
	"instructions" text DEFAULT '' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "premium_grants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"child_id" uuid NOT NULL,
	"ends_at" timestamp with time zone,
	"note" text DEFAULT '' NOT NULL,
	"granted_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quiz_results" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"round_id" uuid NOT NULL,
	"child_id" uuid NOT NULL,
	"level_id" text NOT NULL,
	"book_slug" text NOT NULL,
	"score" smallint NOT NULL,
	"correct" smallint NOT NULL,
	"wrong" smallint NOT NULL,
	"duration_ms" integer NOT NULL,
	"passed" boolean NOT NULL,
	"result" jsonb NOT NULL,
	"finished_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "quiz_results_round_id_unique" UNIQUE("round_id")
);
--> statement-breakpoint
CREATE TABLE "referrals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"referrer_id" uuid NOT NULL,
	"referee_id" uuid NOT NULL,
	"status" text DEFAULT 'registered' NOT NULL,
	"order_id" uuid,
	"commission" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"paid_at" timestamp with time zone,
	CONSTRAINT "referrals_referee_id_unique" UNIQUE("referee_id")
);
--> statement-breakpoint
CREATE TABLE "round_answers" (
	"round_id" uuid NOT NULL,
	"idx" smallint NOT NULL,
	"chosen" text NOT NULL,
	"is_correct" boolean NOT NULL,
	"answered_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "round_answers_round_id_idx_pk" PRIMARY KEY("round_id","idx")
);
--> statement-breakpoint
CREATE TABLE "rounds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"child_id" uuid NOT NULL,
	"level_id" text NOT NULL,
	"seed" bigint NOT NULL,
	"generator_snapshot" jsonb NOT NULL,
	"stage_before" smallint DEFAULT 0 NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"source" text DEFAULT 'live' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "staff_users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"role" text DEFAULT 'admin' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"password_changed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stamps" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"image" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "topic_mastery" (
	"child_id" uuid NOT NULL,
	"topic_id" text NOT NULL,
	"score" smallint DEFAULT 0 NOT NULL,
	"visible_stage" smallint DEFAULT 0 NOT NULL,
	"challenge_correct" smallint DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "topic_mastery_child_id_topic_id_pk" PRIMARY KEY("child_id","topic_id")
);
--> statement-breakpoint
CREATE TABLE "topics" (
	"id" text PRIMARY KEY NOT NULL,
	"book_slug" text NOT NULL,
	"code" text NOT NULL,
	"title" text NOT NULL,
	"lesson" text NOT NULL,
	"tips" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	"custom" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "voice_clips" (
	"hash" text PRIMARY KEY NOT NULL,
	"text" text NOT NULL,
	"voice" text NOT NULL,
	"mime" text NOT NULL,
	"bytes" integer NOT NULL,
	"data" "bytea" NOT NULL,
	"hits" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_used_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "cash_entries" ADD CONSTRAINT "cash_entries_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_child_id_children_id_fk" FOREIGN KEY ("child_id") REFERENCES "public"."children"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "children" ADD CONSTRAINT "children_parent_id_parents_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."parents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "children" ADD CONSTRAINT "children_class_id_classes_id_fk" FOREIGN KEY ("class_id") REFERENCES "public"."classes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "classes" ADD CONSTRAINT "classes_facilitator_id_staff_users_id_fk" FOREIGN KEY ("facilitator_id") REFERENCES "public"."staff_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commission_payouts" ADD CONSTRAINT "commission_payouts_parent_id_parents_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."parents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_verifications" ADD CONSTRAINT "email_verifications_parent_id_parents_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."parents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_child_id_children_id_fk" FOREIGN KEY ("child_id") REFERENCES "public"."children"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "level_progress" ADD CONSTRAINT "level_progress_child_id_children_id_fk" FOREIGN KEY ("child_id") REFERENCES "public"."children"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "level_progress" ADD CONSTRAINT "level_progress_level_id_levels_id_fk" FOREIGN KEY ("level_id") REFERENCES "public"."levels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "levels" ADD CONSTRAINT "levels_topic_id_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."topics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_parent_id_parents_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."parents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "premium_grants" ADD CONSTRAINT "premium_grants_child_id_children_id_fk" FOREIGN KEY ("child_id") REFERENCES "public"."children"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz_results" ADD CONSTRAINT "quiz_results_round_id_rounds_id_fk" FOREIGN KEY ("round_id") REFERENCES "public"."rounds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz_results" ADD CONSTRAINT "quiz_results_child_id_children_id_fk" FOREIGN KEY ("child_id") REFERENCES "public"."children"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz_results" ADD CONSTRAINT "quiz_results_level_id_levels_id_fk" FOREIGN KEY ("level_id") REFERENCES "public"."levels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_referrer_id_parents_id_fk" FOREIGN KEY ("referrer_id") REFERENCES "public"."parents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_referee_id_parents_id_fk" FOREIGN KEY ("referee_id") REFERENCES "public"."parents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "round_answers" ADD CONSTRAINT "round_answers_round_id_rounds_id_fk" FOREIGN KEY ("round_id") REFERENCES "public"."rounds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rounds" ADD CONSTRAINT "rounds_child_id_children_id_fk" FOREIGN KEY ("child_id") REFERENCES "public"."children"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rounds" ADD CONSTRAINT "rounds_level_id_levels_id_fk" FOREIGN KEY ("level_id") REFERENCES "public"."levels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "topic_mastery" ADD CONSTRAINT "topic_mastery_child_id_children_id_fk" FOREIGN KEY ("child_id") REFERENCES "public"."children"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "topic_mastery" ADD CONSTRAINT "topic_mastery_topic_id_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."topics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "topics" ADD CONSTRAINT "topics_book_slug_books_slug_fk" FOREIGN KEY ("book_slug") REFERENCES "public"."books"("slug") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "cash_entries_day_idx" ON "cash_entries" USING btree ("day");--> statement-breakpoint
CREATE UNIQUE INDEX "certificates_child_book_key" ON "certificates" USING btree ("child_id","book_slug");--> statement-breakpoint
CREATE INDEX "children_parent_idx" ON "children" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "children_class_idx" ON "children" USING btree ("class_id");--> statement-breakpoint
CREATE UNIQUE INDEX "children_parent_nickname_key" ON "children" USING btree ("parent_id",lower("nickname")) WHERE "children"."parent_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "children_class_nickname_key" ON "children" USING btree ("class_id",lower("nickname")) WHERE "children"."class_id" is not null;--> statement-breakpoint
CREATE INDEX "classes_facilitator_idx" ON "classes" USING btree ("facilitator_id");--> statement-breakpoint
CREATE INDEX "commission_payouts_parent_idx" ON "commission_payouts" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "email_outbox_due_idx" ON "email_outbox" USING btree ("status","next_attempt_at");--> statement-breakpoint
CREATE INDEX "email_verifications_parent_idx" ON "email_verifications" USING btree ("parent_id","purpose","created_at");--> statement-breakpoint
CREATE INDEX "events_child_idx" ON "events" USING btree ("child_id","occurred_at");--> statement-breakpoint
CREATE INDEX "illustrations_status_idx" ON "illustrations" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "level_progress_level_idx" ON "level_progress" USING btree ("level_id");--> statement-breakpoint
CREATE UNIQUE INDEX "levels_topic_number_key" ON "levels" USING btree ("topic_id","number");--> statement-breakpoint
CREATE INDEX "orders_parent_idx" ON "orders" USING btree ("parent_id","created_at");--> statement-breakpoint
CREATE INDEX "orders_status_idx" ON "orders" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "orders_open_total_idx" ON "orders" USING btree ("status","total");--> statement-breakpoint
CREATE UNIQUE INDEX "parents_email_key" ON "parents" USING btree (lower("email"));--> statement-breakpoint
CREATE INDEX "premium_grants_child_idx" ON "premium_grants" USING btree ("child_id");--> statement-breakpoint
CREATE INDEX "quiz_results_child_idx" ON "quiz_results" USING btree ("child_id","finished_at");--> statement-breakpoint
CREATE INDEX "quiz_results_level_idx" ON "quiz_results" USING btree ("level_id");--> statement-breakpoint
CREATE INDEX "quiz_results_finished_idx" ON "quiz_results" USING btree ("finished_at");--> statement-breakpoint
CREATE INDEX "quiz_results_book_idx" ON "quiz_results" USING btree ("book_slug");--> statement-breakpoint
CREATE INDEX "referrals_referrer_idx" ON "referrals" USING btree ("referrer_id");--> statement-breakpoint
CREATE INDEX "rounds_child_started_idx" ON "rounds" USING btree ("child_id","started_at");--> statement-breakpoint
CREATE INDEX "rounds_level_idx" ON "rounds" USING btree ("level_id");--> statement-breakpoint
CREATE UNIQUE INDEX "staff_users_email_key" ON "staff_users" USING btree (lower("email"));--> statement-breakpoint
CREATE UNIQUE INDEX "topics_book_code_key" ON "topics" USING btree ("book_slug","code");--> statement-breakpoint
CREATE INDEX "voice_clips_created_idx" ON "voice_clips" USING btree ("created_at");