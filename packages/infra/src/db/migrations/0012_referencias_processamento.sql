CREATE TABLE "reference_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"reference_id" uuid NOT NULL,
	"operation" text NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"quota_day" date NOT NULL,
	"quota_tool" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"started_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "reference_jobs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "saved_references" ADD COLUMN "evidence" jsonb;--> statement-breakpoint
ALTER TABLE "saved_references" ADD COLUMN "summary" text;--> statement-breakpoint
ALTER TABLE "saved_references" ADD COLUMN "analysis_status" text DEFAULT 'none' NOT NULL;--> statement-breakpoint
ALTER TABLE "reference_jobs" ADD CONSTRAINT "reference_jobs_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reference_jobs" ADD CONSTRAINT "reference_jobs_reference_id_saved_references_id_fk" FOREIGN KEY ("reference_id") REFERENCES "public"."saved_references"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "reference_jobs_status_idx" ON "reference_jobs" USING btree ("status","created_at");--> statement-breakpoint
CREATE POLICY "reference_jobs_isolation" ON "reference_jobs" AS PERMISSIVE FOR ALL TO public USING ("reference_jobs"."company_id" = nullif(current_setting('app.company_id', true), '')::uuid) WITH CHECK ("reference_jobs"."company_id" = nullif(current_setting('app.company_id', true), '')::uuid);
--> statement-breakpoint
ALTER TABLE "reference_jobs" FORCE ROW LEVEL SECURITY;
