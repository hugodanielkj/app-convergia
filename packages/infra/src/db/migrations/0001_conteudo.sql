CREATE TYPE "public"."approval_status" AS ENUM('none', 'in_preparation', 'pending', 'approved', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."creator_kind" AS ENUM('agency', 'client');--> statement-breakpoint
CREATE TYPE "public"."funnel_stage" AS ENUM('top', 'middle', 'bottom');--> statement-breakpoint
CREATE TYPE "public"."kanban_status" AS ENUM('idea', 'draft', 'edited', 'published');--> statement-breakpoint
CREATE TYPE "public"."media_type" AS ENUM('reel', 'carousel', 'image', 'story');--> statement-breakpoint
CREATE TABLE "contents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"created_by_user_id" uuid NOT NULL,
	"created_by_kind" "creator_kind" NOT NULL,
	"title" text NOT NULL,
	"idea" text,
	"script_hook" text,
	"script_body" text,
	"script_cta" text,
	"script_caption" text,
	"platform" text DEFAULT 'instagram' NOT NULL,
	"media_type" "media_type",
	"format" text,
	"category" text,
	"funnel_stage" "funnel_stage",
	"target_duration_seconds" integer,
	"status" "kanban_status" DEFAULT 'idea' NOT NULL,
	"position" double precision NOT NULL,
	"planned_date" date,
	"content_version" integer DEFAULT 1 NOT NULL,
	"approval_status" "approval_status" NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "contents_platform_instagram" CHECK ("contents"."platform" = 'instagram')
);
--> statement-breakpoint
ALTER TABLE "contents" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "contents" ADD CONSTRAINT "contents_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contents" ADD CONSTRAINT "contents_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "contents_company_status_position_idx" ON "contents" USING btree ("company_id","status","position");--> statement-breakpoint
CREATE INDEX "contents_company_planned_date_idx" ON "contents" USING btree ("company_id","planned_date");--> statement-breakpoint
CREATE POLICY "contents_company_isolation" ON "contents" AS PERMISSIVE FOR ALL TO public USING ("contents"."company_id" = nullif(current_setting('app.company_id', true), '')::uuid) WITH CHECK ("contents"."company_id" = nullif(current_setting('app.company_id', true), '')::uuid);