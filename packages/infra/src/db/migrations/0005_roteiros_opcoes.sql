CREATE TYPE "public"."script_field" AS ENUM('hook', 'body', 'cta', 'caption');--> statement-breakpoint
CREATE TABLE "content_option_sets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"content_id" uuid NOT NULL,
	"field" "script_field" NOT NULL,
	"options" jsonb NOT NULL,
	"created_by_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "content_option_sets" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "content_option_sets" ADD CONSTRAINT "content_option_sets_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_option_sets" ADD CONSTRAINT "content_option_sets_content_id_contents_id_fk" FOREIGN KEY ("content_id") REFERENCES "public"."contents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_option_sets" ADD CONSTRAINT "content_option_sets_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "content_option_sets_company_content_idx" ON "content_option_sets" USING btree ("company_id","content_id","created_at");--> statement-breakpoint
CREATE POLICY "content_option_sets_company_isolation" ON "content_option_sets" AS PERMISSIVE FOR ALL TO public USING ("content_option_sets"."company_id" = nullif(current_setting('app.company_id', true), '')::uuid) WITH CHECK ("content_option_sets"."company_id" = nullif(current_setting('app.company_id', true), '')::uuid);--> statement-breakpoint
-- O dono da tabela também passa pelo RLS (RN-015), como em 0004_roteiros_rls_force.
ALTER TABLE "content_option_sets" FORCE ROW LEVEL SECURITY;
