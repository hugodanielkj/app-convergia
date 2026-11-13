CREATE TYPE "public"."preview_status" AS ENUM('pending', 'applied', 'discarded');--> statement-breakpoint
CREATE TYPE "public"."refine_role" AS ENUM('user', 'assistant');--> statement-breakpoint
CREATE TABLE "ai_call_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"tool" text NOT NULL,
	"model" text NOT NULL,
	"input_tokens" integer,
	"output_tokens" integer,
	"duration_ms" integer NOT NULL,
	"success" boolean NOT NULL,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ai_call_log" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "content_generations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"content_id" uuid NOT NULL,
	"script" jsonb NOT NULL,
	"created_by_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "content_generations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "quota_usage" (
	"company_id" uuid NOT NULL,
	"tool_key" text NOT NULL,
	"day" date NOT NULL,
	"used" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "quota_usage_company_id_tool_key_day_pk" PRIMARY KEY("company_id","tool_key","day")
);
--> statement-breakpoint
ALTER TABLE "quota_usage" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "refine_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"seq" bigint GENERATED ALWAYS AS IDENTITY (sequence name "refine_messages_seq_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"company_id" uuid NOT NULL,
	"content_id" uuid NOT NULL,
	"role" "refine_role" NOT NULL,
	"text" text NOT NULL,
	"preview" jsonb,
	"preview_base_version" integer,
	"preview_status" "preview_status",
	"created_by_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "refine_messages" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "ai_call_log" ADD CONSTRAINT "ai_call_log_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_generations" ADD CONSTRAINT "content_generations_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_generations" ADD CONSTRAINT "content_generations_content_id_contents_id_fk" FOREIGN KEY ("content_id") REFERENCES "public"."contents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_generations" ADD CONSTRAINT "content_generations_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quota_usage" ADD CONSTRAINT "quota_usage_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refine_messages" ADD CONSTRAINT "refine_messages_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refine_messages" ADD CONSTRAINT "refine_messages_content_id_contents_id_fk" FOREIGN KEY ("content_id") REFERENCES "public"."contents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refine_messages" ADD CONSTRAINT "refine_messages_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ai_call_log_company_created_idx" ON "ai_call_log" USING btree ("company_id","created_at");--> statement-breakpoint
CREATE INDEX "content_generations_company_content_idx" ON "content_generations" USING btree ("company_id","content_id","created_at");--> statement-breakpoint
CREATE INDEX "refine_messages_company_content_seq_idx" ON "refine_messages" USING btree ("company_id","content_id","seq");--> statement-breakpoint
CREATE POLICY "ai_call_log_company_isolation" ON "ai_call_log" AS PERMISSIVE FOR ALL TO public USING ("ai_call_log"."company_id" = nullif(current_setting('app.company_id', true), '')::uuid) WITH CHECK ("ai_call_log"."company_id" = nullif(current_setting('app.company_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "content_generations_company_isolation" ON "content_generations" AS PERMISSIVE FOR ALL TO public USING ("content_generations"."company_id" = nullif(current_setting('app.company_id', true), '')::uuid) WITH CHECK ("content_generations"."company_id" = nullif(current_setting('app.company_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "quota_usage_company_isolation" ON "quota_usage" AS PERMISSIVE FOR ALL TO public USING ("quota_usage"."company_id" = nullif(current_setting('app.company_id', true), '')::uuid) WITH CHECK ("quota_usage"."company_id" = nullif(current_setting('app.company_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "refine_messages_company_isolation" ON "refine_messages" AS PERMISSIVE FOR ALL TO public USING ("refine_messages"."company_id" = nullif(current_setting('app.company_id', true), '')::uuid) WITH CHECK ("refine_messages"."company_id" = nullif(current_setting('app.company_id', true), '')::uuid);