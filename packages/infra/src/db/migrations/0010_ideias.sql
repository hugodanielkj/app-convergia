ALTER TYPE "public"."approval_item_type" ADD VALUE 'idea';--> statement-breakpoint
CREATE TABLE "brainstorm_suggestions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"created_by_user_id" uuid NOT NULL,
	"created_by_kind" "creator_kind" NOT NULL,
	"title" text NOT NULL,
	"text" text NOT NULL,
	"reason" text NOT NULL,
	"state" text DEFAULT 'active' NOT NULL,
	"content_id" uuid,
	"content_version" integer DEFAULT 1 NOT NULL,
	"approval_status" "approval_status" NOT NULL,
	"current_approval_request_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "brainstorm_suggestions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "approval_events" ALTER COLUMN "content_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "approval_requests" ALTER COLUMN "content_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "approval_events" ADD COLUMN "idea_id" uuid;--> statement-breakpoint
ALTER TABLE "approval_requests" ADD COLUMN "idea_id" uuid;--> statement-breakpoint
ALTER TABLE "brainstorm_suggestions" ADD CONSTRAINT "brainstorm_suggestions_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "brainstorm_suggestions" ADD CONSTRAINT "brainstorm_suggestions_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "brainstorm_suggestions" ADD CONSTRAINT "brainstorm_suggestions_content_id_contents_id_fk" FOREIGN KEY ("content_id") REFERENCES "public"."contents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ideas_company_state_idx" ON "brainstorm_suggestions" USING btree ("company_id","state");--> statement-breakpoint
ALTER TABLE "approval_events" ADD CONSTRAINT "approval_events_idea_id_brainstorm_suggestions_id_fk" FOREIGN KEY ("idea_id") REFERENCES "public"."brainstorm_suggestions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approval_requests" ADD CONSTRAINT "approval_requests_idea_id_brainstorm_suggestions_id_fk" FOREIGN KEY ("idea_id") REFERENCES "public"."brainstorm_suggestions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "approval_ideas_one_pending_idx" ON "approval_requests" USING btree ("idea_id") WHERE "approval_requests"."status" = 'pending';--> statement-breakpoint
ALTER TABLE "approval_events" ADD CONSTRAINT "approval_events_target" CHECK (num_nonnulls("approval_events"."content_id", "approval_events"."idea_id") = 1);--> statement-breakpoint
ALTER TABLE "approval_requests" ADD CONSTRAINT "approval_requests_target" CHECK (("approval_requests"."content_id" IS NOT NULL AND "approval_requests"."idea_id" IS NULL AND "approval_requests"."item_type"::text = 'script') OR ("approval_requests"."content_id" IS NULL AND "approval_requests"."idea_id" IS NOT NULL AND "approval_requests"."item_type"::text = 'idea'));--> statement-breakpoint
CREATE POLICY "ideas_company_isolation" ON "brainstorm_suggestions" AS PERMISSIVE FOR ALL TO public USING ("brainstorm_suggestions"."company_id" = nullif(current_setting('app.company_id', true), '')::uuid) WITH CHECK ("brainstorm_suggestions"."company_id" = nullif(current_setting('app.company_id', true), '')::uuid);
--> statement-breakpoint
ALTER TABLE "brainstorm_suggestions" FORCE ROW LEVEL SECURITY;
