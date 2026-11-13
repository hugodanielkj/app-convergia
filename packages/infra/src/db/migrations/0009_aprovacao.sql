CREATE TYPE "public"."approval_event_type" AS ENUM('submitted', 'updated_while_pending', 'cancelled', 'approved', 'approved_on_behalf', 'rejected', 'approval_lost');--> statement-breakpoint
CREATE TYPE "public"."approval_item_type" AS ENUM('script');--> statement-breakpoint
CREATE TYPE "public"."approval_request_status" AS ENUM('pending', 'approved', 'rejected', 'cancelled');--> statement-breakpoint
CREATE TABLE "approval_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"request_id" uuid NOT NULL,
	"content_id" uuid NOT NULL,
	"type" "approval_event_type" NOT NULL,
	"actor_id" uuid NOT NULL,
	"actor_kind" "creator_kind" NOT NULL,
	"item_version" integer NOT NULL,
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "approval_events" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "approval_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"content_id" uuid NOT NULL,
	"item_type" "approval_item_type" NOT NULL,
	"submitted_version" integer NOT NULL,
	"item_version" integer NOT NULL,
	"snapshot" jsonb NOT NULL,
	"status" "approval_request_status" NOT NULL,
	"submitted_by" uuid NOT NULL,
	"submitted_at" timestamp with time zone NOT NULL,
	"decided_by" uuid,
	"decided_at" timestamp with time zone,
	"decided_on_behalf" boolean DEFAULT false NOT NULL,
	"reason" text
);
--> statement-breakpoint
ALTER TABLE "approval_requests" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "contents" ADD COLUMN "current_approval_request_id" uuid;--> statement-breakpoint
ALTER TABLE "approval_events" ADD CONSTRAINT "approval_events_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approval_events" ADD CONSTRAINT "approval_events_request_id_approval_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."approval_requests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approval_events" ADD CONSTRAINT "approval_events_content_id_contents_id_fk" FOREIGN KEY ("content_id") REFERENCES "public"."contents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approval_events" ADD CONSTRAINT "approval_events_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approval_requests" ADD CONSTRAINT "approval_requests_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approval_requests" ADD CONSTRAINT "approval_requests_content_id_contents_id_fk" FOREIGN KEY ("content_id") REFERENCES "public"."contents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approval_requests" ADD CONSTRAINT "approval_requests_submitted_by_users_id_fk" FOREIGN KEY ("submitted_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approval_requests" ADD CONSTRAINT "approval_requests_decided_by_users_id_fk" FOREIGN KEY ("decided_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "approval_events_company_content_idx" ON "approval_events" USING btree ("company_id","content_id","created_at");--> statement-breakpoint
CREATE INDEX "approval_requests_company_content_idx" ON "approval_requests" USING btree ("company_id","content_id","submitted_at");--> statement-breakpoint
CREATE UNIQUE INDEX "approval_requests_one_pending_idx" ON "approval_requests" USING btree ("content_id") WHERE "approval_requests"."status" = 'pending';--> statement-breakpoint
CREATE POLICY "approval_events_company_isolation" ON "approval_events" AS PERMISSIVE FOR ALL TO public USING ("approval_events"."company_id" = nullif(current_setting('app.company_id', true), '')::uuid) WITH CHECK ("approval_events"."company_id" = nullif(current_setting('app.company_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "approval_requests_company_isolation" ON "approval_requests" AS PERMISSIVE FOR ALL TO public USING ("approval_requests"."company_id" = nullif(current_setting('app.company_id', true), '')::uuid) WITH CHECK ("approval_requests"."company_id" = nullif(current_setting('app.company_id', true), '')::uuid);--> statement-breakpoint
-- O dono das tabelas também passa pelo RLS (RN-015), como em 0004_roteiros_rls_force.
ALTER TABLE "approval_requests" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "approval_events" FORCE ROW LEVEL SECURITY;
